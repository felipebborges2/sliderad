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

// POST /api/perfil/adicionar — adiciona apresentações (+ referências opcionais) e regenera o perfil
router.post('/adicionar', autenticar, upload.fields([
  { name: 'apresentacoes', maxCount: 20 },
  { name: 'referencias', maxCount: 20 },
]), async (req, res) => {
  const filesApresentacoes = req.files?.apresentacoes || [];
  const filesReferencias  = req.files?.referencias  || [];
  const allPaths = [
    ...filesApresentacoes.map(f => f.path),
    ...filesReferencias.map(f => f.path),
  ];

  try {
    if (filesApresentacoes.length === 0) {
      return res.status(400).json({ erro: 'Envie ao menos uma apresentação' });
    }

    // 1. Extrair conteúdo das apresentações (para análise de estilo)
    console.log(`Extraindo conteúdo de ${filesApresentacoes.length} apresentação(ões)...`);
    const novasExtraidas = await Promise.all(
      filesApresentacoes.map(async f => ({
        nome: f.originalname,
        conteudo: (await extractFileContent(f.path)).content || '',
        adicionadoEm: new Date().toISOString(),
      }))
    );

    const agora = new Date().toISOString();

    // 2. Salvar referências na biblioteca e obter IDs
    let idsReferencias = [];
    if (filesReferencias.length > 0) {
      console.log(`Salvando ${filesReferencias.length} referência(s) na biblioteca...`);
      const refsExtraidas = await Promise.all(
        filesReferencias.map(f => extractFileContent(f.path))
      );
      idsReferencias = refsExtraidas.map((ext, i) => {
        const f = filesReferencias[i];
        const item = {
          id: uuidv4(),
          usuarioId: req.usuario.id,
          nome: f.originalname,
          tipo: path.extname(f.originalname).replace('.', '').toLowerCase(),
          conteudo: ext.content || '',
          tamanho: f.size,
          adicionadoEm: agora,
        };
        db.get('biblioteca').push(item).write();
        return item.id;
      });
    }

    // 3. Criar registros históricos para as apresentações (fonte: 'perfil')
    //    para que os vínculos apareçam no badge da biblioteca
    if (idsReferencias.length > 0) {
      filesApresentacoes.forEach(f => {
        const titulo = path.basename(f.originalname, path.extname(f.originalname));
        db.get('apresentacoes').push({
          id: uuidv4(),
          usuarioId: req.usuario.id,
          tema: titulo,
          titulo,
          fonte: 'perfil',
          numSlides: 0,
          numArquivos: 1,
          arquivos: [{ nome: f.originalname, tipo: path.extname(f.originalname) }],
          bibliotecaIds: idsReferencias,
          criadoEm: agora,
        }).write();
      });
    }

    // 4. Mesclar com apresentações anteriores do perfil e gerar estilo
    const perfilAtual = db.get('perfil').find({ usuarioId: req.usuario.id }).value();
    const apresentacoesAnteriores = perfilAtual?.apresentacoes || [];
    const todasApresentacoes = [...apresentacoesAnteriores, ...novasExtraidas]
      .filter(a => a.conteudo && a.conteudo.trim());

    if (todasApresentacoes.length === 0) {
      return res.status(400).json({ erro: 'Não foi possível extrair conteúdo dos arquivos enviados' });
    }

    console.log(`Gerando perfil de estilo com ${todasApresentacoes.length} apresentação(ões)...`);
    const descricao = await gerarPerfilEstilo(todasApresentacoes);

    if (perfilAtual) {
      db.get('perfil').find({ usuarioId: req.usuario.id }).assign({
        descricao, apresentacoes: todasApresentacoes, atualizadoEm: agora,
      }).write();
    } else {
      db.get('perfil').push({
        usuarioId: req.usuario.id,
        descricao, apresentacoes: todasApresentacoes,
        criadoEm: agora, atualizadoEm: agora,
      }).write();
    }

    allPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    res.json({
      descricao,
      numApresentacoes: todasApresentacoes.length,
      numReferencias: idsReferencias.length,
      atualizadoEm: agora,
    });
  } catch (err) {
    allPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    console.error('Erro ao atualizar perfil:', err);
    const raw = err.message || '';
    let mensagem = raw;
    try { const parsed = JSON.parse(raw); mensagem = parsed.error?.message || parsed.message || raw; } catch {}
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
