const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');

const pool = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { sendWelcome, sendPasswordReset } = require('../mailer');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido.').max(190),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

function firstError(result) {
  return result.error.issues[0].message;
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed) });
    const { name, email, password } = parsed.data;

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, passwordHash]
    );

    const user = { id: result.insertId, name, email };

    // E-mail de boas-vindas não deve impedir o cadastro se falhar
    sendWelcome(user).catch((err) => console.error('Falha ao enviar boas-vindas:', err.message));

    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed) });
    const { email, password } = parsed.data;

    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = ?',
      [email]
    );
    const row = rows[0];
    const ok = row && (await bcrypt.compare(password, row.password_hash));
    if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });

    const user = { id: row.id, name: row.name, email: row.email };
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [
      req.user.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const parsed = z
      .object({ email: z.string().trim().toLowerCase().email('E-mail inválido.') })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed) });

    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [
      parsed.data.email,
    ]);

    if (rows.length) {
      const user = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      await pool.query(
        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))',
        [user.id, tokenHash]
      );

      const link = `${process.env.FRONTEND_URL}/redefinir-senha.html?token=${token}`;
      sendPasswordReset(user, link).catch((err) =>
        console.error('Falha ao enviar redefinição:', err.message)
      );
    }

    // Mesma resposta exista ou não a conta, para não revelar quem está cadastrado
    res.json({ message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        token: z.string().min(10),
        password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(100),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstError(parsed) });

    const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
    const [rows] = await pool.query(
      'SELECT id, user_id FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > NOW()',
      [tokenHash]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Link inválido ou expirado.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
      passwordHash,
      rows[0].user_id,
    ]);
    await pool.query('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);

    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
