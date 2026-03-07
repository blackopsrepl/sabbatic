import { getBotByShortcode, canSendMessage } from './db.js';
import { callOpenRouter, getOpenRouterKey } from './openrouter.js';
import { buildMentionPrompt, buildRespondToAnyPrompt } from './prompts.js';
import type { WebhookPayload, Message, EnvVars } from './types.js';

type WebhookResult = { success: boolean; response?: string; error?: string; reason?: string };

const ROOM_CONTEXT_LIMIT = 20;
const roomContexts = new Map<string, Message[]>();

export async function handleWebhook(
  payload: WebhookPayload,
  botShortcode: string,
  env: EnvVars
): Promise<WebhookResult> {
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
  const normalizedRoomName = roomName ?? `Direct room #${payload.room.id}`;
  const contextKey = roomContextKey(payload.room.id, botShortcode);
  const recentMessages = loadRecentMessages(contextKey);

  rememberIncomingMessage(contextKey, payload);

  // Check if bot was mentioned (plain text can omit ActionText mention attachments, so inspect HTML too)
  const wasMentionedInPlainText = includesBotMentionInText(messageText, botShortcode);
  const wasMentionedInHtml = includesBotMentionInHtml(payload.message.body.html, botShortcode);
  const wasMentioned = wasMentionedInPlainText || wasMentionedInHtml;
  const isDirectConversation = roomName == null;

  console.log('[WEBHOOK] Routing decision', {
    bot: botShortcode,
    messageId: payload.message.id,
    roomId: payload.room.id,
    roomName: normalizedRoomName,
    isDirectConversation,
    wasMentioned,
    wasMentionedInPlainText,
    wasMentionedInHtml,
    respondToAny: Boolean(bot.respond_to_any),
    recentContextMessages: recentMessages.length,
  });

  if (wasMentioned || isDirectConversation) {
    const trigger = wasMentioned ? 'mention' : 'direct-room';
    const systemPrompt = buildMentionPrompt(
      bot.soul,
      normalizedRoomName,
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

      const normalized = response.trim();
      console.log('[WEBHOOK] Mention/direct OpenRouter result', {
        trigger,
        chars: response.length,
        normalizedChars: normalized.length,
        containsSkip: response.includes('SKIP'),
      });

      if (normalized && !response.includes('SKIP')) {
        await postMessageToSabbatic(bot.bot_key, normalized, payload.room.id, env);
        rememberBotReply(contextKey, bot.name, normalized);
        return { success: true, response: normalized, reason: `replied-via-${trigger}` };
      }

      return { success: true, response: '', reason: `empty-or-skip-via-${trigger}` };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Check if bot responds to any
  if (bot.respond_to_any) {
    const newMessage: Message = {
      id: payload.message.id,
      user_id: payload.user.id,
      user_name: senderName,
      body: messageText,
      created_at: new Date().toISOString(),
    };

    const systemPrompt = buildRespondToAnyPrompt(
      bot.soul,
      normalizedRoomName,
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

      const normalized = shouldRespond.trim();
      console.log('[WEBHOOK] Respond-to-any OpenRouter result', {
        chars: shouldRespond.length,
        normalizedChars: normalized.length,
        containsSkip: shouldRespond.includes('SKIP'),
      });

      if (!shouldRespond.includes('SKIP') && normalized) {
        await postMessageToSabbatic(bot.bot_key, normalized, payload.room.id, env);
        rememberBotReply(contextKey, bot.name, normalized);
        return { success: true, response: normalized, reason: 'replied-via-respond-to-any' };
      }

      return { success: true, response: '', reason: 'empty-or-skip-via-respond-to-any' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  return { success: true, response: '', reason: 'no-trigger-met' };
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
      Accept: 'text/plain, application/json;q=0.9, */*;q=0.1',
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

function roomContextKey(roomId: number, botShortcode: string): string {
  return `${roomId}:${botShortcode.toLowerCase()}`;
}

function loadRecentMessages(contextKey: string): Message[] {
  return [ ...(roomContexts.get(contextKey) || []) ];
}

function rememberIncomingMessage(contextKey: string, payload: WebhookPayload): void {
  const messages = loadRecentMessages(contextKey);

  messages.push({
    id: payload.message.id,
    user_id: payload.user.id,
    user_name: payload.user.name,
    body: payload.message.body.plain,
    created_at: new Date().toISOString(),
  });

  roomContexts.set(contextKey, tail(messages, ROOM_CONTEXT_LIMIT));
}

function rememberBotReply(contextKey: string, botName: string, body: string): void {
  const messages = loadRecentMessages(contextKey);

  messages.push({
    id: Date.now(),
    user_id: 0,
    user_name: botName,
    body,
    created_at: new Date().toISOString(),
  });

  roomContexts.set(contextKey, tail(messages, ROOM_CONTEXT_LIMIT));
}

function tail<T>(list: T[], count: number): T[] {
  return list.slice(Math.max(0, list.length - count));
}

function includesBotMentionInText(text: string, botShortcode: string): boolean {
  return text.toLowerCase().includes(`@${botShortcode}`.toLowerCase());
}

function includesBotMentionInHtml(html: string, botShortcode: string): boolean {
  if (!html) return false;

  const normalizedHtml = html.toLowerCase();
  const normalizedBotShortcode = botShortcode.toLowerCase();

  if (!normalizedHtml.includes('application/vnd.campfire.mention')) {
    return false;
  }

  return normalizedHtml.includes(normalizedBotShortcode);
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
