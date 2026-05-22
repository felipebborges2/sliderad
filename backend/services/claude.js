const Anthropic = require('@anthropic-ai/sdk');
const db = require('./db');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Limites de conteúdo por tipo de chamada (chars → tokens ÷ 4)
const LIMITE_ESTRUTURA   =  4000; // ~1k tokens por arquivo — só precisa entender tópicos
const LIMITE_CONTEUDO    = 60000; // ~15k tokens por arquivo — arquivos longos de referência

function trim(text, max) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '\n[...]';
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

async function gerarConteudoApresentacao({ tema, arquivos, usuarioId, titulos }) {
  // Monta contexto dos arquivos de referência
  const contextoArquivos = arquivos
    .filter(a => a.content && a.content.trim())
    .map(a => `=== ARQUIVO: ${a.filename} (${a.type.toUpperCase()}) ===\n${trim(a.content, LIMITE_CONTEUDO)}`)
    .join('\n\n');

  const temArquivos = contextoArquivos.length > 0;
  const perfilEstilo = buscarPerfil(usuarioId);

  const blocoPerfilEstilo = perfilEstilo
    ? `\nPERFIL DE ESTILO DA APRESENTADORA:\n${perfilEstilo}\nAdapte estrutura, profundidade e formato da apresentação para seguir fielmente esse perfil.\n`
    : '';

  const blocoEstrutura = (titulos && titulos.length > 0)
    ? `\nESTRUTURA APROVADA (siga EXATAMENTE esta ordem, um slide por título):\n${titulos.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
    : '';

  const instrucaoQuantidade = (titulos && titulos.length > 0)
    ? 'Gere exatamente um slide para cada título na estrutura aprovada acima.'
    : `Determine a quantidade de slides necessária para cobrir o tema de forma completa, sem slides vazios nem conteúdo omitido.
Diretrizes de quantidade:
- Use quantos slides forem precisos para uma aula completa e densa
- Temas simples ou focados: ~12–16 slides; temas amplos ou com muitos arquivos de referência: 20–30+ slides
- Prefira criar um slide a mais a compactar demais o conteúdo em um único slide
- A apresentação deve ser completa, densa em conteúdo e altamente profissional.`;

  const systemPrompt = `Você é um especialista em Física Médica e Radioterapia com amplo conhecimento clínico e acadêmico.
Sua tarefa é gerar o conteúdo estruturado de uma apresentação didática de alta qualidade sobre um tema de radioterapia.
${blocoPerfilEstilo}${blocoEstrutura}
REGRAS FUNDAMENTAIS:
1. O conteúdo deve ser tecnicamente preciso, profundo e clinicamente relevante
2. ${temArquivos ? 'DÊ MÁXIMA PRIORIDADE ao conteúdo dos arquivos de referência fornecidos. Use-os como base principal.' : 'Use seu conhecimento especializado para gerar conteúdo robusto.'}
3. ${temArquivos ? 'Quando complementar com informações não presentes nos arquivos, indique explicitamente: [Complemento: fonte ou conhecimento próprio]' : ''}
4. A apresentação deve ser muito explicativa, didática e completa
5. Inclua dados clínicos, valores numéricos, protocolos e referências quando disponíveis
6. Use linguagem técnica apropriada para profissionais de saúde em residência
7. PROIBIDO usar travessão (— ou -) em qualquer texto gerado. Substitua por dois pontos (:), ponto final (.), vírgula ou reescreva a frase sem ele

FORMATO DE RESPOSTA (JSON ESTRITO):
Responda APENAS com JSON válido, sem texto adicional, no seguinte formato:
{
  "titulo": "Título principal da apresentação",
  "subtitulo": "Subtítulo opcional",
  "tema": "tema recebido",
  "slides": [
    {
      "tipo": "capa",
      "titulo": "Título da apresentação",
      "subtitulo": "Subtítulo",
      "autor": "Residente de Radioterapia",
      "data": "2025"
    },
    {
      "tipo": "agenda",
      "titulo": "Agenda",
      "itens": ["Tópico 1", "Tópico 2", "Tópico 3"]
    },
    {
      "tipo": "conteudo",
      "titulo": "Título do slide",
      "pontos": [
        "Ponto principal com detalhe clínico relevante",
        "Segundo ponto com dado numérico se aplicável"
      ],
      "destaque": "Informação-chave ou valor clínico importante (opcional)",
      "fonte": "Referência ou arquivo de origem (opcional)"
    },
    {
      "tipo": "secao",
      "titulo": "Nome da Seção",
      "subtitulo": "Descrição breve da seção"
    },
    {
      "tipo": "tabela",
      "titulo": "Título da tabela",
      "cabecalho": ["Col1", "Col2", "Col3"],
      "linhas": [["dado1", "dado2", "dado3"]],
      "fonte": "Referência (opcional)"
    },
    {
      "tipo": "conclusao",
      "titulo": "Conclusões",
      "pontos": ["Ponto 1", "Ponto 2"],
      "mensagem_final": "Mensagem de fechamento"
    },
    {
      "tipo": "referencias",
      "titulo": "Referências",
      "lista": ["Referência 1", "Referência 2"]
    }
  ]
}

${instrucaoQuantidade}`;

  const userPrompt = `Tema da apresentação: "${tema}"

${temArquivos ? `ARQUIVOS DE REFERÊNCIA FORNECIDOS:\n${contextoArquivos}` : 'Nenhum arquivo de referência fornecido. Use seu conhecimento especializado.'}

Gere uma apresentação completa, técnica e didática sobre este tema para uma residente de radioterapia apresentar para sua equipe.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  const texto = response.content[0].text.trim();

  // Parse do JSON
  let dados;
  try {
    // Remove possíveis blocos de código
    const limpo = texto.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    dados = JSON.parse(limpo);
  } catch (err) {
    throw new Error('Erro ao interpretar resposta da IA: ' + err.message);
  }

  return dados;
}

module.exports = { gerarConteudoApresentacao, sugerirEstrutura };
