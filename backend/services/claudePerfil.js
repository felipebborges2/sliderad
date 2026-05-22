const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Para análise de estilo, 15k chars por apresentação é mais que suficiente (~3.75k tokens)
const LIMITE_PERFIL = 15000;

function trim(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n[...]';
}

const SYSTEM_BASE = `Você é um especialista em análise de estilo de apresentações médicas.
Este perfil será usado por uma IA para gerar futuras apresentações no mesmo estilo — deve ser específico, claro e acionável.
Escreva em parágrafo corrido (sem tópicos ou listas). Entre 250 e 400 palavras. Em português.`;

// Gera perfil do zero a partir de apresentações
async function gerarPerfilEstilo(apresentacoes) {
  const textoApresentacoes = apresentacoes
    .filter(a => a.conteudo && a.conteudo.trim())
    .map((a, i) => `=== APRESENTAÇÃO ${i + 1}: ${a.nome} ===\n${trim(a.conteudo, LIMITE_PERFIL)}`)
    .join('\n\n');

  if (!textoApresentacoes.trim()) {
    throw new Error('Nenhum conteúdo extraído das apresentações');
  }

  const systemPrompt = `${SYSTEM_BASE}

Analise as apresentações e descreva o perfil de estilo cobrindo:
estrutura típica (seções, ordem, abertura e fechamento), abordagem de conteúdo (mecanismos, dados, protocolos, casos clínicos), densidade e formato (bullets por slide, tabelas, destaques), profundidade técnica (nível clínico, doses, valores), elementos recorrentes e linguagem característica.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200, // 400 palavras ≈ 530 tokens; 1200 é margem segura
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Analise as seguintes apresentações de radioterapia e gere o perfil de estilo da apresentadora:\n\n${textoApresentacoes}`,
    }],
  });

  return response.content[0].text.trim();
}

// Refina um perfil existente incorporando novas apresentações
async function refinarPerfilEstilo(perfilAtual, novasApresentacoes) {
  const textoNovas = novasApresentacoes
    .filter(a => a.conteudo && a.conteudo.trim())
    .map((a, i) => `=== NOVA APRESENTAÇÃO ${i + 1}: ${a.nome} ===\n${trim(a.conteudo, LIMITE_PERFIL)}`)
    .join('\n\n');

  if (!textoNovas.trim()) {
    // Se não há conteúdo novo válido, retorna o perfil atual sem alteração
    return perfilAtual;
  }

  const systemPrompt = `${SYSTEM_BASE}

Você receberá um perfil de estilo já existente e novas apresentações da mesma pessoa.
Sua tarefa é REFINAR e ENRIQUECER o perfil incorporando padrões das novas apresentações.
Preserve tudo que já foi mapeado. Adicione, especifique ou corrija com base no novo material.
Não comece do zero — construa sobre o que já existe.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `PERFIL ATUAL:\n${perfilAtual}\n\nNOVAS APRESENTAÇÕES:\n${textoNovas}\n\nRefine o perfil incorporando o que foi aprendido com as novas apresentações.`,
    }],
  });

  return response.content[0].text.trim();
}

module.exports = { gerarPerfilEstilo, refinarPerfilEstilo };
