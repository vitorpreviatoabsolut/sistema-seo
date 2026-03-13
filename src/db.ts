import dotenv from 'dotenv';
dotenv.config();

import mysql from 'mysql2/promise';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '162.241.2.49',
  user: process.env.DB_USER || 'abso7751_sistemaseo',
  password: process.env.DB_PASSWORD || 'Ravxl!@#$%1',
  database: process.env.DB_NAME || 'abso7751_sistemaseo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        context TEXT
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS keywords (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT,
        keyword VARCHAR(255) NOT NULL,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS regions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT,
        region VARCHAR(255) NOT NULL,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        client_id INT UNIQUE,
        content TEXT NOT NULL,
        FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS global_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL
      )
    `);
  } finally {
    connection.release();
  }
})();
