import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL in environment");
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chats (
        id VARCHAR(100) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(100) PRIMARY KEY,
        chat_id VARCHAR(100) REFERENCES chats(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        files JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    `);
    console.log("Database initialized successfully!");
  } finally {
    client.release();
  }
}
