const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'momento.db');

async function initDatabase() {
  console.log('🔧 Inicializando base de datos...');
  
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Tabla de posts
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      image TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      is_permanent INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Tabla de saves
  db.run(`
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(post_id, user_id)
    )
  `);
  
  // Índices
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_permanent ON posts(is_permanent)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_saves_post ON saves(post_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id)`);
  
  // Guardar
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log('✅ Base de datos inicializada correctamente');
  console.log(`📁 Ubicación: ${DB_PATH}`);
  
  db.close();
}

initDatabase().catch(console.error);
