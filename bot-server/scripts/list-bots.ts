import { createInterface } from 'readline';
import { getAllBots, getBotById, updateBot, initDb } from '../src/db.js';

async function main() {
  await initDb();
  const bots = getAllBots();

  if (bots.length === 0) {
    console.log('No bots found');
    process.exit(0);
  }

  console.log('\n=== List Bot ===\n');
  bots.forEach((bot, i) => {
    console.group(bot);
    console.log(`  ${i + 1}. @${bot.shortcode} (${bot.name}) - ${bot.model}`);
    console.groupEnd();
  });
}

main();
