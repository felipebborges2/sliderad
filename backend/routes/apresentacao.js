const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { autenticar } = require('./auth');
const { extractFileContent } = require('../services/extractor');
const { gerarConteudoApresentacao, sugerirEstrutura } = require('../services/claude');
const { gerarPPTX } = require('../services/pptx');
const db = require('../services/db');

const router = express.Router();

function extrairMensagemErro(err) {
  const raw = err.message || '';
  try {
    const parsed = JSON.parse(raw);
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {}
  if (raw.includes('credit balance') || raw.includes('billing')) {
    return 'Créditos da API insuficientes. Acesse console.anthropic.com para recarregar.';
  }
  if (raw.toLowerCase().includes('overload')) {
    return 'A API está sobrecarregada no momento. Tente novamente em alguns segundos.';
  }
  return raw || 'Erro ao processar a solicitação.';
}

// Config multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB por arquivo
  fileFilter: (req, file, cb) => {
    const permitidos = ['.pdf', '.pptx', '.ppt', '.docx', '.doc', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (permitidos.includes(ext)) cb(null, true);
    else cb(new Error(`Formato não suportado: ${ext}`));
  }
});

// POST /api/apresentacao/estrutura — two-step: suggest titles only
router.post('/estrutura', autenticar, upload.array('arquivos', 10), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  try {
    const { tema } = req.body;
    if (!tema || !tema.trim()) {
      return res.status(400).json({ erro: 'Tema é obrigatório' });
    }

    // Extrair conteúdo dos arquivos
    let arquivosExtraidos = [];
    if (arquivosUpload.length > 0) {
      console.log(`Extraindo conteúdo de ${arquivosUpload.length} arquivo(s)...`);
      arquivosExtraidos = await Promise.all(
        arquivosUpload.map(f => extractFileContent(f.path))
      );
    }

    // Sugerir estrutura (apenas títulos)
    console.log(`Sugerindo estrutura para: "${tema}"...`);
    const titulos = await sugerirEstrutura({
      tema: tema.trim(),
      arquivos: arquivosExtraidos,
      usuarioId: req.usuario.id
    });

    // Limpar uploads
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    res.json({ titulos });

  } catch (err) {
    console.error('Erro ao sugerir estrutura:', err);
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

// POST /api/apresentacao/gerar
router.post('/gerar', autenticar, upload.array('arquivos', 10), async (req, res) => {
  const arquivosUpload = req.files || [];
  const arquivosPaths = arquivosUpload.map(f => f.path);

  try {
    const { tema } = req.body;
    if (!tema || !tema.trim()) {
      return res.status(400).json({ erro: 'Tema é obrigatório' });
    }

    // Parse optional titulos from body
    let titulos = req.body.titulos;
    if (typeof titulos === 'string') titulos = JSON.parse(titulos);

    // Extract optional biblioteca context and IDs
    const bibliotecaContexto = req.body.bibliotecaContexto || '';
    let bibliotecaIds = req.body.bibliotecaIds;
    if (typeof bibliotecaIds === 'string') { try { bibliotecaIds = JSON.parse(bibliotecaIds); } catch { bibliotecaIds = []; } }
    if (!Array.isArray(bibliotecaIds)) bibliotecaIds = [];

    // 1. Extrair conteúdo dos arquivos
    let arquivosExtraidos = [];
    if (arquivosUpload.length > 0) {
      console.log(`Extraindo conteúdo de ${arquivosUpload.length} arquivo(s)...`);
      arquivosExtraidos = await Promise.all(
        arquivosUpload.map(f => extractFileContent(f.path))
      );
    }

    // Prepend biblioteca context to extracted files if provided
    if (bibliotecaContexto && bibliotecaContexto.trim()) {
      arquivosExtraidos = [
        { filename: 'Biblioteca de referências', type: 'txt', content: bibliotecaContexto },
        ...arquivosExtraidos
      ];
    }

    // 2. Gerar conteúdo com Claude
    console.log(`Gerando conteúdo para: "${tema}"...`);
    const conteudo = await gerarConteudoApresentacao({
      tema: tema.trim(),
      arquivos: arquivosExtraidos,
      usuarioId: req.usuario.id,
      titulos: titulos && titulos.length > 0 ? titulos : undefined
    });

    // 3. Salvar no histórico (slides incluídos para download futuro sem depender do disco)
    const id = uuidv4();
    const registro = {
      id,
      usuarioId: req.usuario.id,
      tema: tema.trim(),
      titulo: conteudo.titulo || tema.trim(),
      slides: conteudo.slides || [],
      numSlides: conteudo.slides ? conteudo.slides.length : 0,
      numArquivos: arquivosUpload.length,
      arquivos: arquivosUpload.map(f => ({ nome: f.originalname, tipo: path.extname(f.originalname) })),
      bibliotecaIds,
      criadoEm: new Date().toISOString(),
    };
    await db.insertOne('apresentacoes', registro);

    // 4. Limpar uploads e responder com JSON para preview
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });

    res.json({
      id,
      titulo: conteudo.titulo || tema.trim(),
      numSlides: registro.numSlides,
      slides: conteudo.slides || []
    });

  } catch (err) {
    console.error('=== ERRO AO GERAR APRESENTAÇÃO ===');
    console.error('Mensagem:', err.message);
    console.error('Status:', err.status);
    console.error('Stack:', err.stack);
    // Limpar uploads em caso de erro
    arquivosPaths.forEach(p => { try { fs.unlinkSync(p); } catch {} });
    const mensagem = extrairMensagemErro(err);
    console.error('Mensagem enviada ao client:', mensagem);
    res.status(500).json({ erro: mensagem || 'Erro ao gerar apresentação.' });
  }
});

// POST /api/apresentacao/exportar — re-generate PPTX from edited slides
router.post('/exportar', autenticar, async (req, res) => {
  try {
    const { slides, titulo, id } = req.body;
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ erro: 'slides é obrigatório' });
    }

    // Persistir slides editados no MongoDB para que /download/:id sempre retorne a versão mais recente
    if (id) {
      await db.updateOne('apresentacoes', { id, usuarioId: req.usuario.id }, { slides, titulo: titulo || undefined });
    }

    const conteudo = { slides, titulo: titulo || 'Apresentação' };

    const outputDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tmpPath = path.join(outputDir, `${uuidv4()}.pptx`);
    await gerarPPTX({ conteudo, outputPath: tmpPath });

    const nomeArquivo = `${titulo || 'apresentacao'}.pptx`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

    const stream = fs.createReadStream(tmpPath);
    stream.pipe(res);
    stream.on('end', () => {
      try { fs.unlinkSync(tmpPath); } catch {}
    });
    stream.on('error', () => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (!res.headersSent) res.status(500).json({ erro: 'Erro ao enviar arquivo' });
    });

  } catch (err) {
    console.error('Erro ao exportar apresentação:', err);
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

// GET /api/apresentacao/download/:id — regera PPTX on-the-fly a partir dos slides no MongoDB
router.get('/download/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await db.findOne('apresentacoes', { id, usuarioId: req.usuario.id });
    if (!registro) return res.status(404).json({ erro: 'Apresentação não encontrada' });
    if (!registro.slides || registro.slides.length === 0)
      return res.status(404).json({ erro: 'Slides não disponíveis para download' });

    const outputDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const tmpPath = path.join(outputDir, `${uuidv4()}.pptx`);
    await gerarPPTX({ conteudo: { slides: registro.slides, titulo: registro.titulo }, outputPath: tmpPath });

    const nomeArquivo = `${registro.titulo || registro.tema || 'apresentacao'}.pptx`;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomeArquivo)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

    const stream = fs.createReadStream(tmpPath);
    stream.pipe(res);
    stream.on('end', () => { try { fs.unlinkSync(tmpPath); } catch {} });
    stream.on('error', () => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (!res.headersSent) res.status(500).json({ erro: 'Erro ao enviar arquivo' });
    });
  } catch (err) {
    console.error('Erro ao fazer download:', err);
    res.status(500).json({ erro: extrairMensagemErro(err) });
  }
});

module.exports = router;
