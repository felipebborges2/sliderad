const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { autenticar } = require('./auth');
const { extractFileContent } = require('../services/extractor');
const db = require('../services/db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) cb(null, true);
    else cb(new Error(`Formato não suportado: ${ext}`));
  },
});

// GET /api/biblioteca
router.get('/', autenticar, async (req, res) => {
  const comConteudo = req.query.comConteudo === 'true';
  const comUso = req.query.comUso === 'true';
  const itens = await db.find('biblioteca', { usuarioId: req.usuario.id });

  let usageMap = {};
  if (comUso) {
    const apresentacoes = await db.find('apresentacoes', { usuarioId: req.usuario.id });
    const roteiros = await db.find('roteiros', { usuarioId: req.usuario.id });

    itens.forEach(item => {
      const usos = [];
      apresentacoes.forEach(ap => {
        if (Array.isArray(ap.bibliotecaIds) && ap.bibliotecaIds.includes(item.id)) {
          usos.push({ tipo: 'apresentacao', id: ap.id, titulo: ap.titulo || ap.tema, criadoEm: ap.criadoEm });
        }
      });
      roteiros.forEach(rot => {
        if (Array.isArray(rot.bibliotecaIds) && rot.bibliotecaIds.includes(item.id)) {
          const titulo = Array.isArray(rot.titulos) && rot.titulos.length > 0 ? rot.titulos[0] : 'Roteiro';
          usos.push({ tipo: 'roteiro', id: rot.id, titulo, criadoEm: rot.criadoEm });
        }
      });
      usos.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
      usageMap[item.id] = usos;
    });
  }

  const resultado = itens.map(item => {
    const base = { id: item.id, nome: item.nome, tipo: item.tipo, tamanho: item.tamanho, adicionadoEm: item.adicionadoEm };
    if (comConteudo) base.conteudo = item.conteudo;
    if (comUso) base.usadoEm = usageMap[item.id] || [];
    return base;
  });

  res.json({ itens: resultado });
});

// GET /api/biblioteca/:id/conteudo
router.get('/:id/conteudo', autenticar, async (req, res) => {
  const item = await db.findOne('biblioteca', { id: req.params.id, usuarioId: req.usuario.id });
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  res.json({ conteudo: item.conteudo });
});

// POST /api/biblioteca/adicionar
router.post('/adicionar', autenticar, upload.array('arquivos', 20), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  if (arquivosUpload.length === 0) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  try {
    const extraidos = await Promise.all(arquivosUpload.map(f => extractFileContent(f.path)));
    const itensSalvos = await Promise.all(extraidos.map(async (ext, i) => {
      const f = arquivosUpload[i];
      const item = {
        id: uuidv4(),
        usuarioId: req.usuario.id,
        nome: f.originalname,
        tipo: path.extname(f.originalname).replace('.', '').toLowerCase(),
        conteudo: ext.content || '',
        tamanho: f.size,
        adicionadoEm: new Date().toISOString(),
      };
      await db.insertOne('biblioteca', item);
      return item;
    }));

    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    const resposta = itensSalvos.map(({ id, nome, tipo, tamanho, adicionadoEm }) => ({ id, nome, tipo, tamanho, adicionadoEm }));
    res.json({ itens: resposta });
  } catch (err) {
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    res.status(500).json({ erro: err.message || 'Erro ao processar arquivos' });
  }
});

// POST /api/biblioteca/vincular
router.post('/vincular', autenticar, async (req, res) => {
  const { itemId, aulaId, aulaType, vincular } = req.body;
  if (!itemId || !aulaId || !aulaType || vincular == null)
    return res.status(400).json({ erro: 'itemId, aulaId, aulaType e vincular são obrigatórios' });

  const item = await db.findOne('biblioteca', { id: itemId, usuarioId: req.usuario.id });
  if (!item) return res.status(404).json({ erro: 'Item de biblioteca não encontrado' });

  const collection = aulaType === 'apresentacao' ? 'apresentacoes' : 'roteiros';
  const aula = await db.findOne(collection, { id: aulaId, usuarioId: req.usuario.id });
  if (!aula) return res.status(404).json({ erro: 'Aula não encontrada' });

  const ids = Array.isArray(aula.bibliotecaIds) ? [...aula.bibliotecaIds] : [];
  if (vincular) { if (!ids.includes(itemId)) ids.push(itemId); }
  else { const idx = ids.indexOf(itemId); if (idx > -1) ids.splice(idx, 1); }

  await db.updateOne(collection, { id: aulaId }, { bibliotecaIds: ids });
  res.json({ ok: true });
});

// DELETE /api/biblioteca/:id
router.delete('/:id', autenticar, async (req, res) => {
  const item = await db.findOne('biblioteca', { id: req.params.id, usuarioId: req.usuario.id });
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  await db.deleteOne('biblioteca', { id: req.params.id, usuarioId: req.usuario.id });
  res.json({ ok: true });
});

module.exports = router;
