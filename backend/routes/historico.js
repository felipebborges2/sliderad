const express = require('express');
const { autenticar } = require('./auth');
const db = require('../services/db');

const router = express.Router();

// GET /api/historico
router.get('/', autenticar, async (req, res) => {
  const incluirPerfil = req.query.incluirPerfil === 'true';
  const filter = { usuarioId: req.usuario.id };
  if (!incluirPerfil) filter.fonte = { $ne: 'perfil' };

  const apresentacoes = await db.find('apresentacoes', filter, { criadoEm: -1 });
  res.json(apresentacoes);
});

// DELETE /api/historico/:id
router.delete('/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  const existe = await db.findOne('apresentacoes', { id, usuarioId: req.usuario.id });
  if (!existe) return res.status(404).json({ erro: 'Não encontrado' });

  await db.deleteOne('apresentacoes', { id, usuarioId: req.usuario.id });
  res.json({ ok: true });
});

module.exports = router;
