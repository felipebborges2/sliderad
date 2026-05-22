const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { autenticar } = require('./auth');
const { extractFileContent } = require('../services/extractor');
const { gerarPerfilEstilo, refinarPerfilEstilo } = require('../services/claudePerfil');
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

// GET /api/perfil
router.get('/', autenticar, async (req, res) => {
  const perfil = await db.findOne('perfil', { usuarioId: req.usuario.id }) || null;
  res.json({ perfil });
});

// POST /api/perfil/adicionar
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
    if (filesApresentacoes.length === 0)
      return res.status(400).json({ erro: 'Envie ao menos uma apresentação' });

    console.log(`Extraindo conteúdo de ${filesApresentacoes.length} apresentação(ões)...`);
    const novasExtraidas = await Promise.all(
      filesApresentacoes.map(async f => ({
        nome: f.originalname,
        conteudo: (await extractFileContent(f.path)).content || '',
        adicionadoEm: new Date().toISOString(),
      }))
    );

    const agora = new Date().toISOString();

    // Salvar referências na biblioteca
    let idsReferencias = [];
    if (filesReferencias.length > 0) {
      console.log(`Salvando ${filesReferencias.length} referência(s) na biblioteca...`);
      const refsExtraidas = await Promise.all(filesReferencias.map(f => extractFileContent(f.path)));
      idsReferencias = await Promise.all(refsExtraidas.map(async (ext, i) => {
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
        await db.insertOne('biblioteca', item);
        return item.id;
      }));
    }

    // Criar registros históricos para aulas com referências vinculadas
    if (idsReferencias.length > 0) {
      let links = [];
      try { links = JSON.parse(req.body.links || '[]'); } catch {}

      const refIdsPorAula = filesApresentacoes.map(() => []);
      idsReferencias.forEach((refId, refIdx) => {
        const aulaIndices = Array.isArray(links[refIdx]) ? links[refIdx] : [];
        aulaIndices.forEach(aulaIdx => {
          if (aulaIdx >= 0 && aulaIdx < filesApresentacoes.length)
            refIdsPorAula[aulaIdx].push(refId);
        });
      });

      await Promise.all(filesApresentacoes.map(async (f, i) => {
        if (refIdsPorAula[i].length === 0) return;
        const titulo = path.basename(f.originalname, path.extname(f.originalname));
        await db.insertOne('apresentacoes', {
          id: uuidv4(),
          usuarioId: req.usuario.id,
          tema: titulo, titulo,
          fonte: 'perfil',
          numSlides: 0, numArquivos: 1,
          arquivos: [{ nome: f.originalname, tipo: path.extname(f.originalname) }],
          bibliotecaIds: refIdsPorAula[i],
          criadoEm: agora,
        });
      }));
    }

    // Gerar/refinar perfil de estilo
    const perfilAtual = await db.findOne('perfil', { usuarioId: req.usuario.id });
    const novasValidas = novasExtraidas.filter(a => a.conteudo && a.conteudo.trim());

    if (novasValidas.length === 0)
      return res.status(400).json({ erro: 'Não foi possível extrair conteúdo dos arquivos enviados' });

    let descricao;
    if (perfilAtual?.descricao) {
      console.log(`Refinando perfil com ${novasValidas.length} nova(s) apresentação(ões)...`);
      descricao = await refinarPerfilEstilo(perfilAtual.descricao, novasValidas);
    } else {
      console.log(`Gerando perfil de estilo com ${novasValidas.length} apresentação(ões)...`);
      descricao = await gerarPerfilEstilo(novasValidas);
    }

    const apresentacoesAnteriores = perfilAtual?.apresentacoes || [];
    const todasApresentacoes = [...apresentacoesAnteriores, ...novasValidas];

    if (perfilAtual) {
      await db.updateOne('perfil', { usuarioId: req.usuario.id }, { descricao, apresentacoes: todasApresentacoes, atualizadoEm: agora });
    } else {
      await db.insertOne('perfil', {
        usuarioId: req.usuario.id,
        descricao, apresentacoes: todasApresentacoes,
        criadoEm: agora, atualizadoEm: agora,
      });
    }

    allPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    res.json({ descricao, numApresentacoes: todasApresentacoes.length, numReferencias: idsReferencias.length, atualizadoEm: agora });

  } catch (err) {
    allPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    console.error('Erro ao atualizar perfil:', err);
    const raw = err.message || '';
    let mensagem = raw;
    try { const parsed = JSON.parse(raw); mensagem = parsed.error?.message || parsed.message || raw; } catch {}
    if (raw.includes('credit balance') || raw.includes('billing'))
      mensagem = 'Créditos da API insuficientes. Acesse console.anthropic.com para recarregar.';
    res.status(500).json({ erro: mensagem });
  }
});

// PUT /api/perfil/descricao
router.put('/descricao', autenticar, express.json(), async (req, res) => {
  try {
    const { descricao } = req.body;
    if (!descricao || !descricao.trim()) return res.status(400).json({ erro: 'Descrição não pode ser vazia' });

    const perfilAtual = await db.findOne('perfil', { usuarioId: req.usuario.id });
    const agora = new Date().toISOString();

    if (perfilAtual) {
      await db.updateOne('perfil', { usuarioId: req.usuario.id }, { descricao: descricao.trim(), atualizadoEm: agora });
    } else {
      await db.insertOne('perfil', { usuarioId: req.usuario.id, descricao: descricao.trim(), apresentacoes: [], criadoEm: agora, atualizadoEm: agora });
    }

    res.json({ descricao: descricao.trim(), atualizadoEm: agora });
  } catch (err) {
    res.status(500).json({ erro: err.message || 'Erro ao salvar descrição' });
  }
});

// DELETE /api/perfil
router.delete('/', autenticar, async (req, res) => {
  await db.deleteOne('perfil', { usuarioId: req.usuario.id });
  res.json({ ok: true });
});

module.exports = router;
