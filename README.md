# SlideRad — Gerador de Apresentações de Radioterapia

Sistema que usa IA para gerar apresentações técnicas de radioterapia a partir de arquivos de referência (PDFs, artigos, guidelines, slides anteriores).

## Como rodar localmente

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edite o .env e coloque sua ANTHROPIC_API_KEY
npm install
node server.js
```

O servidor vai rodar em `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

O app vai abrir em `http://localhost:3000`

---

## Como fazer deploy no Vercel (recomendado)

### Backend (como API serverless)

1. Crie uma conta em https://vercel.com
2. Na pasta `backend`, rode: `npx vercel`
3. Nas configurações do projeto, adicione as variáveis de ambiente:
   - `ANTHROPIC_API_KEY` = sua chave
   - `JWT_SECRET` = uma string secreta longa
   - `FRONTEND_URL` = a URL do frontend no Vercel

### Frontend

1. Na pasta `frontend`, crie um arquivo `.env.production`:
   ```
   REACT_APP_API_URL=https://sua-api.vercel.app
   ```
2. Rode: `npx vercel` na pasta `frontend`

---

## Formatos de arquivo suportados

| Formato | Suporte |
|---------|---------|
| PDF     | ✅ Extração completa de texto |
| PPTX    | ✅ Extração de texto dos slides |
| DOCX    | ✅ Extração completa |
| TXT/MD  | ✅ Leitura direta |

## Como usar

1. Crie uma conta no sistema
2. Informe o tema da aula da semana
3. Faça upload dos PDFs de referência (artigos, guidelines, etc.)
4. Clique em **Gerar apresentação**
5. Baixe o `.pptx` gerado
6. Importe no Canva: **Criar design → Importar arquivo**
7. Personalize cores e fontes no seu estilo!
