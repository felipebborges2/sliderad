require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const apresentacaoRoutes = require('./routes/apresentacao');
const historicoRoutes = require('./routes/historico');
const roteiroRoutes = require('./routes/roteiro');
const perfilRoutes = require('./routes/perfil');
const bibliotecaRoutes = require('./routes/biblioteca');

const app = express();
const PORT = process.env.PORT || 3001;

// Garantir que pasta de uploads existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/apresentacao', apresentacaoRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/roteiro', roteiroRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/biblioteca', bibliotecaRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));

module.exports = app;
