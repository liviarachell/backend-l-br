const express = require('express');
const { z } = require('zod');

const pool = require('../db');
const { sendContactToAdmin } = require('../mailer');

const router = express.Router();

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120),
  email: z.string().trim().email('E-mail inválido.').max(190),
  subject: z.string().trim().max(190).optional().default(''),
  message: z.string().trim().min(10, 'A mensagem está muito curta.').max(5000),
});

// POST /api/contact
router.post('/contact', async (req, res, next) => {
  try {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, email, subject, message } = parsed.data;

    // Guarda no banco primeiro, para a mensagem não se perder se o e-mail falhar
    await pool.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
      [name, email, subject, message]
    );

    sendContactToAdmin({ name, email, subject, message }).catch((err) =>
      console.error('Falha ao enviar contato:', err.message)
    );

    res.status(201).json({ message: 'Mensagem enviada! Obrigado pelo contato.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
