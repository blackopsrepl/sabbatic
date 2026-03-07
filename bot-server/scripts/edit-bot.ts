import { createInterface } from 'readline';
import { getAllBots, getBotById, updateBot, initDb } from '../src/db.js';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string | null) => {
      resolve(answer ?? '');
    });
  });
}

async function main() {
  await initDb();
  const bots = getAllBots();

  if (bots.length === 0) {
    console.log('No bots found');
    rl.close();
    process.exit(0);
  }

  console.log('\n=== Edit Bot ===\n');
  console.log('Available bots:\n');
  bots.forEach((bot, i) => {
    console.log(`  ${i + 1}. @${bot.shortcode} (${bot.name}) - ${bot.model}`);
  });

  const selection = await ask('\nSelect bot number: ');
  const index = parseInt(selection) - 1;

  if (isNaN(index) || index < 0 || index >= bots.length) {
    console.log('Invalid selection');
    process.exit(1);
  }

  const bot = bots[index];
  console.log(`\nEditing: @${bot.shortcode} (${bot.name})`);
  console.log('(Press Enter to keep current value)\n');

  const name = await ask(`Name [${bot.name}]: `);
  const soul = await ask(`Soul [${bot.soul.substring(0, 50)}...]: `);
  const model = await ask(`Model [${bot.model}]: `);
  const bot_key = await ask(`Bot key [${bot.bot_key}]: `);
  const openrouter_api_key = await ask(`OpenRouter API key [${bot.openrouter_api_key || '(global)'}]: `);
  const respondToAnyRaw = await ask(`Respond to any? (y/N) [${bot.respond_to_any ? 'Y' : 'N'}]: `);
  const rateLimitRaw = await ask(`Rate limit/hour [${bot.rate_limit_hourly}]: `);

  const updates: {
    name?: string;
    soul?: string;
    model?: string;
    bot_key?: string;
    openrouter_api_key?: string | null;
    respond_to_any?: boolean;
    rate_limit_hourly?: number;
  } = {};

  if (name.trim()) updates.name = name.trim();
  if (soul.trim()) updates.soul = soul.trim();
  if (model.trim()) updates.model = model.trim();
  if (bot_key.trim()) updates.bot_key = bot_key.trim();
  if (openrouter_api_key.trim() !== '') updates.openrouter_api_key = openrouter_api_key.trim() || null;
  if (respondToAnyRaw.trim()) updates.respond_to_any = respondToAnyRaw.toLowerCase().startsWith('y');
  if (rateLimitRaw.trim()) updates.rate_limit_hourly = parseInt(rateLimitRaw) || 20;

  try {
    const updated = updateBot(bot.id, updates);
    console.log('\n✓ Bot updated successfully!');
    console.log(`  Shortcode: @${updated?.shortcode}`);
    console.log(`  Name: ${updated?.name}`);
  } catch (error) {
    console.error('\n✗ Error updating bot:', (error as Error).message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
