import type { EnvVars } from './types.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(
  message: string,
  model: string,
  apiKey: string,
  systemPrompt?: string
): Promise<string> {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: message });

  console.log('[OPENROUTER] request', {
    model,
    hasSystemPrompt: Boolean(systemPrompt),
    userMessageChars: message.length,
  });

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/sabbatic/bot-server',
      'X-Title': 'Sabbatic Bot Server',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('[OPENROUTER] non-2xx response', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: error.slice(0, 500),
    });
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    error?: { message: string };
    id?: string;
    model?: string;
  };

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  const choice = data.choices?.[0];
  const content = choice?.message?.content || '';

  console.log('[OPENROUTER] response', {
    id: data.id,
    model: data.model,
    choices: data.choices?.length ?? 0,
    finishReason: choice?.finish_reason,
    contentChars: content.length,
    contentPreview: content.slice(0, 120),
  });

  return content;
}

export function getOpenRouterKey(botKey: string | null, env: EnvVars): string {
  return botKey || env.OPENROUTER_API_KEY;
}
