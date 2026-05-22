const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Limite de contexto para regeneração de slide único (~2k tokens)
const LIMITE_REGENERAR = 8000;

function trim(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n[...]';
}

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

async function buscarPerfil(usuarioId) {
  const perfil = await db.findOne('perfil', { usuarioId });
  return perfil?.descricao || null;
}

function buildSystemPrompt(temArquivos, perfilEstilo) {
  const blocoPerfilEstilo = perfilEstilo
    ? `\nPERFIL DE ESTILO DA APRESENTADORA:\n${perfilEstilo}\nAdapte linguagem, profundidade e formato do conteúdo para seguir fielmente esse perfil.\n`
    : '';

  return `Você é um especialista em Física Médica e Radioterapia com amplo conhecimento clínico e acadêmico.
Sua tarefa é gerar o conteúdo textual de slides para uma apresentação clínica a partir dos títulos fornecidos pelo usuário.
${blocoPerfilEstilo}
REGRAS FUNDAMENTAIS:
1. Seja completo e detalhado. Nunca superficial. O texto deve ser denso em informação clínica.
2. Para cada slide, escolha o formato mais adequado:
   - "topicos": quando a informação é factual, enumerável ou estruturada em lista (gere 3 a 6 tópicos densos)
   - "texto": quando o slide exige explicação contínua, raciocínio encadeado ou narrativa clínica
3. PROIBIDO usar travessão (— ou -) em qualquer texto gerado. Use dois pontos (:), ponto final ou vírgula.
4. Inclua dados clínicos precisos, valores numéricos, protocolos e referências sempre que disponíveis.
5. Use linguagem técnica adequada para profissionais de saúde em residência.
` + (temArquivos
    ? '6. DÊ MÁXIMA PRIORIDADE ao conteúdo dos arquivos de referência fornecidos. Use-os como base principal do texto.'
    : '6. Sem arquivos de referência: use seu conhecimento especializado em radioterapia.');
}

const FORMAT_JSON = `
FORMATO DE RESPOSTA (JSON ESTRITO):
Responda APENAS com JSON válido, sem texto adicional:
{
  "slides": [
    {
      "titulo": "título exato conforme fornecido",
      "formato": "topicos",
      "topicos": ["Tópico completo e denso 1", "Tópico 2", "Tópico 3"]
    },
    {
      "titulo": "outro título",
      "formato": "texto",
      "texto": "Texto corrido explicativo, completo e tecnicamente preciso."
    }
  ]
}`;

async function gerarRoteiro({ titulos, contextoArquivos, usuarioId }) {
  const temArquivos = !!(contextoArquivos && contextoArquivos.trim());
  const perfilEstilo = usuarioId ? await buscarPerfil(usuarioId) : null;

  const systemPrompt = buildSystemPrompt(temArquivos, perfilEstilo) + FORMAT_JSON;

  const userPrompt = `Gere o conteúdo para os seguintes slides de uma apresentação de radioterapia:

${titulos.map((t, i) => `${i + 1}. ${t}`).join('\n')}

${temArquivos ? `ARQUIVOS DE REFERÊNCIA:\n${contextoArquivos}` : 'Sem arquivos de referência.'}

Para cada título, escolha o formato (tópicos ou texto corrido) conforme a natureza do conteúdo. Seja completo e técnico.`;

  const texto = await withRetry(async () => {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return stream.finalText();
  });

  return parseJSON(texto);
}

async function regenerarSlide({ titulo, todosTitulos, indice, contextoArquivos, usuarioId }) {
  const temArquivos = !!(contextoArquivos && contextoArquivos.trim());
  const perfilEstilo = usuarioId ? await buscarPerfil(usuarioId) : null;

  const systemPrompt = buildSystemPrompt(temArquivos, perfilEstilo) + FORMAT_JSON;

  const outrosTitulos = todosTitulos
    .filter((_, i) => i !== indice)
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');

  const userPrompt = `Regenere o conteúdo APENAS para o slide abaixo. Use o contexto da apresentação para manter coerência.

SLIDE A REGENERAR:
"${titulo}"

OUTROS SLIDES DA APRESENTAÇÃO (contexto):
${outrosTitulos}

${temArquivos ? `ARQUIVOS DE REFERÊNCIA:\n${trim(contextoArquivos, LIMITE_REGENERAR)}` : 'Sem arquivos de referência.'}

Retorne um JSON com array "slides" contendo apenas este único slide.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500, // um slide não precisa de mais que isso
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const dados = parseJSON(response.content[0].text);
  return dados.slides[0];
}

function parseJSON(texto) {
  const limpo = texto.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(limpo);
  } catch (err) {
    throw new Error('Erro ao interpretar resposta da IA: ' + err.message);
  }
}

module.exports = { gerarRoteiro, regenerarSlide };
