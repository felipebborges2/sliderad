const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { autenticar } = require('./auth');
const { extractFileContent } = require('../services/extractor');
const { gerarPerfilEstilo } = require('../services/claudePerfil');
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

// GET /api/perfil — retorna o perfil atual
router.get('/', autenticar, (req, res) => {
  const perfil = db.get('perfil').find({ usuarioId: req.usuario.id }).value() || null;
  res.json({ perfil });
});

// POST /api/perfil/adicionar — adiciona apresentações e regenera o perfil
router.post('/adicionar', autenticar, upload.array('apresentacoes', 20), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  try {
    if (arquivosUpload.length === 0) {
      return res.status(400).json({ erro: 'Envie ao menos uma apresentação' });
    }

    // Extrair conteúdo das novas apresentações
    console.log(`Extraindo conteúdo de ${arquivosUpload.length} apresentação(ões)...`);
    const novasExtraidas = await Promise.all(
      arquivosUpload.map(async f => ({
        nome: f.originalname,
        conteudo: (await extractFileContent(f.path)).content || '',
        adicionadoEm: new Date().toISOString(),
      }))
    );

    // Mesclar com apresentações já salvas
    const perfilAtual = db.get('perfil').find({ usuarioId: req.usuario.id }).value();
    const apresentacoesAnteriores = perfilAtual?.apresentacoes || [];
    const todasApresentacoes = [...apresentacoesAnteriores, ...novasExtraidas]
      .filter(a => a.conteudo && a.conteudo.trim());

    if (todasApresentacoes.length === 0) {
      return res.status(400).json({ erro: 'Não foi possível extrair conteúdo dos arquivos enviados' });
    }

    // Gerar novo perfil com Claude
    console.log(`Gerando perfil de estilo com ${todasApresentacoes.length} apresentação(ões)...`);
    const descricao = await gerarPerfilEstilo(todasApresentacoes);

    // Salvar no banco
    const agora = new Date().toISOString();
    if (perfilAtual) {
      db.get('perfil').find({ usuarioId: req.usuario.id }).assign({
        descricao,
        apresentacoes: todasApresentacoes,
        atualizadoEm: agora,
      }).write();
    } else {
      db.get('perfil').push({
        usuarioId: req.usuario.id,
        descricao,
        apresentacoes: todasApresentacoes,
        criadoEm: agora,
        atualizadoEm: agora,
      }).write();
    }

    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    res.json({
      descricao,
      numApresentacoes: todasApresentacoes.length,
      atualizadoEm: agora,
    });
  } catch (err) {
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    console.error('Erro ao atualizar perfil:', err);
    const raw = err.message || '';
    let mensagem = raw;
    try {
      const parsed = JSON.parse(raw);
      mensagem = parsed.error?.message || parsed.message || raw;
    } catch {}
    if (raw.includes('credit balance') || raw.includes('billing')) {
      mensagem = 'Créditos da API insuficientes. Acesse console.anthropic.com para recarregar.';
    }
    res.status(500).json({ erro: mensagem });
  }
});

// PUT /api/perfil/descricao — edição manual da descrição
router.put('/descricao', autenticar, express.json(), async (req, res) => {
  try {
    const { descricao } = req.body;
    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ erro: 'Descrição não pode ser vazia' });
    }

    const perfilAtual = db.get('perfil').find({ usuarioId: req.usuario.id }).value();
    const agora = new Date().toISOString();

    if (perfilAtual) {
      db.get('perfil').find({ usuarioId: req.usuario.id }).assign({
        descricao: descricao.trim(),
        atualizadoEm: agora,
      }).write();
    } else {
      db.get('perfil').push({
        usuarioId: req.usuario.id,
        descricao: descricao.trim(),
        apresentacoes: [],
        criadoEm: agora,
        atualizadoEm: agora,
      }).write();
    }

    res.json({ descricao: descricao.trim(), atualizadoEm: agora });
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro ao salvar descrição' });
  }
});

// DELETE /api/perfil — apaga o perfil
router.delete('/', autenticar, (req, res) => {
  db.get('perfil').remove({ usuarioId: req.usuario.id }).write();
  res.json({ ok: true });
});

module.exports = router;
