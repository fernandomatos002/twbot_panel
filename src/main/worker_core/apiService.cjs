// src/main/worker_core/apiService.cjs (NOVO)
// Gerencia TODAS as chamadas de rede para o backend VPS.
// Lida automaticamente com o refresh de access tokens.

const axios = require('axios');
const ipcService = require('./ipcService.cjs');

const BACKEND_BASE_URL = 'http://157.173.106.162:5000';

// Armazenamento em memória dos tokens (específico deste worker)
const tokenStore = {
    authToken: null,
    refreshToken: null
};

let isRefreshing = false;
let failedQueue = [];

/**
 * Processa a fila de requisições pendentes após um refresh.
 * @param {Error | null} error 
 * @param {string | null} token 
 */
function processQueue(error, token = null) {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
}

/**
 * Instância 'api' principal: para chamadas autenticadas.
 */
const api = axios.create({
    baseURL: BACKEND_BASE_URL,
    timeout: 20000 // 20 segundos de timeout
});

/**
 * Instância 'authApi': para chamadas de refresh (evita loop de interceptor).
 */
const authApi = axios.create({
    baseURL: BACKEND_BASE_URL,
    timeout: 20000
});

// Interceptor de Requisição: Injeta o token.
api.interceptors.request.use(
    (config) => {
        if (tokenStore.authToken) {
            config.headers['Authorization'] = `Bearer ${tokenStore.authToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de Resposta: Lida com 401 (Token Expirado).
api.interceptors.response.use(
    (response) => response, // Sucesso
    async (error) => {
        const originalRequest = error.config;
        
        // Se não for 401, ou se for uma falha na rota de refresh, rejeita direto
        if (error.response?.status !== 401 || originalRequest.url === '/api/auth/refresh') {
            return Promise.reject(error);
        }

        // Evita "Race Condition" de múltiplos 401
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(token => {
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                return api(originalRequest);
            });
        }

        isRefreshing = true;
        originalRequest._retry = true;

        if (!tokenStore.refreshToken) {
            console.error('[apiService] 401 detectado, mas não há refreshToken. Encerrando.');
            ipcService.sendStatus('FALHA!', 'Sessão expirada (sem refresh token).');
            process.exit(1); // Encerra o worker
        }

        try {
            console.warn('[apiService] Access token expirou. Tentando refresh...');
            const response = await authApi.post('/api/auth/refresh', {
                refreshToken: tokenStore.refreshToken
            });

            const newAccessToken = response.data.accessToken;
            if (!newAccessToken) throw new Error('Refresh não retornou um novo accessToken.');

            console.log('[apiService] Refresh bem-sucedido. Novo access token obtido.');
            
            // 1. Atualiza o token local
            tokenStore.authToken = newAccessToken;
            
            // 2. Notifica o Main Process para salvar o novo token
            ipcService.sendTokenUpdate(newAccessToken);

            // 3. Atualiza o header da requisição original
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

            // 4. Libera a fila de requisições pendentes
            processQueue(null, newAccessToken);
            
            // 5. Re-tenta a requisição original
            return api(originalRequest);

        } catch (refreshError) {
            console.error('[apiService] Falha CRÍTICA no refresh token:', refreshError.response?.data?.message || refreshError.message);
            
            ipcService.sendStatus('FALHA!', 'Sessão expirada. Faça login novamente no app.');
            processQueue(refreshError, null);
            process.exit(1); // Encerra o worker, pois a sessão é inválida
            
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

/**
 * Inicializa o serviço com os tokens.
 * @param {{authToken: string, refreshToken: string}} config 
 */
function init(config) {
    tokenStore.authToken = config.authToken;
    tokenStore.refreshToken = config.refreshToken;
    console.log('[apiService] Inicializado com tokens.');
}

module.exports = {
    init,
    /**
     * Instância Axios para chamadas de API autenticadas.
     * Automaticamente lida com refresh de token.
     */
    api
};