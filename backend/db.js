// /twbot_panel/backend/db.js
// (v18) - Módulo de Conexão do Banco de Dados
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('FATAL: Erro ao conectar ao banco de dados:', err.stack);
    } else {
        console.log('Conectado ao PostgreSQL com sucesso!');
        release();
    }
});

module.exports = pool;