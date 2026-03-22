const express = require('express');
const initSqlJs = require('sql.js');
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
const DB_PATH = './momento.db';

let db = null;

// Inicializar SQLite
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Cargar DB existente o crear nueva
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('📁 Base de datos cargada');
    } else {
      db = new SQL.Database();
      console.log('🔧 Creando base de datos...');
      createTables();
      saveDatabase();
    }
  } catch (error) {
    console.error('Error cargando DB:', error);
    db = new SQL.Database();
    createTables();
    saveDatabase();
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
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
  
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expires_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_posts_permanent ON posts(is_permanent)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_saves_post ON saves(post_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id)`);
  
  console.log('✅ Tablas creadas');
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-guardar cada 30 segundos
setInterval(() => {
  saveDatabase();
}, 30000);

// Configurar multer para uploads
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

// Rate limiting para posts: 1 por hora por usuario
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Solo puedes publicar una vez cada hora' }
});

// Middleware de autenticación
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

// Helpers para queries
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

// ==================== AUTH ====================

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username y password requeridos' });
    }
    
    const existing = queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuidv4();
    
    runQuery(
      `INSERT INTO users (id, username, email, password, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, username, email || null, hashedPassword]
    );
    
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
    
    const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== POSTS ====================

app.get('/api/posts', authenticateToken, (req, res) => {
  try {
    const posts = queryAll(`
      SELECT 
        p.id,
        p.content,
        p.image,
        p.created_at,
        p.expires_at,
        p.is_permanent,
        p.user_id,
        u.username,
        (SELECT COUNT(*) FROM saves WHERE post_id = p.id) as save_count,
        (SELECT COUNT(*) FROM saves WHERE post_id = p.id AND user_id = ?) as saved_by_current
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_permanent = 1 OR p.expires_at > datetime('now')
      ORDER BY p.is_permanent DESC, p.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    
    res.json(posts);
  } catch (error) {
    console.error('Error obteniendo posts:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/posts', authenticateToken, postLimiter, upload.single('image'), (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'El contenido no puede estar vacío' });
    }
    
    // Verificar si ya publicó en la última hora
    const lastPost = queryOne(`
      SELECT created_at FROM posts 
      WHERE user_id = ? AND created_at > datetime('now', '-1 hour')
      ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);
    
    if (lastPost) {
      const createdAt = new Date(lastPost.created_at + 'Z');
      const nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
      const minutesLeft = Math.ceil((nextPostTime - Date.now()) / 60000);
      
      return res.status(429).json({ 
        error: 'Solo puedes publicar una vez cada hora',
        nextPostIn: `${minutesLeft} minutos`
      });
    }
    
    const id = uuidv4();
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    runQuery(
      `INSERT INTO posts (id, user_id, content, image, created_at, expires_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+24 hours'))`,
      [id, req.user.id, content.trim(), image]
    );
    
    const post = queryOne(`
      SELECT 
        p.id,
        p.content,
        p.image,
        p.created_at,
        p.expires_at,
        p.is_permanent,
        p.user_id,
        u.username,
        0 as save_count,
        0 as saved_by_current
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);
    
    res.json(post);
  } catch (error) {
    console.error('Error creando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== SAVES ====================

app.post('/api/posts/:id/save', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    const post = queryOne('SELECT * FROM posts WHERE id = ?', [id]);
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    
    const existing = queryOne('SELECT * FROM saves WHERE post_id = ? AND user_id = ?', [id, req.user.id]);
    if (existing) {
      return res.status(400).json({ error: 'Ya salvaste este post' });
    }
    
    runQuery(
      'INSERT INTO saves (id, post_id, user_id, created_at) VALUES (?, ?, ?, datetime(\'now\'))',
      [uuidv4(), id, req.user.id]
    );
    
    const saveCount = queryOne('SELECT COUNT(*) as count FROM saves WHERE post_id = ?', [id]).count;
    
    if (saveCount >= 10 && !post.is_permanent) {
      runQuery('UPDATE posts SET is_permanent = 1 WHERE id = ?', [id]);
    }
    
    res.json({ success: true, saveCount, isPermanent: saveCount >= 10 });
  } catch (error) {
    console.error('Error salvando post:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.delete('/api/posts/:id/save', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    
    runQuery('DELETE FROM saves WHERE post_id = ? AND user_id = ?', [id, req.user.id]);
    
    const saveCount = queryOne('SELECT COUNT(*) as count FROM saves WHERE post_id = ?', [id]).count;
    
    if (saveCount < 10) {
      runQuery('UPDATE posts SET is_permanent = 0 WHERE id = ?', [id]);
    }
    
    res.json({ success: true, saveCount });
  } catch (error) {
    console.error('Error removiendo save:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== USER INFO ====================

app.get('/api/me', authenticateToken, (req, res) => {
  try {
    const user = queryOne('SELECT id, username, email, created_at FROM users WHERE id = ?', [req.user.id]);
    
    const lastPost = queryOne(`
      SELECT created_at FROM posts 
      WHERE user_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `, [req.user.id]);
    
    let nextPostTime = null;
    if (lastPost) {
      const createdAt = new Date(lastPost.created_at + 'Z');
      nextPostTime = new Date(createdAt.getTime() + 60 * 60 * 1000);
    }
    
    res.json({ 
      user,
      nextPostTime,
      canPostNow: !nextPostTime || Date.now() >= nextPostTime.getTime()
    });
  } catch (error) {
    console.error('Error obteniendo user info:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== CLEANUP ====================

app.post('/api/cleanup', (req, res) => {
  try {
    const result = db.run(`
      DELETE FROM posts 
      WHERE expires_at < datetime('now') AND is_permanent = 0
    `);
    
    db.run(`
      DELETE FROM saves 
      WHERE post_id NOT IN (SELECT id FROM posts)
    `);
    
    saveDatabase();
    
    res.json({ deleted: result.changes });
  } catch (error) {
    console.error('Error en cleanup:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== INICIAR SERVER ====================

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🌙 Momento corriendo en http://localhost:${PORT}`);
    console.log(`📱 Publica 1 vez cada hora`);
    console.log(`⏳ Los posts duran 24h (salvo que la comunidad los salve)`);
  });
});
