const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { autenticar } = require('./auth');
const { extractFileContent } = require('../services/extractor');
const { gerarRoteiro, regenerarSlide } = require('../services/claudeRoteiro');
const db = require('../services/db');

const router = express.Router();

function extrairMensagemErro(err) {
  const raw = err.message || '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {}
  if (raw.includes('credit balance') || raw.includes('billing'))
    return 'Créditos da API insuficientes. Acesse console.anthropic.com para recarregar.';
  if (raw.toLowerCase().includes('overload'))
    return 'A API está sobrecarregada. Tente novamente em alguns segundos.';
  return raw || 'Erro ao processar a solicitação.';
}

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

// GET /api/roteiro/lista
router.get('/lista', autenticar, async (req, res) => {
  const roteiros = (await db.find('roteiros', { usuarioId: req.usuario.id }, { criadoEm: -1 }))
    .map(r => ({
      id: r.id,
      titulo: Array.isArray(r.titulos) && r.titulos.length > 0 ? r.titulos[0] : 'Roteiro',
      numSlides: Array.isArray(r.slides) ? r.slides.length : 0,
      bibliotecaIds: r.bibliotecaIds || [],
      criadoEm: r.criadoEm,
    }));
  res.json({ roteiros });
});

// POST /api/roteiro/gerar
router.post('/gerar', autenticar, upload.array('arquivos', 10), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  try {
    let titulos = req.body.titulos;
    if (!titulos) return res.status(400).json({ erro: 'Títulos são obrigatórios' });
    if (typeof titulos === 'string') titulos = JSON.parse(titulos);
    if (!Array.isArray(titulos) || titulos.length === 0) return res.status(400).json({ erro: 'Informe ao menos um título' });

    let bibliotecaIds = req.body.bibliotecaIds;
    if (typeof bibliotecaIds === 'string') { try { bibliotecaIds = JSON.parse(bibliotecaIds); } catch { bibliotecaIds = []; } }
    if (!Array.isArray(bibliotecaIds)) bibliotecaIds = [];

    let arquivosExtraidos = [];
    if (arquivosUpload.length > 0)
      arquivosExtraidos = await Promise.all(arquivosUpload.map(f => extractFileContent(f.path)));

    const LIMITE_ARQ = 60000;
    const trimCtx = t => t && t.length > LIMITE_ARQ ? t.slice(0, LIMITE_ARQ) + '\n[...]' : t;

    let contextoArquivos = arquivosExtraidos
      .filter(a => a.content && a.content.trim())
      .map(a => `=== ${a.filename} ===\n${trimCtx(a.content)}`)
      .join('\n\n');

    const bibliotecaContexto = req.body.bibliotecaContexto || '';
    if (bibliotecaContexto.trim())
      contextoArquivos = `=== BIBLIOTECA DE REFERÊNCIAS ===\n${trimCtx(bibliotecaContexto)}\n\n${contextoArquivos}`;

    const resultado = await gerarRoteiro({ titulos, contextoArquivos, usuarioId: req.usuario.id });

    const id = uuidv4();
    await db.insertOne('roteiros', {
      id,
      usuarioId: req.usuario.id,
      titulos,
      slides: resultado.slides,
      contextoArquivos,
      bibliotecaIds,
      criadoEm: new Date().toISOString(),
    });

    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    res.json({ id, slides: resultado.slides });
  } catch (err) {
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    console.error('Erro ao gerar roteiro:', err);
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

// POST /api/roteiro/regenerar
router.post('/regenerar', autenticar, async (req, res) => {
  try {
    const { roteiroId, titulo, indice } = req.body;
    if (!roteiroId || titulo == null || indice == null)
      return res.status(400).json({ erro: 'roteiroId, titulo e indice são obrigatórios' });

    const roteiro = await db.findOne('roteiros', { id: roteiroId, usuarioId: req.usuario.id });
    if (!roteiro) return res.status(404).json({ erro: 'Roteiro não encontrado' });

    const slide = await regenerarSlide({
      titulo,
      todosTitulos: roteiro.titulos,
      indice: Number(indice),
      contextoArquivos: roteiro.contextoArquivos,
      usuarioId: req.usuario.id,
    });

    const slidesAtualizados = [...roteiro.slides];
    slidesAtualizados[Number(indice)] = slide;
    await db.updateOne('roteiros', { id: roteiroId }, { slides: slidesAtualizados });

    res.json({ slide });
  } catch (err) {
    console.error('Erro ao regenerar slide:', err);
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

module.exports = router;
