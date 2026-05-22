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

    // 3. Gerar PPTX
    const outputDir = path.join(__dirname, '..', 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const id = uuidv4();
    const outputPath = path.join(outputDir, `${id}.pptx`);
    await gerarPPTX({ conteudo, outputPath });

    // 4. Salvar no histórico
    const registro = {
      id,
      usuarioId: req.usuario.id,
      tema: tema.trim(),
      titulo: conteudo.titulo || tema.trim(),
      numSlides: conteudo.slides ? conteudo.slides.length : 0,
      numArquivos: arquivosUpload.length,
      arquivos: arquivosUpload.map(f => ({ nome: f.originalname, tipo: path.extname(f.originalname) })),
      bibliotecaIds,
      criadoEm: new Date().toISOString(),
      outputFile: `${id}.pptx`
    };
    db.get('apresentacoes').push(registro).write();

    // 5. Limpar uploads e responder com JSON para preview
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
    const { slides, titulo } = req.body;
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ erro: 'slides é obrigatório' });
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

// GET /api/apresentacao/download/:id
router.get('/download/:id', autenticar, (req, res) => {
  const { id } = req.params;
  const registro = db.get('apresentacoes').find({ id, usuarioId: req.usuario.id }).value();
  if (!registro) return res.status(404).json({ erro: 'Apresentação não encontrada' });

  const filePath = path.join(__dirname, '..', 'outputs', registro.outputFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ erro: 'Arquivo não encontrado' });

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(registro.tema)}.pptx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  fs.createReadStream(filePath).pipe(res);
});

module.exports = router;
