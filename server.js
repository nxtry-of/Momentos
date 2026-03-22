const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'momento-secret-change-in-production';

// Detectar si usamos PostgreSQL (Render) o SQLite (local)
const DATABASE_URL = process.env.DATABASE_URL;
const USE_POSTGRES = !!DATABASE_URL;

let pg = null;
let pool = null;
let initSqlJs = null;
let sqliteDb = null;

// Inicializar base de datos
async function initDatabase() {
  if (USE_POSTGRES) {
    console.log('🔧 Conectando a PostgreSQL...');
    pg = require('pg');
    pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT,
          password TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          image TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_permanent INTEGER DEFAULT 0
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS saves (
          id TEXT PRIMARY KEY,
          post_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(post_id, user_id)
        )
      `);
      console.log('✅ PostgreSQL conectado y tablas creadas');
    } catch (error) {
      console.error('❌ Error conectando a PostgreSQL:', error.message);
      throw error;
    }
  } else {
    console.log('🔧 Inicializando SQLite...');
    initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const DB_PATH = './momento.db';
    
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        sqliteDb = new SQL.Database(fileBuffer);
        console.log('📁 SQLite cargado');
      } else {
        sqliteDb = new SQL.Database();
        createTablesSqlite();
        saveDatabase();
        console.log('🔧 SQLite creado');
      }
    } catch (error) {
      console.error('Error con SQLite:', error);
      sqliteDb = new SQL.Database();
      createTablesSqlite();
      saveDatabase();
    }
    
    // Auto-guardar cada 30 segundos
    setInterval(saveDatabase, 30000);
  }
}

function createTablesSqlite() {
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT, password TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL, image TEXT, created_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL, is_permanent INTEGER DEFAULT 0)`);
  sqliteDb.run(`CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, post_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(post_id, user_id))`);
}

function saveDatabase() {
  if (sqliteDb && !USE_POSTGRES) {
    const data = sqliteDb.export();
    fs.writeFileSync('./momento.db', Buffer.from(data));
  }
}

// Helpers para queries
async function queryOne(sql, params = []) {
  if (USE_POSTGRES) {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }
}

async function queryAll(sql, params = []) {
  if (USE_POSTGRES) {
    const result = await pool.query(sql, params);
    return result.rows;
  } else {
    const stmt = sqliteDb.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }
}

async function runQuery(sql, params = []) {
  if (USE_POSTGRES) {
    await pool.query(sql, params);
  } else {
    sqliteDb.run(sql, params);
    saveDatabase();
  }
}

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Rate limiting
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Solo puedes publicar una vez cada hora' }
});

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// ==================== AUTH ====================

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username y password requeridos' });
    
    const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) return res.status(400).json({ error: 'El usuario ya existe' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    await runQuery('INSERT INTO users (id, username, email, password, created_at) VALUES ($1, $2, $3, $4, NOW())', [id, username, email || null, hashedPassword]);
    
    const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, username } });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE username = $1', [username]);
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== POSTS ====================

app.get('/api/posts', authenticateToken, async (req, res) => {
  try {
    const posts = await queryAll(`
      SELECT p.id, p.content, p.image, p.created_at, p.expires_at, p.is_permanent, p.user_id, u.username,
        (SELECT COUNT(*) FROM saves WHERE post_id = p.id) as save_count,
        (SELECT COUNT(*) FROM saves WHERE post_id = p.id AND user_id = $1) as saved_by_current
      FROM posts p JOIN users u ON p.user_id = u.id
      WHERE p.is_permanent = 1 OR p.expires_at > NOW()
      ORDER BY p.is_permanent DESC, p.created_at DESC LIMIT 50
    `, [req.user.id]);
    res.json(posts);
  } catch (error) {
    console.error('Error obteniendo posts:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/posts', authenticateToken, postLimiter, upload.single('image'), async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    
    const lastPost = await queryOne(`SELECT created_at FROM posts WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour' ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
    
    if (lastPost) {
      const createdAt = new Date(lastPost.created_at);
      const nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
      const minutesLeft = Math.ceil((nextPostTime - Date.now()) / 60000);
      return res.status(429).json({ error: 'Solo puedes publicar una vez cada hora', nextPostIn: `${minutesLeft} minutos` });
    }
    
    const id = uuidv4();
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    await runQuery(`INSERT INTO posts (id, user_id, content, image, created_at, expires_at) VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '24 hours')`, [id, req.user.id, content.trim(), image]);
    
    const post = await queryOne(`SELECT p.id, p.content, p.image, p.created_at, p.expires_at, p.is_permanent, p.user_id, u.username, 0 as save_count, 0 as saved_by_current FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = $1`, [id]);
    res.json(post);
  } catch (error) {
    console.error('Error creando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== SAVES ====================

app.post('/api/posts/:id/save', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const post = await queryOne('SELECT * FROM posts WHERE id = $1', [id]);
    if (!post) return res.status(404).json({ error: 'Post no encontrado' });
    
    const existing = await queryOne('SELECT * FROM saves WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
    if (existing) return res.status(400).json({ error: 'Ya salvaste este post' });
    
    await runQuery('INSERT INTO saves (id, post_id, user_id, created_at) VALUES ($1, $2, $3, NOW())', [uuidv4(), id, req.user.id]);
    
    const saveCount = (await queryOne('SELECT COUNT(*) as count FROM saves WHERE post_id = $1', [id])).count;
    
    if (saveCount >= 10 && !post.is_permanent) {
      await runQuery('UPDATE posts SET is_permanent = 1 WHERE id = $1', [id]);
    }
    
    res.json({ success: true, saveCount, isPermanent: saveCount >= 10 });
  } catch (error) {
    console.error('Error salvando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.delete('/api/posts/:id/save', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await runQuery('DELETE FROM saves WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
    
    const saveCount = (await queryOne('SELECT COUNT(*) as count FROM saves WHERE post_id = $1', [id])).count;
    if (saveCount < 10) await runQuery('UPDATE posts SET is_permanent = 0 WHERE id = $1', [id]);
    
    res.json({ success: true, saveCount });
  } catch (error) {
    console.error('Error removiendo save:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== USER INFO ====================

app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, username, email, created_at FROM users WHERE id = $1', [req.user.id]);
    const lastPost = await queryOne(`SELECT created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id]);
    
    let nextPostTime = null;
    if (lastPost) {
      const createdAt = new Date(lastPost.created_at);
      nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
    }
    
    res.json({ user, nextPostTime, canPostNow: !nextPostTime || Date.now() >= nextPostTime.getTime() });
  } catch (error) {
    console.error('Error obteniendo user info:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== CLEANUP ====================

app.post('/api/cleanup', async (req, res) => {
  try {
    const result = await runQuery(`DELETE FROM posts WHERE expires_at < NOW() AND is_permanent = 0`);
    await runQuery(`DELETE FROM saves WHERE post_id NOT IN (SELECT id FROM posts)`);
    res.json({ deleted: result?.rowCount || 0 });
  } catch (error) {
    console.error('Error en cleanup:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== INICIAR ====================

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🌙 Momento corriendo en http://localhost:${PORT}`);
    console.log(`📱 Publica 1 vez cada hora`);
    console.log(`⏳ Los posts duran 24h (salvo que la comunidad los salve)`);
    console.log(`💾 Base de datos: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
  });
}).catch(err => {
  console.error('❌ Error inicializando:', err);
  process.exit(1);
});
