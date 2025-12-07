// src/main/updater.js (MODIFICADO - Passo 3)

// --- REMOVIDO: axios ---
const path = require('path');
const fs = require('fs');

/**
 * Baixa um arquivo de worker do backend e o salva localmente.
 *
 * @param {string} moduleName
 * @param {string} remoteVersion
 * @param {object} config - Objeto de configuração
 * @param {object} config.api - A instância 'api' do apiService
 * @param {string} config.WORKERS_PATH
 * @param {object} config.store
 * @param {string} config.LOCAL_VERSIONS_KEY
 */
async function downloadWorker(moduleName, remoteVersion, config) {
  // --- MODIFICADO: 'api' vem da config, 'token' e 'BACKEND_BASE_URL' removidos ---
  const { api, WORKERS_PATH, store, LOCAL_VERSIONS_KEY } = config;
  const workerFileName = `${moduleName}.jsc`;
  const workerFilePath = path.join(WORKERS_PATH, workerFileName);
  
  console.log(`[Updater] Baixando ${moduleName}@${remoteVersion}...`);
  try {
    // --- MODIFICADO: Usa 'api' ---
    const response = await api.get('/api/automation/get-worker', {
      params: { module: moduleName },
      responseType: 'arraybuffer'
      // Headers de 'Authorization' são adicionados pelo interceptor
    });

    if (!fs.existsSync(WORKERS_PATH)) {
      fs.mkdirSync(WORKERS_PATH, { recursive: true });
    }
    
    fs.writeFileSync(workerFilePath, response.data);
    
    const localVersions = store.get(LOCAL_VERSIONS_KEY, {});
    localVersions[moduleName] = remoteVersion;
    store.set(LOCAL_VERSIONS_KEY, localVersions);
    
    console.log(`[Updater] ${moduleName} atualizado para ${remoteVersion}`);
  } catch (error) {
    // Comentário de Implementação:
    // O interceptor do 'api' já tratou o 401.
    // Este 'catch' trata erros específicos de download (Buffer) ou outros (500).
    if (error.response?.data instanceof Buffer) {
      try {
        const errorString = error.response.data.toString('utf-8');
        const errorJson = JSON.parse(errorString);
        console.error(`[Updater] Falha download ${moduleName} (Server Error): ${errorJson.message || errorString}`);
      } catch (parseError) {
        console.error(`[Updater] Falha download ${moduleName} (Unreadable Error):`, error.response.data);
      }
    } else {
      console.error(`[Updater] Falha download ${moduleName}:`, error.message, error.code);
    }
    throw error; // Propaga para 'checkAndUpdateWorkers'
  }
}

/**
 * Verifica no backend por novas versões dos workers.
 *
 * @param {object} config - Objeto de configuração
 * @param {object} config.api - A instância 'api' do apiService
 * @param {object} config.store
 * @param {object} config.windowManager
 * @param {string} config.WORKERS_PATH
 * @param {string} config.LOCAL_VERSIONS_KEY
 */
async function checkAndUpdateWorkers(config) {
  // --- MODIFICADO: 'api' vem da config, 'token' e 'BACKEND_BASE_URL' removidos ---
  const { api, store, windowManager, WORKERS_PATH, LOCAL_VERSIONS_KEY } = config;
  
  console.log('[Updater] Verificando...');
  
  // Comentário de Implementação:
  // Ainda verificamos o 'authToken' aqui, não para injetá-lo (o 'api' faz
  // isso), mas para evitar uma chamada de rede desnecessária se
  // o usuário nem estiver logado.
  const token = store.get('authToken');
  if (!token) {
    console.log('[Updater] Sem token, verificação pulada.');
    return;
  }
  
  try {
    // --- MODIFICADO: Usa 'api' ---
    const response = await api.get('/api/automation/worker-versions');
    
    const remoteVersions = response.data;
    const localVersions = store.get(LOCAL_VERSIONS_KEY, {});

    for (const moduleName in remoteVersions) {
      const remoteVersion = remoteVersions[moduleName];
      const localVersion = localVersions[moduleName];
      const workerFilePath = path.join(WORKERS_PATH, `${moduleName}.jsc`);

      if (!localVersion || localVersion !== remoteVersion || !fs.existsSync(workerFilePath)) {
        console.log(`[Updater] Atualização necessária para ${moduleName} (Local: ${localVersion}, Remota: ${remoteVersion}, Existe: ${fs.existsSync(workerFilePath)})`);
        
        // --- MODIFICADO: 'token' não é mais passado ---
        await downloadWorker(moduleName, remoteVersion, config);
      }
    }
    console.log('[Updater] Verificação concluída.');
    
  } catch (error) {
    // Comentário de Implementação:
    // A lógica de 401 foi REMOVIDA daqui.
    // O interceptor do 'apiService' já tratou o 401, tentou o refresh,
    // e se falhou, já chamou o 'sendForceLogout' e limpou os tokens.
    // Este 'catch' agora só precisa lidar com erros de conexão ou de servidor.
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error(`[Updater] Falha conexão (${error.code}). Verifique o servidor e a rede.`);
    } else if (error.response?.status !== 401) {
      // Ignora o erro 401 (já tratado), loga os outros
      console.error('[Updater] Erro ao verificar atualizações (Final):', error.response?.data || error.message);
    }
  }
}

module.exports = {
  checkAndUpdateWorkers,
  downloadWorker 
};