import { pool, initDb } from './_db.js';
import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  await initDb();

  if (req.method === 'POST') {
    const { action, email, password, name } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const hashedPassword = hashPassword(password);

    try {
      if (action === 'signup') {
        const cleanName = (name || cleanEmail.split('@')[0]).trim();
        
        // Check if user exists
        const check = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
        if (check.rows.length > 0) {
          return res.status(409).json({ error: 'Email is already registered' });
        }

        const insert = await pool.query(
          'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
          [cleanName, cleanEmail, hashedPassword]
        );

        const newUser = insert.rows[0];
        return res.status(201).json({
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            avatarInitial: (newUser.name || newUser.email)[0].toUpperCase(),
            plan: 'Free Pro tier'
          }
        });

      } else {
        // Sign in / Login
        const query = await pool.query(
          'SELECT id, name, email, password FROM users WHERE email = $1',
          [cleanEmail]
        );

        if (query.rows.length === 0) {
          return res.status(401).json({ error: 'Account not found. Please sign up.' });
        }

        const user = query.rows[0];
        if (user.password !== hashedPassword) {
          return res.status(401).json({ error: 'Incorrect password' });
        }

        return res.status(200).json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarInitial: (user.name || user.email)[0].toUpperCase(),
            plan: 'Free Pro tier'
          }
        });
      }
    } catch (err) {
      console.error('Auth API Error:', err);
      return res.status(500).json({ error: 'Internal database error: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
