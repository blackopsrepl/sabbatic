import { getBotByShortcode, canSendMessage } from './db.js';
import { callOpenRouter, getOpenRouterKey } from './openrouter.js';
import { buildMentionPrompt, buildRespondToAnyPrompt } from './prompts.js';
import type { WebhookPayload, Message, EnvVars } from './types.js';

export async function handleWebhook(
  payload: WebhookPayload,
  botShortcode: string,
  env: EnvVars
): Promise<{ success: boolean; response?: string; error?: string }> {
  const bot = getBotByShortcode(botShortcode);

  if (!bot) {
    return { success: false, error: 'Bot not found' };
  }

  if (!canSendMessage(bot.id)) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  const apiKey = getOpenRouterKey(bot.openrouter_api_key, env);
  const messageText = payload.message.body.plain;
  const senderName = payload.user.name;
  const roomName = payload.room.name;

  // Get recent messages for context (simplified - in production, fetch from Sabbatic API)
  const recentMessages: Message[] = [];

  // Check if bot was mentioned
  const mentionPattern = new RegExp(`@${botShortcode}`, 'i');
  const wasMentioned = mentionPattern.test(messageText);

  if (wasMentioned) {
    const systemPrompt = buildMentionPrompt(
      bot.soul,
      roomName,
      senderName,
      messageText,
      recentMessages
    );

    try {
      const response = await callOpenRouter(
        messageText,
        bot.model,
        apiKey,
        systemPrompt
      );

      if (response.trim() && !response.includes('SKIP')) {
        await postMessageToSabbatic(bot.bot_key, response, payload.room.id, env);
        return { success: true, response };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Check if bot responds to any
  if (bot.respond_to_any) {
    const newMessage: Message = {
      id: payload.message.id,
      user_id: 0,
      user_name: senderName,
      body: messageText,
      created_at: new Date().toISOString(),
    };

    const systemPrompt = buildRespondToAnyPrompt(
      bot.soul,
      roomName,
      recentMessages,
      newMessage
    );

    try {
      const shouldRespond = await callOpenRouter(
        'Should you respond to the latest message?',
        bot.model,
        apiKey,
        systemPrompt
      );

      if (!shouldRespond.includes('SKIP') && shouldRespond.trim()) {
        await postMessageToSabbatic(bot.bot_key, shouldRespond.trim(), payload.room.id, env);
        return { success: true, response: shouldRespond };
      }
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return { success: true, response: '' };
}

export async function postMessageToSabbatic(
  botKey: string,
  message: string,
  roomId: number,
  env: EnvVars
): Promise<void> {
  const url = `${env.SABBATIC_BASE_URL}/rooms/${roomId}/${botKey}/messages`;

  console.log('[SABBATIC] Posting bot message', {
    url,
    roomId,
    botKeyHint: botKeyHint(botKey),
    messageChars: message.length,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'Accept': 'text/plain, application/json;q=0.9, */*;q=0.1',
    },
    body: message,
  });

  if (!response.ok) {
    const body = await response.text();
    const location = response.headers.get('location');
    const requestId = response.headers.get('x-request-id');

    console.log('[SABBATIC] Bot post failed', {
      status: response.status,
      statusText: response.statusText,
      location,
      requestId,
      bodyPreview: body.slice(0, 500),
      botKeyHint: botKeyHint(botKey),
    });

    throw new Error(
      `Failed to post message: status=${response.status} statusText=${response.statusText} location=${location ?? '-'} request_id=${requestId ?? '-'} body=${body.slice(0, 200)}`
    );
  }

  console.log('[SABBATIC] Bot post succeeded', {
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    botKeyHint: botKeyHint(botKey),
  });
}

function botKeyHint(botKey: string): string {
  const [id, token = ''] = botKey.split('-', 2);
  if (!id || !token) {
    return '[invalid format]';
  }

  const prefix = token.slice(0, 3);
  const suffix = token.slice(-3);
  return `${id}-${prefix}…${suffix}`;
}

export function extractMentions(text: string): string[] {
  const mentionPattern = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionPattern.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}
