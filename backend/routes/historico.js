const express = require('express');
const { autenticar } = require('./auth');
const db = require('../services/db');

const router = express.Router();

// GET /api/historico
router.get('/', autenticar, (req, res) => {
  const apresentacoes = db.get('apresentacoes')
    .filter({ usuarioId: req.usuario.id })
    .orderBy('criadoEm', 'desc')
    .value();
  res.json(apresentacoes);
});

// DELETE /api/historico/:id
router.delete('/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const existe = db.get('apresentacoes').find({ id, usuarioId: req.usuario.id }).value();
  if (!existe) return res.status(404).json({ erro: 'Não encontrado' });

  db.get('apresentacoes').remove({ id, usuarioId: req.usuario.id }).write();
  res.json({ ok: true });
});

module.exports = router;
