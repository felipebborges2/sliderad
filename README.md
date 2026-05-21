<div align="center">

# ✦ SlideRad

### Gerador inteligente de apresentações para residência em Radioterapia

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![License](https://img.shields.io/badge/licença-MIT-blue?style=flat-square)](LICENSE)

**Transforme artigos, guidelines e slides anteriores em apresentações prontas para aula — em minutos.**

[Funcionalidades](#-funcionalidades) · [Como usar](#-como-usar) · [Setup local](#-setup-local) · [Deploy](#-deploy)

</div>

---

## O problema

Residentes de Radioterapia precisam preparar aulas técnicas toda semana — com alta densidade de conteúdo, linguagem clínica precisa e estrutura consistente. Montar cada apresentação do zero consome horas que deveriam ir para estudo e descanso.

## A solução

O **SlideRad** lê seus materiais de referência (PDFs de artigos, guidelines, protocolos) e gera uma apresentação `.pptx` completa e pronta para ser ajustada. Com o tempo, o sistema aprende o seu estilo de aula — estrutura, profundidade, vocabulário — e replica automaticamente nas gerações seguintes.

---

## ✦ Funcionalidades

### ⚡ Gerar apresentação

Fluxo em duas etapas projetado para dar controle total antes de gerar:

1. **Sugestão de estrutura** — IA propõe uma lista de títulos de slides com base no tema e nos materiais enviados
2. **Edição da estrutura** — você adiciona, remove ou reordena os títulos como preferir
3. **Geração completa** — conteúdo técnico gerado slide a slide com base na estrutura aprovada
4. **Pré-visualização inline** — navegue pelos slides em formato 16:9 antes de baixar, com edição direta no browser
5. **Download em .pptx** — pronto para abrir no PowerPoint, Canva ou Google Slides

### ✎ Roteiro de aula

Para quando você só precisa do texto, sem montar arquivo:

- Informe os títulos dos slides que você já planejou
- A IA devolve o conteúdo detalhado de cada slide individualmente
- Regenere slides específicos com um clique
- Copie tudo para colar onde preferir

### ◎ Perfil de estilo

O diferencial que faz o sistema parecer que te conhece:

- Faça upload das suas apresentações anteriores (PPTX, DOCX, PDF)
- A IA analisa e aprende: sua estrutura típica, profundidade técnica, como você conclui, quantos tópicos usa por slide, seu vocabulário
- O perfil é injetado automaticamente em todas as gerações — as novas aulas saem no seu estilo, não no estilo genérico da IA
- Edite a descrição do perfil manualmente quando quiser refinar

### 📚 Biblioteca de referências

Guarde seus materiais para reusar sem precisar fazer upload toda vez:

- Salve PDFs, guidelines e artigos na biblioteca pessoal
- Selecione quais usar em cada nova geração diretamente na interface
- Combinável com uploads avulsos na mesma geração

### ⏱ Histórico

Acesse todas as apresentações já geradas, veja os slides e baixe novamente a qualquer momento.

---

## 🗂 Formatos de arquivo suportados

| Formato | Suporte |
|---------|---------|
| `.pdf`  | Extração completa de texto |
| `.pptx` / `.ppt` | Extração de texto dos slides |
| `.docx` / `.doc` | Extração completa |
| `.txt` / `.md` | Leitura direta |

> Tamanho máximo: **50 MB por arquivo**, até **10 arquivos simultâneos**.

---

## ⚙ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, React Router, CSS modular |
| Backend | Node.js, Express 4 |
| Geração de conteúdo | Anthropic API (Sonnet) |
| Geração de PPTX | pptxgenjs |
| Extração de arquivos | pdf-parse, officeparser, mammoth |
| Banco de dados | lowdb (JSON local) |
| Autenticação | JWT |
| Upload | multer |

---

## 🚀 Setup local

### Pré-requisitos

- [Node.js](https://nodejs.org) 18+
- Chave de API da [Anthropic](https://console.anthropic.com)

### 1. Clone o repositório

```bash
git clone https://github.com/felipebborges2/sliderad.git
cd sliderad
```

### 2. Configure o backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=uma_string_secreta_longa_e_aleatoria
FRONTEND_URL=http://localhost:3000
PORT=3001
```

Instale as dependências e inicie:

```bash
npm install
node server.js
```

O servidor estará disponível em `http://localhost:3001`.

### 3. Configure o frontend

Abra outro terminal:

```bash
cd frontend
npm install
npm start
```

O app abrirá automaticamente em `http://localhost:3000`.

---

## ☁ Deploy

### Backend no Render (recomendado)

1. Crie uma conta em [render.com](https://render.com)
2. Novo serviço → **Web Service** → conecte o repositório
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Em **Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY`
   - `JWT_SECRET`
   - `FRONTEND_URL` (URL do frontend após deploy)

### Frontend no Vercel

1. Crie uma conta em [vercel.com](https://vercel.com)
2. Importe o repositório e defina **Root Directory** como `frontend`
3. Em **Environment Variables**, adicione:
   - `REACT_APP_API_URL` = URL do backend no Render
4. Deploy automático a cada push na branch `main`

> **Sobre persistência:** o `lowdb` usa um arquivo JSON local. Em produção com Render free-tier, os dados são redefinidos a cada novo deploy. Para uso contínuo, considere migrar para PostgreSQL (via Supabase ou Railway) — a camada de serviço isola bem essa troca.

---

## 📁 Estrutura do projeto

```
sliderad/
├── backend/
│   ├── routes/
│   │   ├── auth.js           # Cadastro e login (JWT)
│   │   ├── apresentacao.js   # /estrutura, /gerar, /exportar, /download
│   │   ├── roteiro.js        # /gerar, /regenerar
│   │   ├── perfil.js         # Perfil de estilo pessoal
│   │   ├── biblioteca.js     # Biblioteca de referências
│   │   └── historico.js      # Histórico de apresentações
│   ├── services/
│   │   ├── claude.js         # Geração de apresentações
│   │   ├── claudeRoteiro.js  # Geração de roteiro de aula
│   │   ├── claudePerfil.js   # Análise de estilo pessoal
│   │   ├── pptx.js           # Montagem do arquivo .pptx
│   │   ├── extractor.js      # Extração de texto de arquivos
│   │   └── db.js             # Banco de dados JSON (lowdb)
│   └── server.js
└── frontend/
    └── src/
        ├── pages/
        │   ├── DashboardPage.jsx     # Layout com abas
        │   ├── RoteiroPage.jsx       # Aba Roteiro
        │   ├── PerfilPage.jsx        # Aba Perfil + Biblioteca
        │   └── HistoricoPage.jsx     # Aba Histórico
        └── components/
            ├── PreviewModal.jsx         # Pré-visualização de slides
            └── BibliotecaSelector.jsx   # Seletor de referências salvas
```

---

## 🔒 Segurança e privacidade

- Todas as rotas de dados exigem autenticação JWT
- Arquivos de upload são removidos do servidor após processamento
- Nenhum dado é compartilhado com terceiros além da API de geração de conteúdo
- Arquivos da biblioteca e perfil ficam armazenados localmente no servidor

---

## 📄 Licença

MIT — livre para usar, modificar e distribuir.

---

<div align="center">
Feito com carinho para residentes que merecem dormir mais.
</div>
