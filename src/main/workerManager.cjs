const { app } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const activeWorkers = new Map();
const activeAuthWorkers = new Map();
const activeViewWorkers = new Map();
const preViewStatus = new Map();
const workerLastStatus = new Map();

let store;
let windowManager;
let api;
let WORKERS_PATH;
let isDev;

function initWorkerManager(config) {
  store = config.store;
  windowManager = config.windowManager;
  api = config.api;
  WORKERS_PATH = config.WORKERS_PATH;
  isDev = config.isDev;
}

function spawnWorkerProcess(workerFileName, args = [], options = {}) {
  let workerPath;
  if (isDev) {
    workerPath = path.join(__dirname, workerFileName);
  } else {
    const jscName = workerFileName.replace('.cjs', '.jsc');
    workerPath = path.join(__dirname, jscName);
  }

  if (!fs.existsSync(workerPath)) {
    throw new Error(`Arquivo worker não encontrado: ${workerPath}`);
  }

  const entryPoint = path.join(__dirname, 'index.cjs');
  
  let nodeModulesPath = path.join(app.getAppPath(), 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
      const alternativePath = path.join(__dirname, '..', '..', 'node_modules');
      if (fs.existsSync(alternativePath)) {
          nodeModulesPath = alternativePath;
      }
  }

  const env = {
    ...process.env,
    ...options.env,
    IS_WORKER_PROCESS: 'true',
    WORKER_TARGET_PATH: workerPath,
    NODE_PATH: nodeModulesPath, 
    ELECTRON_RUN_AS_NODE: '1'
  };

  return fork(entryPoint, args, {
    ...options,
    env: env,
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });
}

async function getProxyConfigFromServer(proxyId) {
  if (!proxyId) return null;
  try {
    const response = await api.get(`/api/proxies/details/${proxyId}`);
    if (response.data?.success) {
      const { host, port, username, password } = response.data.data;
      const proxyConfig = { server: `${host}:${port}` };
      if (username) proxyConfig.username = username;
      if (password) proxyConfig.password = password;
      return proxyConfig;
    }
    throw new Error(response.data.message || 'Proxy não encontrado.');
  } catch (error) {
    throw new Error(`Falha buscar proxy: ${error.message}`);
  }
}

async function startAutomation(account) {
  if (!account || !account.id) return { success: false, message: 'Dados da conta inválidos.' };
  const accountId = account.id;

  if (activeWorkers.has(accountId)) {
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'EM_EXECUÇÃO', log: 'Já rodando.' });
    return { success: true, code: 'ALREADY_RUNNING', message: 'Bot já rodando.' };
  }

  workerLastStatus.delete(accountId);

  const authToken = store.get('authToken');
  const refreshToken = store.get('refreshToken');
  if (!authToken || !refreshToken) {
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'SESSÃO_AUSENTE', log: 'Faça login na aplicação.' });
    return { success: false, code: 'AUTH_MISSING', message: 'Tokens ausentes.' };
  }

  const sessionKey = `session-account-${accountId}`;
  const sessionDataCookies = store.get(sessionKey);
  if (!sessionDataCookies) {
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'SESSÃO_AUSENTE', log: 'Autentique.' });
    return { success: false, code: 'SESSION_MISSING', message: 'Sessão não encontrada.' };
  }

  let proxyConfig = null;
  if (account.proxy_id) {
    try { proxyConfig = await getProxyConfigFromServer(account.proxy_id);
    } 
    catch (proxyError) { return { success: false, message: proxyError.message };
    }
  }

  const sessionForWorker = { cookies: sessionDataCookies, proxy: proxyConfig };
  try {
    const child = spawnWorkerProcess('core_automation-worker.cjs');
    activeWorkers.set(accountId, child);
    child.stderr.on('data', d => windowManager.sendStatusToRenderer({ accountId, status: 'FALHA!', log: `STDERR: ${d}` }));
    child.on('message', (msg) => {
      if (!msg || !msg.type) return;

      if (msg.type === 'statusUpdate') {
        windowManager.sendStatusToRenderer(msg);
        if (msg.status === 'CAPTCHA_DETECTADO' || msg.status === 'FALHA!') {
          workerLastStatus.set(accountId, { status: msg.status, log: msg.log });
        }
      } else if (msg.type === 'proxyStatusUpdate') {
        windowManager.sendProxyStatusToRenderer({ accountId: msg.accountId, proxyStatus: msg.proxyStatus });
      } else if (msg.type === 'dashboard-update') {
        windowManager.sendDashboardUpdateToRenderer(msg);
      } else if (msg.type === 'sessionUpdate') {
        if (msg.payload && msg.payload.cookies && msg.accountId) {
          try { store.set(`session-account-${msg.accountId}`, msg.payload.cookies); } catch (e) { console.error(e); }
        }
      } else if (msg.type === 'tokenUpdate') {
        try { store.set('authToken', msg.payload.newAccessToken); } catch (e) { console.error(e);
        }
        windowManager.sendTokenUpdateToRenderer(msg.accountId, msg.payload.newAccessToken);
      }
    });
    child.stdout.on('data', (d) => {
      const log = d.toString().trim();
      if (log.includes('CAPTCHA DETECTADO')) {
        workerLastStatus.set(accountId, { status: 'CAPTCHA_DETECTADO', log: log });
        windowManager.sendStatusToRenderer({ accountId: accountId, status: 'CAPTCHA_DETECTADO', log: log });
      }
    });
    child.on('error', (err) => {
      windowManager.sendStatusToRenderer({ accountId: accountId, status: 'FALHA!', log: `Erro Proc: ${err.message}` });
      activeWorkers.delete(accountId);
      workerLastStatus.delete(accountId);
    });
    child.on('exit', (code) => {
      if (activeWorkers.has(accountId)) {
        const lastStatusData = workerLastStatus.get(accountId);
        let finalStatus = code === 0 ? 'PARADO' : 'FALHA!';
        let logMsg = code === 0 ? 'Encerrado.' : `Encerrado erro (${code}).`;

        if (lastStatusData?.status === 'CAPTCHA_DETECTADO') {
          finalStatus = 'CAPTCHA_DETECTADO';
          logMsg = lastStatusData.log || 'Captcha detectado.';
        } else if (lastStatusData?.status === 'FALHA!') {
          finalStatus = 'FALHA!';
          logMsg = lastStatusData.log || `Falha (${code}).`;
        }

        windowManager.sendStatusToRenderer({ accountId: accountId, status: finalStatus, log: logMsg });
        activeWorkers.delete(accountId);
      }
      workerLastStatus.delete(accountId);
    });
    child.send({
      type: 'start',
      config: {
        accountId: accountId,
        session: sessionForWorker,
        region: account.region,
        tw_world: account.tw_world,
        villageId: account.villageid,
        authToken: authToken,
        refreshToken: refreshToken
      }
    });
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'INICIANDO...', log: 'Inicializando...' });
    return { success: true, message: 'Worker iniciado.' };
  } catch (execError) {
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'FALHA!', log: `Erro fork: ${execError.message}` });
    return { success: false, message: `Falha iniciar worker: ${execError.message}` };
  }
}

async function stopAutomation(accountId) {
  const workerProcess = activeWorkers.get(accountId);
  if (workerProcess) {
    try { workerProcess.send({ type: 'stop' }); } catch (e) { try { workerProcess.kill('SIGTERM');
    } catch (err) { } }
    workerLastStatus.delete(accountId);
    return { success: true, message: 'Stop enviado.' };
  } else {
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'PARADO', log: 'Já estava parado.' });
    return { success: false, code: 'NOT_RUNNING', message: 'Não ativo.' };
  }
}

async function startAuthentication(data) {
  const { accountId, region, proxyId } = data || {};
  if (!accountId) return { success: false, message: 'ID obrigatório.' };
  if (activeAuthWorkers.has(accountId)) {
    windowManager.sendAuthStatusToRenderer(accountId, 'Autenticação já em andamento.');
    return { success: false, message: 'Já em andamento.' };
  }

  return new Promise(async (resolve, reject) => {
    let proxyConfig = null;
    const loginUrl = region === 'br' ? 'https://www.tribalwars.com.br/' : 'https://www.tribalwars.com.pt/';
    const gameUrlPattern = `https://${region}*.tribalwars.*${region}/game.php*`;
    let authWorker;
    let timeoutId;

    try {
        if (proxyId) proxyConfig = await getProxyConfigFromServer(proxyId);

        authWorker = spawnWorkerProcess('authentication-worker.cjs');
        activeAuthWorkers.set(accountId, authWorker);

        authWorker.stdout.on('data', (data) => { });
        authWorker.stderr.on('data', (data) => { });

        timeoutId = setTimeout(() => {
          if (authWorker && activeAuthWorkers.has(accountId)) {
            activeAuthWorkers.delete(accountId);
            try { authWorker.kill('SIGTERM'); } catch (e) { }
            reject(new Error('Timeout na autenticação.'));
          }
        }, 300000);

        authWorker.on('message', async (message) => {
          if (!message || !message.type) return;

          if (message.type === 'status') {
            windowManager.sendAuthStatusToRenderer(accountId, message.payload?.message || 'Status...');
          } else if (message.type === 'result') {
            clearTimeout(timeoutId);
            const workerProcess = activeAuthWorkers.get(accountId);
            activeAuthWorkers.delete(accountId);

            if (message.payload?.success) {
              store.set(`session-account-${accountId}`, message.payload.cookies);
              try {
                if (message.payload.villageId) {
                  await api.patch(`/api/tw-accounts/${accountId}`, { villageId: String(message.payload.villageId) });
                }
              } catch (apiError) { console.error(apiError);
              }

              resolve({ success: true, message: 'Autenticado com sucesso.' });
            } else {
              reject(new Error(message.payload?.error || 'Erro desconhecido.'));
            }
            if (workerProcess) workerProcess.kill();
          }
        });

        authWorker.on('error', (err) => {
          clearTimeout(timeoutId);
          windowManager.sendAuthStatusToRenderer(accountId, `Erro crítico: ${err.message}`);
          activeAuthWorkers.delete(accountId);
          reject(new Error(err.message));
        });
        authWorker.on('exit', (code) => {
          clearTimeout(timeoutId);
          if (activeAuthWorkers.has(accountId)) {
            windowManager.sendAuthStatusToRenderer(accountId, `Worker falhou (${code})`);
            activeAuthWorkers.delete(accountId);
            reject(new Error(`Worker falhou (${code})`));
          }
        });
        authWorker.send({ type: 'start', config: { accountId, loginUrl, gameUrlPattern, proxyConfig } });
        windowManager.sendAuthStatusToRenderer(accountId, 'Abrindo navegador...');
    } catch (error) {
      if (authWorker) authWorker.kill();
      reject(error);
    }
  });
}

async function startVillageViewer(data) {
  const { account } = data || {};
  if (!account || !account.id) return { success: false, message: 'Conta inválida.' };
  const accountId = account.id;
  if (activeViewWorkers.has(accountId)) return { success: false, message: 'Já aberto.' };

  const automationWorker = activeWorkers.get(accountId);
  if (automationWorker) {
    preViewStatus.set(accountId, 'ON');
    automationWorker.kill();
    activeWorkers.delete(accountId);
  } else {
    preViewStatus.set(accountId, 'OFF');
  }

  windowManager.sendStatusToRenderer({ accountId: accountId, status: 'VISUALIZANDO', log: 'Abrindo...' });
  let child;
  try {
    const sessionDataCookies = store.get(`session-account-${accountId}`);
    if (!sessionDataCookies) {
      windowManager.sendStatusToRenderer({ accountId: accountId, status: 'SESSÃO_AUSENTE', log: 'Autentique.' });
      return { success: false, code: 'SESSION_MISSING', message: 'Sessão não encontrada.' };
    }

    let proxyConfig = null;
    if (account.proxy_id) proxyConfig = await getProxyConfigFromServer(account.proxy_id);

    const domain = account.region === 'br' ? 'com.br' : 'com.pt';
    const gameUrl = `https://${account.region}${account.tw_world}.tribalwars.${domain}/game.php?screen=overview`;
    child = spawnWorkerProcess('village_viewer_worker.cjs');
    activeViewWorkers.set(accountId, child);

    child.on('message', async (msg) => {
      if (msg.type === 'village-viewer-result') {
        const originalStatus = preViewStatus.get(accountId);
        if (msg.payload.shouldRestart && originalStatus === 'ON') {
          startAutomation(account);
        } else if (msg.payload.success) {
          windowManager.sendStatusToRenderer({ accountId: accountId, status: 'PARADO', log: 'Fim visualização.' });
        }
        
        activeViewWorkers.delete(accountId);
      } else if (msg.type === 'statusUpdate') {
        windowManager.sendStatusToRenderer(msg);
      }
    });
    child.on('exit', async (code) => {
      if (activeViewWorkers.has(accountId)) {
        const originalStatus = preViewStatus.get(accountId);
        if (code === 0 && originalStatus === 'ON') {
          startAutomation(account);
        } else if (code === 0 && originalStatus === 'OFF') {
          windowManager.sendStatusToRenderer({ accountId: accountId, status: 'PARADO', log: 'Fim visualização.' });
        } else {
          windowManager.sendStatusToRenderer({ accountId: accountId, status: 'FALHA!', log: `View caiu (${code}).` });
        }
        activeViewWorkers.delete(accountId);
      }
    });
    child.send({ type: 'start', config: { accountId, gameUrl, cookies: sessionDataCookies, proxyConfig } });
    return { success: true, message: 'Visualizador aberto.' };
  } catch (error) {
    if (child) child.kill();
    windowManager.sendStatusToRenderer({ accountId: accountId, status: 'FALHA!', log: `Erro: ${error.message}` });
    const originalStatus = preViewStatus.get(accountId);
    if (originalStatus === 'ON') startAutomation(account).catch(e => console.error(e));
    return { success: false, message: error.message };
  }
}

function shutdownAllWorkers() {
  const allMaps = [activeWorkers, activeAuthWorkers, activeViewWorkers];
  allMaps.forEach(map => {
    map.forEach(worker => {
      if (worker && !worker.killed) worker.kill('SIGTERM');
    });
    map.clear();
  });
}

module.exports = {
  initWorkerManager,
  startAutomation,
  stopAutomation,
  startAuthentication,
  startVillageViewer,
  shutdownAllWorkers
};