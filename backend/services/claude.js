const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Limites de conteúdo por tipo de chamada (chars → tokens ÷ 4)
const LIMITE_ESTRUTURA   =  4000; // ~1k tokens por arquivo — só precisa entender tópicos
const LIMITE_CONTEUDO    = 40000; // ~10k tokens por arquivo — bom equilíbrio qualidade/custo

function trim(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n[...]';
}

// Retry com backoff exponencial para erros de overload da Anthropic
async function withRetry(fn, maxAttempts = 3, baseDelay = 8000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const overloaded = err.status === 529 || err.status === 503 ||
        (err.message || '').toLowerCase().includes('overload');
      if (overloaded && attempt < maxAttempts) {
        const delay = baseDelay * attempt;
        console.log(`Anthropic overloaded — aguardando ${delay}ms antes da tentativa ${attempt + 1}/${maxAttempts}...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

function buscarPerfil(usuarioId) {
  const perfil = db.get('perfil').find({ usuarioId }).value();
  return perfil?.descricao || null;
}

async function sugerirEstrutura({ tema, arquivos, usuarioId }) {
  // Monta contexto dos arquivos de referência
  const contextoArquivos = arquivos
    .filter(a => a.content && a.content.trim())
    .map(a => `=== ARQUIVO: ${a.filename} (${a.type.toUpperCase()}) ===\n${trim(a.content, LIMITE_ESTRUTURA)}`)
    .join('\n\n');

  const temArquivos = contextoArquivos.length > 0;
  const perfilEstilo = buscarPerfil(usuarioId);

  const blocoPerfilEstilo = perfilEstilo
    ? `\nPERFIL DE ESTILO DA APRESENTADORA:\n${perfilEstilo}\nUse esse perfil para guiar a estrutura e a quantidade de slides.\n`
    : '';

  const systemPrompt = `Você é um especialista em Física Médica e Radioterapia.
Sua tarefa é sugerir a estrutura de uma apresentação didática sobre um tema de radioterapia.
${blocoPerfilEstilo}
REGRAS:
1. Gere uma lista de títulos de slides (entre 15 e 25 títulos) que formem uma apresentação completa e lógica.
2. Os títulos devem ser técnicos, específicos e descritivos — não genéricos.
3. PROIBIDO usar travessão (— ou -) nos títulos. Use dois pontos (:) ou vírgula.
4. Inclua obrigatoriamente: slide de capa, agenda/sumário, slides de conteúdo, conclusão e referências.
5. Inclua slides de seção quando o tema tiver partes distintas.
6. Responda APENAS com JSON válido, sem texto adicional.

FORMATO DE RESPOSTA:
{ "titulos": ["Título da capa", "Agenda", "Título seção 1", ...] }`;

  const userPrompt = `Tema da apresentação: "${tema}"

${temArquivos ? `ARQUIVOS DE REFERÊNCIA FORNECIDOS (use-os para guiar a estrutura):\n${contextoArquivos}` : 'Nenhum arquivo de referência fornecido.'}

Gere a lista de títulos para uma apresentação completa sobre este tema.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200, // títulos médicos em PT-BR são longos; 1200 garante margem segura
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const texto = response.content[0].text.trim();
  let dados;
  try {
    const limpo = texto.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    dados = JSON.parse(limpo);
  } catch (err) {
    throw new Error('Erro ao interpretar resposta da IA: ' + err.message);
  }

  return dados.titulos || [];
}

// Gera um batch de slides (subset dos títulos)
async function gerarBatch({ tema, contextoArquivos, temArquivos, perfilEstilo, titulosBatch, totalTitulos, isPrimeiro }) {
  const blocoPerfilEstilo = perfilEstilo
    ? `\nPERFIL DE ESTILO DA APRESENTADORA:\n${perfilEstilo}\nSiga fielmente esse perfil.\n`
    : '';

  const blocoTitulos = `\nSLIDES A GERAR (exatamente um por título, nesta ordem):\n${titulosBatch.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`;

  const contextoGeral = totalTitulos > titulosBatch.length
    ? `\nEsta é a ${isPrimeiro ? 'primeira' : 'segunda'} parte de uma apresentação de ${totalTitulos} slides sobre "${tema}". Mantenha coerência com o restante.\n`
    : '';

  const formatoSlides = isPrimeiro
    ? `{
  "titulo": "Título principal da apresentação",
  "subtitulo": "Subtítulo opcional",
  "tema": "tema recebido",
  "slides": [
    { "tipo": "capa", "titulo": "...", "subtitulo": "...", "autor": "Residente de Radioterapia", "data": "2026" },
    { "tipo": "agenda", "titulo": "Agenda", "itens": ["Tópico 1", "Tópico 2"] },
    { "tipo": "conteudo", "titulo": "...", "pontos": ["ponto 1", "ponto 2"], "destaque": "...(opcional)", "fonte": "...(opcional)" },
    { "tipo": "secao", "titulo": "...", "subtitulo": "...(opcional)" },
    { "tipo": "tabela", "titulo": "...", "cabecalho": ["Col1","Col2"], "linhas": [["a","b"]], "fonte": "...(opcional)" },
    { "tipo": "conclusao", "titulo": "...", "pontos": ["..."], "mensagem_final": "..." },
    { "tipo": "referencias", "titulo": "Referências", "lista": ["ref 1"] }
  ]
}`
    : `{
  "slides": [
    { "tipo": "conteudo", "titulo": "...", "pontos": ["ponto 1", "ponto 2"], "destaque": "...(opcional)" },
    { "tipo": "secao", "titulo": "...", "subtitulo": "...(opcional)" },
    { "tipo": "tabela", "titulo": "...", "cabecalho": ["Col1","Col2"], "linhas": [["a","b"]] },
    { "tipo": "conclusao", "titulo": "...", "pontos": ["..."], "mensagem_final": "..." },
    { "tipo": "referencias", "titulo": "Referências", "lista": ["ref 1"] }
  ]
}`;

  const systemPrompt = `Você é um especialista em Física Médica e Radioterapia com amplo conhecimento clínico e acadêmico.
${blocoPerfilEstilo}${blocoTitulos}${contextoGeral}
REGRAS:
1. Conteúdo tecnicamente preciso, profundo e clinicamente relevante.
2. ${temArquivos ? 'DÊ MÁXIMA PRIORIDADE aos arquivos de referência. Use-os como base principal.' : 'Use seu conhecimento especializado.'}
3. Inclua dados clínicos, valores numéricos e protocolos quando disponíveis.
4. Linguagem técnica para profissionais de saúde em residência.
5. PROIBIDO usar travessão (— ou -). Use dois pontos (:), vírgula ou ponto.
6. Gere exatamente um slide para cada título listado.

FORMATO (JSON ESTRITO, sem texto adicional):
${formatoSlides}`;

  const userPrompt = `Tema: "${tema}"

${temArquivos ? `ARQUIVOS DE REFERÊNCIA:\n${contextoArquivos}` : 'Sem arquivos de referência — use seu conhecimento especializado.'}

Gere os slides para uma residente de radioterapia apresentar à equipe.`;

  const texto = await withRetry(async () => {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    return (await stream.finalText()).trim();
  });

  const limpo = texto.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(limpo);
  } catch (err) {
    throw new Error('Erro ao interpretar resposta da IA: ' + err.message);
  }
}

async function gerarConteudoApresentacao({ tema, arquivos, usuarioId, titulos }) {
  const contextoArquivos = arquivos
    .filter(a => a.content && a.content.trim())
    .map(a => `=== ARQUIVO: ${a.filename} (${a.type.toUpperCase()}) ===\n${trim(a.content, LIMITE_CONTEUDO)}`)
    .join('\n\n');

  const temArquivos = contextoArquivos.length > 0;
  const perfilEstilo = buscarPerfil(usuarioId);

  // Presentações com muitos slides: divide em dois batches para evitar overload
  if (titulos && titulos.length > 12) {
    const meio = Math.ceil(titulos.length / 2);
    const batch1Titulos = titulos.slice(0, meio);
    const batch2Titulos = titulos.slice(meio);

    console.log(`Gerando batch 1 (${batch1Titulos.length} slides)...`);
    const batch1 = await gerarBatch({ tema, contextoArquivos, temArquivos, perfilEstilo, titulosBatch: batch1Titulos, totalTitulos: titulos.length, isPrimeiro: true });

    console.log(`Gerando batch 2 (${batch2Titulos.length} slides)...`);
    const batch2 = await gerarBatch({ tema, contextoArquivos, temArquivos, perfilEstilo, titulosBatch: batch2Titulos, totalTitulos: titulos.length, isPrimeiro: false });

    return {
      titulo: batch1.titulo || tema,
      subtitulo: batch1.subtitulo || '',
      tema: batch1.tema || tema,
      slides: [...(batch1.slides || []), ...(batch2.slides || [])],
    };
  }

  // Apresentação pequena: uma única chamada
  const resultado = await gerarBatch({ tema, contextoArquivos, temArquivos, perfilEstilo, titulosBatch: titulos || [], totalTitulos: (titulos || []).length, isPrimeiro: true });
  return resultado;
}

module.exports = { gerarConteudoApresentacao, sugerirEstrutura };
