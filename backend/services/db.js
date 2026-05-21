const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const adapter = new FileSync(path.join(dbDir, 'db.json'));
const db = low(adapter);

// Estrutura inicial do banco
db.defaults({
  usuarios: [],
  apresentacoes: [],
  roteiros: [],
  perfil: [],
  biblioteca: []
}).write();

module.exports = db;
