const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../services/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'radioterapia-secret-2025';

// Registro
router.post('/register', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios: nome, email, senha' });

    const existe = db.get('usuarios').find({ email }).value();
    if (existe) return res.status(409).json({ erro: 'Email já cadastrado' });

    const hash = await bcrypt.hash(senha, 10);
    const usuario = { id: uuidv4(), nome, email, senha: hash, criadoEm: new Date().toISOString() };
    db.get('usuarios').push(usuario).write();

    const token = jwt.sign({ id: usuario.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, usuario: { id: usuario.id, nome, email } });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha obrigatórios' });

    const usuario = db.get('usuarios').find({ email }).value();
    if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

    const token = jwt.sign({ id: usuario.id, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email } });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno: ' + err.message });
  }
});

// Middleware de autenticação (exportado para uso em outras rotas)
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ erro: 'Token necessário' });

  try {
    const payload = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

module.exports = router;
module.exports.autenticar = autenticar;
