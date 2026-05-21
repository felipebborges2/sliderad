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
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) cb(null, true);
    else cb(new Error(`Formato não suportado: ${ext}`));
  }
});

// GET /api/biblioteca — list items for user (optionally with content)
router.get('/', autenticar, (req, res) => {
  const comConteudo = req.query.comConteudo === 'true';
  const itens = db.get('biblioteca').filter({ usuarioId: req.usuario.id }).value();

  const resultado = itens.map(item => {
    const base = {
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      tamanho: item.tamanho,
      adicionadoEm: item.adicionadoEm
    };
    if (comConteudo) base.conteudo = item.conteudo;
    return base;
  });

  res.json({ itens: resultado });
});

// GET /api/biblioteca/:id/conteudo — get full content of one item
router.get('/:id/conteudo', autenticar, (req, res) => {
  const item = db.get('biblioteca').find({ id: req.params.id, usuarioId: req.usuario.id }).value();
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  res.json({ conteudo: item.conteudo });
});

// POST /api/biblioteca/adicionar — upload and save files
router.post('/adicionar', autenticar, upload.array('arquivos', 20), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  if (arquivosUpload.length === 0) {
    return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
  }

  try {
    const extraidos = await Promise.all(arquivosUpload.map(f => extractFileContent(f.path)));

    const itensSalvos = extraidos.map((ext, i) => {
      const f = arquivosUpload[i];
      const item = {
        id: uuidv4(),
        usuarioId: req.usuario.id,
        nome: f.originalname,
        tipo: path.extname(f.originalname).replace('.', '').toLowerCase(),
        conteudo: ext.content || '',
        tamanho: f.size,
        adicionadoEm: new Date().toISOString()
      };
      db.get('biblioteca').push(item).write();
      return item;
    });

    // Limpar uploads temporários
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    // Return items without conteudo
    const resposta = itensSalvos.map(({ id, nome, tipo, tamanho, adicionadoEm }) => ({
      id, nome, tipo, tamanho, adicionadoEm
    }));

    res.json({ itens: resposta });
  } catch (err) {
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    console.error('Erro ao adicionar à biblioteca:', err);
    res.status(500).json({ erro: err.message || 'Erro ao processar arquivos' });
  }
});

// DELETE /api/biblioteca/:id
router.delete('/:id', autenticar, (req, res) => {
  const item = db.get('biblioteca').find({ id: req.params.id, usuarioId: req.usuario.id }).value();
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

  db.get('biblioteca').remove({ id: req.params.id, usuarioId: req.usuario.id }).write();
  res.json({ ok: true });
});

module.exports = router;
