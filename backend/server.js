// /twbot_panel/backend/server.js
// (v22) - CORRIGIDO: Corrige o conflito de rotas do Dashboard.
// 1. Carrega variáveis de ambiente PRIMEIRO
require('dotenv').config();

// 2. Importa módulos principais
const express = require('express');
const cors = require('cors');
const path = require('path');

// 3. Importa o middleware de autenticação
const authenticateToken = require('./middleware/authenticateToken');

// 4. Inicializa o Express
const app = express();
const PORT = process.env.PORT || 5000;

// 5. Configura Middlewares Globais
app.use(cors());
app.use(express.json()); // Importante vir ANTES das rotas

// --- 6. Importa e Usa as Rotas ---

// Rotas de Autenticação (Públicas)
app.use('/api/auth', require('./routes/auth.js'));

// Rotas de Automação (Download de Worker)
app.use('/api/automation', authenticateToken, require('./routes/automation.js'));

// Rota de Dados do Painel (Movido para um prefixo específico para evitar conflito com /api/tw-accounts)
app.use('/api/data', require('./routes/dashboard.js')); // <-- CORRIGIDO AQUI

// Rotas de Gerenciamento (CRUD)
app.use('/api/tw-accounts', authenticateToken, require('./routes/twAccounts.js')); 
app.use('/api/proxies', authenticateToken, require('./routes/proxies.js'));
app.use('/api/construction-lists', authenticateToken, require('./routes/constructionLists.js'));
app.use('/api/groups', authenticateToken, require('./routes/groups.js'));
app.use('/api/recruitment-templates', authenticateToken, require('./routes/recruitmentTemplates.js'));


// --- Rota Principal (Teste) ---
app.get('/', (req, res) => res.send('Bem-vindo ao backend do TWBot Panel v21 (Refatorado)!'));

// --- Inicialização do Servidor ---
try {
    app.listen(PORT, '0.0.0.0', () => { // Escuta em todas as interfaces
        console.log(`Servidor v21 (Refatorado) rodando na porta ${PORT}`);
    });
} catch (error) {
    console.error('FATAL: Falha ao iniciar o servidor Express:', error);
    process.exit(1); 
}