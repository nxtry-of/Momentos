const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'momento.db');

async function cleanup() {
  console.log('🧹 Limpiando posts expirados...');
  
  const SQL = await initSqlJs();
  
  // Cargar DB
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);
  
  // Eliminar posts expirados
  const result = db.run(`
    DELETE FROM posts 
    WHERE expires_at < datetime('now') AND is_permanent = 0
  `);
  
  // Limpiar saves huérfanas
  const orphanSaves = db.run(`
    DELETE FROM saves 
    WHERE post_id NOT IN (SELECT id FROM posts)
  `);
  
  // Guardar cambios
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log(`✅ Eliminados ${result.changes} posts expirados`);
  console.log(`✅ Eliminadas ${orphanSaves.changes} saves huérfanas`);
  
  db.close();
}

cleanup().catch(console.error);
