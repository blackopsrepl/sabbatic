import { createInterface } from 'readline';
import { getAllBots, deleteBot, initDb } from '../src/db.js';

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
  const bots = getAllBots();

  if (bots.length === 0) {
    console.log('No bots found');
    rl.close();
    process.exit(0);
  }

  console.log('\n=== Delete Bot ===\n');
  console.log('Available bots:\n');
  bots.forEach((bot, i) => {
    console.log(`  ${i + 1}. @${bot.shortcode} (${bot.name}) - ${bot.model}`);
  });

  const selection = await ask('\nSelect bot number to delete: ');
  const index = parseInt(selection) - 1;

  if (isNaN(index) || index < 0 || index >= bots.length) {
    console.log('Invalid selection');
    process.exit(1);
  }

  const bot = bots[index];
  const confirm = await ask(`Are you sure you want to delete @${bot.shortcode}? (y/N): `);

  if (!confirm.toLowerCase().startsWith('y')) {
    console.log('Cancelled');
    rl.close();
    process.exit(0);
  }

  try {
    deleteBot(bot.id);
    console.log('\n✓ Bot deleted successfully!');
  } catch (error) {
    console.error('\n✗ Error deleting bot:', (error as Error).message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
