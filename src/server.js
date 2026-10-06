require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const contactRoutes = require('./routes/contact');

if (!process.env.JWT_SECRET) {
  console.error('Defina JWT_SECRET no arquivo .env antes de iniciar.');
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));

// Limite geral e um limite mais rígido para login/cadastro/contato (evita abuso)
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});
app.use('/api/auth', strictLimiter);
app.use('/api/contact', strictLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api', bookRoutes);
app.use('/api', contactRoutes);

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`LêBrasil API rodando na porta ${port}`));
