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
  // Tenta extrair mensagem legível de erros JSON da API Anthropic
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {}
  // Detecta padrão de crédito insuficiente
  if (raw.includes('credit balance') || raw.includes('billing')) {
    return 'Créditos da API insuficientes. Acesse console.anthropic.com para recarregar.';
  }
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

// GET /api/roteiro/lista — lightweight list for link management UI
router.get('/lista', autenticar, (req, res) => {
  const roteiros = db.get('roteiros')
    .filter({ usuarioId: req.usuario.id })
    .value()
    .map(r => ({
      id: r.id,
      titulo: Array.isArray(r.titulos) && r.titulos.length > 0 ? r.titulos[0] : 'Roteiro',
      numSlides: Array.isArray(r.slides) ? r.slides.length : 0,
      bibliotecaIds: r.bibliotecaIds || [],
      criadoEm: r.criadoEm,
    }))
    .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
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

    // Extrair conteúdo dos arquivos de referência
    let arquivosExtraidos = [];
    if (arquivosUpload.length > 0) {
      arquivosExtraidos = await Promise.all(arquivosUpload.map(f => extractFileContent(f.path)));
    }

    // Limite por arquivo: 60k chars (~15k tokens) — arquivos longos de referência
    const LIMITE_ARQ = 60000;
    const trimCtx = (t) => t && t.length > LIMITE_ARQ ? t.slice(0, LIMITE_ARQ) + '\n[...]' : t;

    let contextoArquivos = arquivosExtraidos
      .filter(a => a.content && a.content.trim())
      .map(a => `=== ${a.filename} ===\n${trimCtx(a.content)}`)
      .join('\n\n');

    // Prepend biblioteca context if provided (também com limite)
    const bibliotecaContexto = req.body.bibliotecaContexto || '';
    if (bibliotecaContexto.trim()) {
      contextoArquivos = `=== BIBLIOTECA DE REFERÊNCIAS ===\n${trimCtx(bibliotecaContexto)}\n\n${contextoArquivos}`;
    }

    // Gerar conteúdo com Claude
    const resultado = await gerarRoteiro({ titulos, contextoArquivos, usuarioId: req.usuario.id });

    // Salvar no banco para permitir regeneração
    const id = uuidv4();
    db.get('roteiros').push({
      id,
      usuarioId: req.usuario.id,
      titulos,
      slides: resultado.slides,
      contextoArquivos,
      bibliotecaIds,
      criadoEm: new Date().toISOString(),
    }).write();

    // Limpar arquivos temporários
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
    if (!roteiroId || titulo == null || indice == null) {
      return res.status(400).json({ erro: 'roteiroId, titulo e indice são obrigatórios' });
    }

    const roteiro = db.get('roteiros').find({ id: roteiroId, usuarioId: req.usuario.id }).value();
    if (!roteiro) return res.status(404).json({ erro: 'Roteiro não encontrado' });

    const slide = await regenerarSlide({
      titulo,
      todosTitulos: roteiro.titulos,
      indice: Number(indice),
      contextoArquivos: roteiro.contextoArquivos,
      usuarioId: req.usuario.id,
    });

    // Atualizar slide no banco
    const slidesAtualizados = [...roteiro.slides];
    slidesAtualizados[Number(indice)] = slide;
    db.get('roteiros').find({ id: roteiroId }).assign({ slides: slidesAtualizados }).write();

    res.json({ slide });
  } catch (err) {
    console.error('Erro ao regenerar slide:', err);
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

module.exports = router;
