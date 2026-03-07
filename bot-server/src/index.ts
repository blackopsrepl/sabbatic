import { Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import 'dotenv/config';
import { initDb, getAllBots, getBotByShortcode } from './db.js';
import { handleWebhook } from './bots.js';
import type { EnvVars, WebhookPayload } from './types.js';

type Env = {
  Variables: {
    env: EnvVars;
  };
};

const app = new Hono<Env>();

app.use('*', logger());
app.use('*', cors());

app.use('*', (c, next) => {
  c.set('env', {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    BOT_SERVER_PORT: process.env.BOT_SERVER_PORT || '3333',
    SABBATIC_BASE_URL: process.env.SABBATIC_BASE_URL || '',
  });
  return next();
});


function webhookUrlFor(c: Context<Env>, shortcode: string): string {
  const requestUrl = new URL(c.req.url);
  const botServerPort = process.env.BOT_SERVER_PORT || '3333';

  requestUrl.pathname = `/webhook/${shortcode}`;
  requestUrl.port = botServerPort;

  return requestUrl.toString();
}

// Health check
app.get('/', (c) => {
  console.log(`[HEALTH] GET /`);
  return c.json({ status: 'ok', bots: getAllBots().length });
});

// Webhook endpoint for individual bots
app.post('/webhook/:botId', async (c) => {
  const botId = c.req.param('botId');
  const env = c.get('env');

  console.log(`[WEBHOOK] Received request for bot: ${botId}`);

  if (!env.OPENROUTER_API_KEY) {
    console.log(`[WEBHOOK] ERROR: OPENROUTER_API_KEY not configured`);
    return c.json({ error: 'OPENROUTER_API_KEY not configured' }, 500);
  }

  try {
    const payload = await c.req.json() as WebhookPayload;
    console.log(`[WEBHOOK] Payload:`, JSON.stringify(payload, null, 2));
    
    const result = await handleWebhook(payload, botId, env);

    if (!result.success) {
      console.log(`[WEBHOOK] ERROR: ${result.error}`);
      return c.json({ error: result.error }, 400);
    }

    console.log(`[WEBHOOK] Success! Response: ${result.response}`);
    console.log(`[WEBHOOK] Result reason: ${result.reason ?? "n/a"}`);
    return c.json({ success: true, response: result.response, reason: result.reason });
  } catch (error) {
    console.log(`[WEBHOOK] EXCEPTION:`, (error as Error).message);
    return c.json({ error: (error as Error).message }, 500);
  }
});

// Admin: List all bots
app.get('/admin/bots', (c) => {
  console.log(`[ADMIN] GET /admin/bots`);
  const bots = getAllBots();
  return c.json({ bots: bots.map(b => ({
    ...b,
    respond_to_any: Boolean(b.respond_to_any),
    webhook_url: webhookUrlFor(c, b.shortcode),
  })) });
});

// Admin: Get single bot
app.get('/admin/bots/:shortcode', (c) => {
  const shortcode = c.req.param('shortcode');
  console.log(`[ADMIN] GET /admin/bots/${shortcode}`);
  const bot = getBotByShortcode(shortcode);
  
  if (!bot) {
    console.log(`[ADMIN] Bot not found: ${shortcode}`);
    return c.json({ error: 'Bot not found' }, 404);
  }

  return c.json({ 
    bot: {
      ...bot,
      respond_to_any: Boolean(bot.respond_to_any),
      webhook_url: webhookUrlFor(c, bot.shortcode),
    } 
  });
});

// Initialize and start
const port = parseInt(process.env.BOT_SERVER_PORT || '3333');

async function start() {
  console.log('Initializing database...');
  await initDb();

  console.log(`Starting server on port ${port}...`);

  serve({
      fetch: app.fetch,
      port: port
  });

  return {
    port,
    fetch: app.fetch,
  };
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default { port, fetch: app.fetch };
