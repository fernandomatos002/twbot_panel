// src/main/apiService.js (NOVO)

const axios = require('axios');
const { default: axiosRetry } = require('axios-retry');

// Comentário de Implementação:
// Usamos variáveis de módulo para 'store', 'windowManager' e 'BACKEND_BASE_URL'.
// Elas serão configuradas por uma função 'initApiService' chamada no 'index.cjs'.
// Isso segue o padrão de Injeção de Dependência, tornando o módulo testável
// e evitando dependências circulares ou globais.
let store;
let windowManager;
let BACKEND_BASE_URL;

// Flag para prevenir múltiplas tentativas de refresh simultâneas (race condition)
let isRefreshing = false;
// Fila para requisições que falharam com 401 enquanto um refresh estava em andamento
let failedQueue = [];

/**
 * Processa a fila de requisições que falharam e as re-tenta com o novo token.
 * @param {Error | null} error - O erro (se o refresh falhou) ou null (se teve sucesso)
 * @param {string | null} token - O novo accessToken (se teve sucesso)
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
 * Cria a instância principal do Axios ('api') com interceptadores.
 * Esta instância lidará com todas as requisições autenticadas.
 */
const api = axios.create();

// Aplica o 'axios-retry' apenas à instância 'api'
axiosRetry(api, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    console.warn(`[AxiosRetry] Tentativa ${retryCount} falhou (${error.code || error.response?.status}). Aguardando ${retryCount * 2}s...`);
    return retryCount * 2000;
  },
  // Não re-tenta em erros 401 (Unauthorized) ou 403 (Forbidden), 
  // pois o interceptor de resposta cuidará do 401.
  retryCondition: (error) => 
    (axiosRetry.isNetworkError(error) || axiosRetry.isSafeRequestError(error) || error.response?.status >= 500) &&
    error.response?.status !== 401 && 
    error.response?.status !== 403
});

// === INTERCEPTOR DE REQUISIÇÃO (Request) ===
// Injeta o 'authToken' do 'store' em todas as requisições
api.interceptors.request.use(
  (config) => {
    if (!store) {
      console.error("[apiService] Erro: store não inicializado.");
      return Promise.reject(new Error("apiService não inicializado."));
    }
    const token = store.get('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// === INTERCEPTOR DE RESPOSTA (Response) ===
// Lida automaticamente com falhas 401 (Token Expirado)
api.interceptors.response.use(
  (response) => response, // Sucesso: não faz nada
  async (error) => {
    const originalRequest = error.config;
    
    // Se o erro NÃO for 401, ou já for uma tentativa de refresh, rejeita
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Se já houver um refresh em andamento, coloca esta requisição na fila
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
      .then(token => {
        // Quando o refresh terminar, re-tenta com o novo token
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    // Comentário de Implementação:
    // Esta é a primeira requisição que falhou com 401.
    // Inicia o processo de refresh.
    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = store.get('refreshToken');
    if (!refreshToken) {
      console.log("[apiService] 401 mas sem refreshToken. Forçando logout.");
      isRefreshing = false;
      store.delete('authToken');
      if (windowManager) windowManager.sendForceLogout('Sessão expirada (sem refresh token).');
      return Promise.reject(error);
    }

    try {
      console.log("[apiService] Token expirado (401). Tentando refresh...");
      // Usa a instância 'authApi' (sem interceptor) para evitar loop
      const refreshResponse = await authApi.post('/api/auth/refresh', { refreshToken });

      const newAccessToken = refreshResponse.data.accessToken;
      if (!newAccessToken) {
        throw new Error("Refresh token inválido ou não retornou accessToken.");
      }

      console.log("[apiService] Refresh bem-sucedido. Novo accessToken obtido.");
      
      // 1. Salva o novo token no store
      store.set('authToken', newAccessToken);
      
      // 2. Notifica o Renderer (App.jsx) para salvar no localStorage
      if (windowManager) windowManager.sendTokenUpdateToRenderer('system-refresh', newAccessToken);

      // 3. Atualiza o header da requisição original
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      
      // 4. Processa a fila de requisições pendentes com o novo token
      processQueue(null, newAccessToken);

      // 5. Re-tenta a requisição original
      return api(originalRequest);

    } catch (refreshError) {
      console.error("[apiService] Falha CRÍTICA no refresh token:", refreshError.response?.data?.message || refreshError.message);
      
      // O refresh token falhou (provavelmente inválido ou expirado)
      store.delete('authToken');
      store.delete('refreshToken');
      
      // 1. Notifica o Renderer
      if (windowManager) windowManager.sendForceLogout('Sua sessão expirou. Por favor, faça login novamente.');
      
      // 2. Rejeita todas as requisições pendentes
      processQueue(refreshError, null);
      
      // 3. Rejeita a requisição atual
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);


/**
 * Cria a instância 'authApi' para rotas públicas (login, register, refresh).
 * Esta instância NÃO usa interceptadores de autenticação para evitar loops.
 * Ela compartilha as configurações básicas (baseURL, timeout).
 */
const authApi = axios.create();


/**
 * Inicializa o apiService com as dependências necessárias do processo principal.
 * Esta função DEVE ser chamada no 'index.cjs' antes de qualquer outra coisa.
 *
 * @param {object} config
 * @param {Store} config.store - A instância do electron-store
 * @param {object} config.windowManager - O módulo windowManager
 * @param {string} config.backendUrl - A URL base do backend
 */
function initApiService(config) {
  store = config.store;
  windowManager = config.windowManager;
  BACKEND_BASE_URL = config.backendUrl;

  // Configurações padrão para AMBAS as instâncias
  const commonConfig = {
    baseURL: BACKEND_BASE_URL,
    timeout: 30000,
  };

  Object.assign(api.defaults, commonConfig);
  Object.assign(authApi.defaults, commonConfig);

  console.log('[apiService] Inicializado com baseURL:', BACKEND_BASE_URL);
}

module.exports = {
  /**
   * A instância principal para requisições autenticadas.
   * Automaticamente injeta o 'authToken' e lida com refresh (401).
   */
  api,
  
  /**
   * A instância para requisições de autenticação (login, register).
   * NÃO injeta tokens.
   */
  authApi,
  
  /**
   * Função de inicialização para injetar dependências.
   */
  initApiService
};