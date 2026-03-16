const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const migrationDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationDir)) return;
  
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));
  
  for (const file of files) {
    try {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await pool.query(sql);
      console.log(`[Migration] ✓ ${file}`);
    } catch (e) {
      // Ignore "already exists" errors
      if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
        console.error(`[Migration] ${file} error:`, e.message);
      }
    }
  }
}

module.exports = runMigrations;
