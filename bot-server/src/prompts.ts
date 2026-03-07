import type { Message } from './types.js';

export const DEFAULT_SOUL = `You are a bot in a group chat room. 
- Keep responses short and conversational (2-4 sentences max).
- Only respond if you have something valuable to add.
- When responding to someone, address them by name.
- Use appropriate tone for a casual chat.`;

export function buildSystemPrompt(soul: string, roomName: string | null, recentMessages: Message[]): string {
  const contextRoomName = displayRoomName(roomName);
  const messageContext = recentMessages.length > 0
    ? `\n\nRecent messages in "${contextRoomName}":\n${recentMessages.map(m => `${m.user_name}: ${m.body}`).join('\n')}`
    : '';

  return `${soul}

You are in a chat room called "${contextRoomName}".${messageContext}

Guidelines:
- Be concise and conversational
- Stay in character
- Respond only if you have something meaningful to add`;
}

export function buildMentionPrompt(soul: string, roomName: string | null, senderName: string, message: string, recentMessages: Message[]): string {
  const contextRoomName = displayRoomName(roomName);
  const messageContext = recentMessages.length > 0
    ? `\n\nRecent messages:\n${recentMessages.map(m => `${m.user_name}: ${m.body}`).join('\n')}`
    : '';

  return `${soul}

You are in a chat room called "${contextRoomName}".${messageContext}

${senderName} mentioned you with: "${message}"

Respond to their message directly. Keep it short and conversational.`;
}

export function buildRespondToAnyPrompt(soul: string, roomName: string | null, recentMessages: Message[], newMessage: Message): string {
  const contextRoomName = displayRoomName(roomName);

  return `${soul}

You are in a chat room called "${contextRoomName}" with recent messages:
${recentMessages.map(m => `${m.user_name}: ${m.body}`).join('\n')}

The latest message is: "${newMessage.user_name}: ${newMessage.body}"

Do you need to respond to this message? If yes, respond briefly. If not, just say "SKIP" (no other text).`;
}

function displayRoomName(roomName: string | null): string {
  return roomName || 'Direct Message';
}
