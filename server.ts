import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db.js';
import fs from 'fs';
import path from 'path';

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

app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients').all();
  res.json(clients);
});

app.post('/api/clients', (req, res) => {
  const { name, context } = req.body;
  const stmt = db.prepare('INSERT INTO clients (name, context) VALUES (?, ?)');
  const info = stmt.run(name, context || '');
  res.json({ id: info.lastInsertRowid, name, context });
});

app.delete('/api/clients/:id', (req, res) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/clients/:id/whatsapp', (req, res) => {
  const { whatsapp_number, whatsapp_message } = req.body;
  const stmt = db.prepare('UPDATE clients SET whatsapp_number = ?, whatsapp_message = ? WHERE id = ?');
  stmt.run(whatsapp_number || '', whatsapp_message || '', req.params.id);
  res.json({ success: true });
});

app.get('/api/clients/:id/keywords', (req, res) => {
  const keywords = db.prepare('SELECT * FROM keywords WHERE client_id = ?').all(req.params.id);
  res.json(keywords);
});

app.post('/api/clients/:id/keywords', (req, res) => {
  const { keyword } = req.body;
  const stmt = db.prepare('INSERT INTO keywords (client_id, keyword) VALUES (?, ?)');
  const info = stmt.run(req.params.id, keyword);
  res.json({ id: info.lastInsertRowid, client_id: req.params.id, keyword });
});

app.post('/api/clients/:id/keywords/bulk', (req, res) => {
  const { keywords } = req.body;
  if (!Array.isArray(keywords)) return res.status(400).json({ error: 'Keywords must be an array' });
  
  const stmt = db.prepare('INSERT INTO keywords (client_id, keyword) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const item of items) stmt.run(req.params.id, item);
  });
  
  insertMany(keywords);
  res.json({ success: true });
});

app.delete('/api/keywords/:id', (req, res) => {
  db.prepare('DELETE FROM keywords WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/clients/:id/regions', (req, res) => {
  const regions = db.prepare('SELECT * FROM regions WHERE client_id = ?').all(req.params.id);
  res.json(regions);
});

app.post('/api/clients/:id/regions', (req, res) => {
  const { region } = req.body;
  const stmt = db.prepare('INSERT INTO regions (client_id, region) VALUES (?, ?)');
  const info = stmt.run(req.params.id, region);
  res.json({ id: info.lastInsertRowid, client_id: req.params.id, region });
});

app.post('/api/clients/:id/regions/bulk', (req, res) => {
  const { regions } = req.body;
  if (!Array.isArray(regions)) return res.status(400).json({ error: 'Regions must be an array' });
  
  const stmt = db.prepare('INSERT INTO regions (client_id, region) VALUES (?, ?)');
  const insertMany = db.transaction((items) => {
    for (const item of items) stmt.run(req.params.id, item);
  });
  
  insertMany(regions);
  res.json({ success: true });
});

app.delete('/api/regions/:id', (req, res) => {
  db.prepare('DELETE FROM regions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/clients/:id/template', (req, res) => {
  const template = db.prepare('SELECT * FROM templates WHERE client_id = ?').get(req.params.id);
  res.json(template || { content: '' });
});

app.post('/api/clients/:id/template', (req, res) => {
  const { content } = req.body;
  const stmt = db.prepare(`
    INSERT INTO templates (client_id, content) VALUES (?, ?)
    ON CONFLICT(client_id) DO UPDATE SET content = excluded.content
  `);
  stmt.run(req.params.id, content);
  res.json({ success: true });
});

app.get('/api/global-templates', (req, res) => {
  const templates = db.prepare('SELECT * FROM global_templates').all();
  res.json(templates);
});

app.post('/api/global-templates', (req, res) => {
  const { name, content } = req.body;
  const stmt = db.prepare('INSERT INTO global_templates (name, content) VALUES (?, ?)');
  const info = stmt.run(name, content);
  res.json({ id: info.lastInsertRowid, name, content });
});

app.delete('/api/global-templates/:id', (req, res) => {
  db.prepare('DELETE FROM global_templates WHERE id = ?').run(req.params.id);
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
