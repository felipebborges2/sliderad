const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function gerarPerfilEstilo(apresentacoes) {
  // apresentacoes: [{ nome, conteudo }]
  const textoApresentacoes = apresentacoes
    .filter(a => a.conteudo && a.conteudo.trim())
    .map((a, i) => `=== APRESENTAÇÃO ${i + 1}: ${a.nome} ===\n${a.conteudo}`)
    .join('\n\n');

  if (!textoApresentacoes.trim()) {
    throw new Error('Nenhum conteúdo extraído das apresentações');
  }

  const systemPrompt = `Você é um especialista em análise de estilo de apresentações médicas.
Sua tarefa é analisar apresentações de radioterapia feitas pela mesma pessoa e gerar um PERFIL DE ESTILO detalhado e acionável.

Este perfil será usado diretamente por uma IA para gerar futuras apresentações no mesmo estilo, então deve ser específico, claro e descritivo.

Analise e descreva:
1. ESTRUTURA TÍPICA: Como ela organiza uma apresentação do início ao fim. Quais seções sempre aparecem, em que ordem, o que abre e fecha.
2. ABORDAGEM DE CONTEÚDO: O que ela prioriza — fisiopatologia e mecanismos? Dados de literatura com números? Protocolos práticos? Casos clínicos? Comparações entre técnicas?
3. DENSIDADE E FORMATO: Quantos bullets por slide em média, comprimento típico dos bullets, quando usa tabelas, quando usa destaques ou caixas de informação.
4. PROFUNDIDADE TÉCNICA: Quão fundo ela vai nos temas, que nível de detalhe clínico, se cita doses e valores numéricos com frequência.
5. ELEMENTOS RECORRENTES: Slides ou seções que aparecem em quase todas as apresentações (ex: slide de objetivos, lista de referências, mensagem final, take-home points).
6. LINGUAGEM E TERMINOLOGIA: Expressões que ela usa, como formula pontos clínicos, tom geral (muito técnico, didático, objetivo).
7. PADRÕES NOTÁVEIS: Qualquer característica marcante e consistente no jeito dela apresentar.

Escreva o perfil em formato de parágrafo corrido (não use tópicos ou listas).
Seja específico — use exemplos do conteúdo analisado quando relevante.
O perfil deve ter entre 250 e 400 palavras.
Escreva em português.`;

  const userPrompt = `Analise as seguintes apresentações de radioterapia e gere o perfil de estilo da apresentadora:\n\n${textoApresentacoes}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return response.content[0].text.trim();
}

module.exports = { gerarPerfilEstilo };
