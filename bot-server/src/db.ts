import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { Bot, CreateBotInput, UpdateBotInput } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'bots.db');

let db: SqlJsDatabase;

async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export async function initDb(): Promise<void> {
  const database = await getDb();
  
  database.run(`
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shortcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      soul TEXT NOT NULL,
      model TEXT NOT NULL,
      bot_key TEXT NOT NULL,
      openrouter_api_key TEXT,
      respond_to_any INTEGER DEFAULT 0,
      rate_limit_hourly INTEGER DEFAULT 20,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )
  `);
  
  database.run(`CREATE INDEX IF NOT EXISTS idx_bots_shortcode ON bots(shortcode)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_bots_deleted_at ON bots(deleted_at)`);
  
  saveDb();
  console.log('Database initialized');
}

export function getBotByShortcode(shortcode: string): Bot | undefined {
  if (!db) return undefined;
  
  const stmt = db.prepare('SELECT * FROM bots WHERE shortcode = ? AND deleted_at IS NULL');
  stmt.bind([shortcode]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as Bot;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function getBotById(id: number): Bot | undefined {
  if (!db) return undefined;
  
  const stmt = db.prepare('SELECT * FROM bots WHERE id = ? AND deleted_at IS NULL');
  stmt.bind([id]);
  
  if (stmt.step()) {
    const row = stmt.getAsObject() as Bot;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function getAllBots(): Bot[] {
  if (!db) return [];
  
  const results: Bot[] = [];
  const stmt = db.prepare('SELECT * FROM bots WHERE deleted_at IS NULL ORDER BY created_at DESC');
  
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Bot);
  }
  stmt.free();
  return results;
}

export function createBot(input: CreateBotInput): Bot {
  if (!db) throw new Error('Database not initialized');
  
  db.run(`
    INSERT INTO bots (shortcode, name, soul, model, bot_key, openrouter_api_key, respond_to_any, rate_limit_hourly)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    input.shortcode,
    input.name,
    input.soul,
    input.model,
    input.bot_key,
    input.openrouter_api_key || null,
    input.respond_to_any ? 1 : 0,
    input.rate_limit_hourly || 20,
  ]);
  
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
  saveDb();
  
  return getBotById(lastId)!;
}

export function updateBot(id: number, input: UpdateBotInput): Bot | undefined {
  if (!db) return undefined;
  
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) { updates.push('name = ?'); values.push(input.name); }
  if (input.soul !== undefined) { updates.push('soul = ?'); values.push(input.soul); }
  if (input.model !== undefined) { updates.push('model = ?'); values.push(input.model); }
  if (input.bot_key !== undefined) { updates.push('bot_key = ?'); values.push(input.bot_key); }
  if (input.openrouter_api_key !== undefined) { updates.push('openrouter_api_key = ?'); values.push(input.openrouter_api_key); }
  if (input.respond_to_any !== undefined) { updates.push('respond_to_any = ?'); values.push(input.respond_to_any ? 1 : 0); }
  if (input.rate_limit_hourly !== undefined) { updates.push('rate_limit_hourly = ?'); values.push(input.rate_limit_hourly); }

  if (updates.length === 0) return getBotById(id);

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.run(`UPDATE bots SET ${updates.join(', ')} WHERE id = ?`, values);
  saveDb();

  return getBotById(id);
}

export function deleteBot(id: number): boolean {
  if (!db) return false;
  
  db.run('UPDATE bots SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  saveDb();
  return true;
}

export function canSendMessage(botId: number): boolean {
  return true;
}
