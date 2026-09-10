const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required. Link a Postgres database in Coolify or set it in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function initDb() {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);

    const pin = process.env.BOOTSTRAP_ADMIN_PIN;
    if (!pin) {
        return;
    }

    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM participants');
    if (rows[0].count > 0) {
        return;
    }

    await pool.query(
        `INSERT INTO participants (name, pin, is_admin, family_group)
         VALUES ($1, $2, true, $3)`,
        [process.env.BOOTSTRAP_ADMIN_NAME || 'Admin', pin, 'admin']
    );
    console.log('Created bootstrap admin account');
}

module.exports = { pool, initDb };
