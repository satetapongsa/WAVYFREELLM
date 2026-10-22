import { pool, initDb } from './_db.js';

export default async function handler(req, res) {
  // CORS
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

  const userId = req.headers['x-user-id'] || req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // GET: Retrieve all chats + messages for this user
    if (req.method === 'GET') {
      const chatsRes = await pool.query(
        'SELECT id, title, created_at, updated_at FROM chats WHERE user_id = $1 ORDER BY updated_at DESC',
        [userId]
      );

      const chats = [];
      for (const chat of chatsRes.rows) {
        const msgsRes = await pool.query(
          'SELECT id, role, content, files, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
          [chat.id]
        );
        chats.push({
          id: chat.id,
          title: chat.title,
          messages: msgsRes.rows.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            files: m.files || undefined
          }))
        });
      }

      return res.status(200).json({ chats });
    }

    // POST: Save or update a chat with its messages
    if (req.method === 'POST') {
      const { chat } = req.body || {};
      if (!chat || !chat.id) {
        return res.status(400).json({ error: 'Chat data is required' });
      }

      // Upsert chat
      await pool.query(
        `INSERT INTO chats (id, user_id, title, updated_at) 
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (id) 
         DO UPDATE SET title = EXCLUDED.title, updated_at = CURRENT_TIMESTAMP`,
        [chat.id, userId, chat.title || 'New Chat']
      );

      // Save messages
      if (Array.isArray(chat.messages)) {
        for (const msg of chat.messages) {
          const msgId = msg.id || 'msg_' + Date.now() + Math.random().toString(36).slice(2, 6);
          await pool.query(
            `INSERT INTO messages (id, chat_id, role, content, files)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id)
             DO UPDATE SET content = EXCLUDED.content, files = EXCLUDED.files`,
            [msgId, chat.id, msg.role, msg.content, msg.files ? JSON.stringify(msg.files) : null]
          );
        }
      }

      return res.status(200).json({ success: true, chatId: chat.id });
    }

    // DELETE: Delete a specific chat
    if (req.method === 'DELETE') {
      const { chatId } = req.query;
      if (!chatId) {
        return res.status(400).json({ error: 'chatId is required' });
      }

      await pool.query('DELETE FROM chats WHERE id = $1 AND user_id = $2', [chatId, userId]);
      return res.status(200).json({ success: true, deletedChatId: chatId });
    }

  } catch (err) {
    console.error('Chats API Error:', err);
    return res.status(500).json({ error: 'Database operation failed: ' + err.message });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
