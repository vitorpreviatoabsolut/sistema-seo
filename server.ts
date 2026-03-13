import express from 'express';
import { createServer as createViteServer } from 'vite';
import { pool } from './src/db.js';
import fs from 'fs';
import path from 'path';
import { ResultSetHeader } from 'mysql2';

const app = express();
app.use(express.json());

const PORT = 3000;

// API Routes
app.get('/api/check-key', (req, res) => {
  res.json({ 
    hasKey: !!process.env.GEMINI_API_KEY, 
    length: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
    prefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) : null
  });
});

app.get('/api/clients', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM clients');
  res.json(rows);
});

app.post('/api/clients', async (req, res) => {
  const { name, context } = req.body;
  const [result] = await pool.execute('INSERT INTO clients (name, context) VALUES (?, ?)', [name, context || '']) as [ResultSetHeader, any];
  res.json({ id: result.insertId, name, context });
});

app.delete('/api/clients/:id', async (req, res) => {
  await pool.execute('DELETE FROM clients WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/clients/:id/keywords', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM keywords WHERE client_id = ?', [req.params.id]);
  res.json(rows);
});

app.post('/api/clients/:id/keywords', async (req, res) => {
  const { keyword } = req.body;
  const [result] = await pool.execute('INSERT INTO keywords (client_id, keyword) VALUES (?, ?)', [req.params.id, keyword]) as [ResultSetHeader, any];
  res.json({ id: result.insertId, client_id: req.params.id, keyword });
});

app.delete('/api/keywords/:id', async (req, res) => {
  await pool.execute('DELETE FROM keywords WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/clients/:id/regions', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM regions WHERE client_id = ?', [req.params.id]);
  res.json(rows);
});

app.post('/api/clients/:id/regions', async (req, res) => {
  const { region } = req.body;
  const [result] = await pool.execute('INSERT INTO regions (client_id, region) VALUES (?, ?)', [req.params.id, region]) as [ResultSetHeader, any];
  res.json({ id: result.insertId, client_id: req.params.id, region });
});

app.delete('/api/regions/:id', async (req, res) => {
  await pool.execute('DELETE FROM regions WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/clients/:id/template', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM templates WHERE client_id = ?', [req.params.id]);
  res.json(rows[0] || { content: '' });
});

app.post('/api/clients/:id/template', async (req, res) => {
  const { content } = req.body;
  await pool.execute(`
    INSERT INTO templates (client_id, content) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE content = VALUES(content)
  `, [req.params.id, content]);
  res.json({ success: true });
});

app.get('/api/global-templates', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM global_templates');
  res.json(rows);
});

app.post('/api/global-templates', async (req, res) => {
  const { name, content } = req.body;
  const [result] = await pool.execute('INSERT INTO global_templates (name, content) VALUES (?, ?)', [name, content]) as [ResultSetHeader, any];
  res.json({ id: result.insertId, name, content });
});

app.delete('/api/global-templates/:id', async (req, res) => {
  await pool.execute('DELETE FROM global_templates WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
