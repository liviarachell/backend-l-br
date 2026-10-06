const express = require('express');
const { z } = require('zod');

const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/books  -> lista de livros (com o progresso do usuário, se estiver logado)
router.get('/books', async (req, res, next) => {
  try {
    const [books] = await pool.query(
      'SELECT id, title, author, description, cover_url FROM books ORDER BY title'
    );
    res.json({ books });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id  -> dados do livro (sem o texto completo)
router.get('/books/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, author, description, cover_url FROM books WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Livro não encontrado.' });
    res.json({ book: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/books/:id/content  -> texto completo + progresso do usuário (exige login)
router.get('/books/:id/content', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, author, content FROM books WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Livro não encontrado.' });

    const [prog] = await pool.query(
      'SELECT percent FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user.id, req.params.id]
    );

    res.json({ book: rows[0], percent: prog.length ? Number(prog[0].percent) : 0 });
  } catch (err) {
    next(err);
  }
});

// PUT /api/books/:id/progress  -> salva a porcentagem lida
const progressSchema = z.object({
  percent: z.number().min(0).max(100),
});

router.put('/books/:id/progress', requireAuth, async (req, res, next) => {
  try {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'A porcentagem deve ser um número entre 0 e 100.' });
    }

    const [book] = await pool.query('SELECT id FROM books WHERE id = ?', [req.params.id]);
    if (!book.length) return res.status(404).json({ error: 'Livro não encontrado.' });

    await pool.query(
      `INSERT INTO reading_progress (user_id, book_id, percent)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE percent = VALUES(percent)`,
      [req.user.id, req.params.id, parsed.data.percent]
    );

    res.json({ bookId: Number(req.params.id), percent: parsed.data.percent });
  } catch (err) {
    next(err);
  }
});

// GET /api/progress  -> progresso do usuário em todos os livros
router.get('/progress', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id AS bookId, b.title, b.author, b.cover_url, rp.percent, rp.updated_at
       FROM reading_progress rp
       JOIN books b ON b.id = rp.book_id
       WHERE rp.user_id = ?
       ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json({ progress: rows.map((r) => ({ ...r, percent: Number(r.percent) })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
