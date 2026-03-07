import { createInterface } from 'readline';
import { createBot, getAllBots, initDb } from '../src/db.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  await initDb();
  console.log('\n=== Create New Bot ===\n');

  const shortcode = await ask('Shortcode (for @mentions): ');
  if (!shortcode.trim()) {
    console.log('Shortcode is required');
    process.exit(1);
  }

  const existing = getAllBots();
  if (existing.some(b => b.shortcode === shortcode)) {
    console.log(`Bot with shortcode "${shortcode}" already exists`);
    process.exit(1);
  }

  const name = await ask('Display name: ');
  if (!name.trim()) {
    console.log('Name is required');
    process.exit(1);
  }

  const soul = await ask('Soul (system prompt): ');
  if (!soul.trim()) {
    console.log('Soul is required');
    process.exit(1);
  }

  const model = await ask('Model (e.g., anthropic/claude-3.5-sonnet): ');
  if (!model.trim()) {
    console.log('Model is required');
    process.exit(1);
  }

  const bot_key = await ask('Bot key (Sabbatic API key): ');
  if (!bot_key.trim()) {
    console.log('Bot key is required');
    process.exit(1);
  }

  const openrouter_api_key = await ask('OpenRouter API key (optional, Enter for global): ');
  
  const respondToAnyRaw = await ask('Respond to any messages? (y/N): ');
  const respond_to_any = respondToAnyRaw.toLowerCase().startsWith('y');

  const rateLimitRaw = await ask('Rate limit (messages/hour, default 20): ');
  const rate_limit_hourly = parseInt(rateLimitRaw) || 20;

  try {
    const bot = createBot({
      shortcode: shortcode.trim(),
      name: name.trim(),
      soul: soul.trim(),
      model: model.trim(),
      bot_key: bot_key.trim(),
      openrouter_api_key: openrouter_api_key.trim() || undefined,
      respond_to_any,
      rate_limit_hourly,
    });

    console.log('\n✓ Bot created successfully!');
    console.log(`  ID: ${bot.id}`);
    console.log(`  Shortcode: @${bot.shortcode}`);
    const botServerPort = process.env.BOT_SERVER_PORT || '3333';
    console.log(`  Webhook: http://localhost:${botServerPort}/webhook/${bot.shortcode}`);
  } catch (error) {
    console.error('\n✗ Error creating bot:', (error as Error).message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
