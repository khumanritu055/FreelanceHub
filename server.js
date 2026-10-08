const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'freelancehub.db'));
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('client','freelancer')),
  skills TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS gigs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  budget INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS proposals(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gig_id INTEGER NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  freelancer_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(gig_id, freelancer_id)
);`);

const app = express();
app.use(express.json());
app.use(session({ secret: 'freelancehub-secret-change-me', resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, 'public')));

const need = role => (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
  if (role && req.session.user.role !== role) return res.status(403).json({ error: `Only a ${role} can do this.` });
  next();
};

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { name, email, password, role, skills } = req.body;
  if (!name || !email || !password || !['client', 'freelancer'].includes(role))
    return res.status(400).json({ error: 'Fill in all fields.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password needs at least 6 characters.' });
  try {
    const info = db.prepare('INSERT INTO users(name,email,password,role,skills) VALUES(?,?,?,?,?)')
      .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), role, skills || '');
    req.session.user = { id: info.lastInsertRowid, name: name.trim(), role };
    res.json(req.session.user);
  } catch (e) {
    res.status(400).json({ error: 'This email is already registered.' });
  }
});

app.post('/api/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((req.body.email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(req.body.password || '', u.password))
    return res.status(401).json({ error: 'Wrong email or password.' });
  req.session.user = { id: u.id, name: u.name, role: u.role };
  res.json(req.session.user);
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json(req.session.user || null));

// ---------- Gigs ----------
app.get('/api/gigs', (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const cat = req.query.category || '';
  const rows = db.prepare(`
    SELECT g.*, u.name AS client_name,
      (SELECT COUNT(*) FROM proposals p WHERE p.gig_id=g.id) AS proposal_count
    FROM gigs g JOIN users u ON u.id=g.client_id
    WHERE (g.title LIKE ? OR g.description LIKE ?) AND (?='' OR g.category=?)
    ORDER BY g.id DESC`).all(q, q, cat, cat);
  res.json(rows);
});

app.post('/api/gigs', need('client'), (req, res) => {
  const { title, description, category, budget } = req.body;
  if (!title || !description || !category || !(budget > 0))
    return res.status(400).json({ error: 'Fill in all fields with a valid budget.' });
  const info = db.prepare('INSERT INTO gigs(client_id,title,description,category,budget) VALUES(?,?,?,?,?)')
    .run(req.session.user.id, title, description, category, budget);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/gigs/:id', need('client'), (req, res) => {
  const r = db.prepare('DELETE FROM gigs WHERE id=? AND client_id=?').run(req.params.id, req.session.user.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'Gig not found.' });
});

// ---------- Proposals ----------
app.get('/api/gigs/:id/proposals', need('client'), (req, res) => {
  const gig = db.prepare('SELECT * FROM gigs WHERE id=? AND client_id=?').get(req.params.id, req.session.user.id);
  if (!gig) return res.status(404).json({ error: 'Gig not found.' });
  res.json(db.prepare(`SELECT p.*, u.name AS freelancer_name, u.skills FROM proposals p
    JOIN users u ON u.id=p.freelancer_id WHERE p.gig_id=? ORDER BY p.id DESC`).all(gig.id));
});

app.post('/api/gigs/:id/proposals', need('freelancer'), (req, res) => {
  const { message, price } = req.body;
  const gig = db.prepare("SELECT * FROM gigs WHERE id=? AND status='open'").get(req.params.id);
  if (!gig) return res.status(400).json({ error: 'This gig is no longer open.' });
  if (!message || !(price > 0)) return res.status(400).json({ error: 'Write a message and a valid price.' });
  try {
    db.prepare('INSERT INTO proposals(gig_id,freelancer_id,message,price) VALUES(?,?,?,?)')
      .run(gig.id, req.session.user.id, message, price);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'You already sent a proposal for this gig.' });
  }
});

app.post('/api/proposals/:id/accept', need('client'), (req, res) => {
  const p = db.prepare(`SELECT p.* FROM proposals p JOIN gigs g ON g.id=p.gig_id
    WHERE p.id=? AND g.client_id=? AND g.status='open'`).get(req.params.id, req.session.user.id);
  if (!p) return res.status(404).json({ error: 'Proposal not found or gig already hired.' });
  db.transaction(() => {
    db.prepare("UPDATE proposals SET status='rejected' WHERE gig_id=?").run(p.gig_id);
    db.prepare("UPDATE proposals SET status='accepted' WHERE id=?").run(p.id);
    db.prepare("UPDATE gigs SET status='hired' WHERE id=?").run(p.gig_id);
  })();
  res.json({ ok: true });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', need(), (req, res) => {
  const u = req.session.user;
  if (u.role === 'client') {
    return res.json(db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM proposals p WHERE p.gig_id=g.id) AS proposal_count
      FROM gigs g WHERE client_id=? ORDER BY id DESC`).all(u.id));
  }
  res.json(db.prepare(`SELECT p.*, g.title, g.budget FROM proposals p JOIN gigs g ON g.id=p.gig_id
    WHERE p.freelancer_id=? ORDER BY p.id DESC`).all(u.id));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`FreelanceHub running on port ${PORT}`));