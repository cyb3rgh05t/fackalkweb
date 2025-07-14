#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceDb = path.join(__dirname, '..', 'data', 'lackiererei.db');
const backupDir = path.join(__dirname, '..', 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `lackiererei_${timestamp}.db`);

if (fs.existsSync(sourceDb)) {
  fs.copyFileSync(sourceDb, backupPath);
  console.log(`✅ Backup erstellt: ${backupPath}`);
} else {
  console.error('❌ Datenbank nicht gefunden');
}
