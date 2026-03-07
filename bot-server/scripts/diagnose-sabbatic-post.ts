import 'dotenv/config';

function usage(): never {
  console.error('Usage: pnpm diagnose-post --room ROOM_ID --bot-key BOT_KEY [--base-url URL] [--message TEXT]');
  process.exit(1);
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const roomId = arg('--room');
  const botKey = arg('--bot-key');
  const baseUrl = arg('--base-url') || process.env.SABBATIC_BASE_URL;
  const message = arg('--message') || `diagnostic ping ${new Date().toISOString()}`;

  if (!roomId || !botKey || !baseUrl) usage();

  const postUrl = `${baseUrl}/rooms/${roomId}/${botKey}/messages`;
  const indexUrl = `${baseUrl}/rooms/${roomId}/messages?bot_key=${encodeURIComponent(botKey)}`;

  console.log('[diag] starting');
  console.log('[diag] baseUrl:', baseUrl);
  console.log('[diag] roomId:', roomId);
  console.log('[diag] botKeyHint:', botKeyHint(botKey));

  console.log('[diag] checking bot key auth via GET', indexUrl);
  const getRes = await fetch(indexUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    redirect: 'manual',
  });

  console.log('[diag] GET status:', getRes.status, getRes.statusText);
  console.log('[diag] GET location:', getRes.headers.get('location'));
  console.log('[diag] GET request id:', getRes.headers.get('x-request-id'));

  const getBody = (await getRes.text()).slice(0, 300);
  console.log('[diag] GET body preview:', JSON.stringify(getBody));

  console.log('[diag] posting message via bot endpoint', postUrl);
  const postRes = await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', Accept: 'text/plain,application/json' },
    body: message,
    redirect: 'manual',
  });

  console.log('[diag] POST status:', postRes.status, postRes.statusText);
  console.log('[diag] POST location:', postRes.headers.get('location'));
  console.log('[diag] POST request id:', postRes.headers.get('x-request-id'));

  const postBody = (await postRes.text()).slice(0, 300);
  console.log('[diag] POST body preview:', JSON.stringify(postBody));

  if (!postRes.ok) {
    process.exitCode = 2;
  }
}

function botKeyHint(botKey: string): string {
  const [id, token = ''] = botKey.split('-', 2);
  if (!id || !token) {
    return '[invalid format]';
  }

  return `${id}-${token.slice(0, 3)}…${token.slice(-3)}`;
}

main().catch((error) => {
  console.error('[diag] failed:', (error as Error).message);
  process.exit(1);
});
