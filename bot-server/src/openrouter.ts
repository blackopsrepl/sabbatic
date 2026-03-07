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
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as {
    choices?: { message: { content: string } }[];
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message}`);
  }

  return data.choices?.[0]?.message?.content || '';
}

export function getOpenRouterKey(botKey: string | null, env: EnvVars): string {
  return botKey || env.OPENROUTER_API_KEY;
}
