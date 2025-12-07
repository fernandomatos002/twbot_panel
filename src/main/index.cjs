require('bytenode');

if (process.env.IS_WORKER_PROCESS === 'true' && process.env.WORKER_TARGET_PATH) {
  require(process.env.WORKER_TARGET_PATH);
  return;
}

const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

if (app.isPackaged) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(process.resourcesPath, 'browsers');
} else {

    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '../../browsers');
}

console.log(`[Main] Browsers Path: ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);

function loadModule(moduleName) {
  const jscPath = path.join(__dirname, `${moduleName}.jsc`);
  if (fs.existsSync(jscPath)) {
    return require(jscPath);
  }
  return require(`./${moduleName}.cjs`);
}

const windowManager = loadModule('windowManager');
const { api, authApi, initApiService } = loadModule('apiService');
const workerManager = loadModule('workerManager');

const isDev = process.env.NODE_ENV === 'development';
const store = new Store({ name: 'twbot-data' });

app.whenReady().then(async () => {
  windowManager.createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
    }
  });

  const WORKERS_PATH = __dirname;
  const BACKEND_BASE_URL = process.env.BACKEND_URL || 'http://157.173.106.162:5000';

  initApiService({
    store: store,
    windowManager: windowManager,
    backendUrl: BACKEND_BASE_URL
  });

  workerManager.initWorkerManager({
    store: store,
    windowManager: windowManager,
    api: api,
    WORKERS_PATH: WORKERS_PATH,
    isDev: isDev
  });

  ipcMain.handle('refreshToken', (event, refreshToken) => {
    return authApi.post('/api/auth/refresh', { refreshToken })
      .then(response => ({ success: true, ...response.data }))
      .catch(error => {
        return { success: false, message: error.response?.data?.message || error.message };
      });
  });

  ipcMain.handle('logout', (event, refreshToken) => {
    return authApi.post('/api/auth/logout', { refreshToken })
      .then(() => ({ success: true }))
      .catch(error => {
        return { success: false };
      });
  });

  ipcMain.handle('login', async (event, credentials) => {
    try {
      if (!credentials || !credentials.identifier || !credentials.password) {
        return { success: false, message: 'Credenciais incompletas.' };
      }
      const response = await authApi.post('/api/auth/login', credentials);
      if (response.data?.success && response.data.accessToken && response.data.refreshToken) {
        store.set('authToken', response.data.accessToken);
        store.set('refreshToken', response.data.refreshToken);
        return { success: true, data: response.data };
      }
      return { success: false, message: response.data?.message || 'Falha no login (servidor).' };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || `Falha comunicação (${error.code || 'N/A'}).` };
    }
  });

  ipcMain.handle('register', async (event, userData) => {
    try {
      if (!userData || !userData.email || !userData.password) {
        return { success: false, message: 'Dados incompletos.' };
      }
      const response = await authApi.post('/api/auth/register', userData);
      return response.data;
    } catch (error) {
      return { success: false, message: error.response?.data?.message || `Falha comunicação (${error.code || 'N/A'}).` };
    }
  });

  const createDirectApiHandler = (ipcName, apiCall) => {
    ipcMain.handle(ipcName, async (event, ...args) => {
      try {
        const response = await apiCall(...args.filter(arg => typeof arg !== 'object' || (arg && typeof arg.sender === 'undefined')));
        return response.data;
      } catch (error) {
        if (error.response?.status === 401) {
          return { success: false, code: 'UNAUTHORIZED', message: 'Token inválido ou expirado.' };
        }
        return { success: false, message: error.response?.data?.message || `Falha (${error.code || 'N/A'}).` };
      }
    });
  };

  ipcMain.handle('fetchDashboardData', async () => {
    try {
      const response = await api.get('/api/data/dashboard-data');
      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 401) {
        return { success: false, code: 'UNAUTHORIZED', message: 'Token inválido ou expirado.' };
      }
      return { success: false, message: error.response?.data?.message || `Falha (${error.code || 'N/A'}).` };
    }
  });

  createDirectApiHandler('addTwAccount', (data) => api.post('/api/tw-accounts', data));
  createDirectApiHandler('deleteTwAccount', ({ accountId }) => api.delete(`/api/tw-accounts/${accountId}`));
  createDirectApiHandler('update-tw-account', (accountId, data) => api.patch(`/api/tw-accounts/${accountId}`, data));
  createDirectApiHandler('addProxies', ({ proxies }) => api.post('/api/proxies/add-batch', { proxies }));
  createDirectApiHandler('deleteProxy', ({ proxyId }) => api.delete(`/api/proxies/delete/${proxyId}`));
  createDirectApiHandler('fetchConstructionLists', () => api.get('/api/construction-lists'));
  createDirectApiHandler('createConstructionList', (token, listData) => api.post('/api/construction-lists', listData));
  createDirectApiHandler('updateConstructionList', (token, listId, listData) => api.put(`/api/construction-lists/${listId}`, listData));
  createDirectApiHandler('deleteConstructionList', (token, listId) => api.delete(`/api/construction-lists/${listId}`));
  createDirectApiHandler('fetchRecruitmentTemplates', () => api.get('/api/recruitment-templates'));
  createDirectApiHandler('createRecruitmentTemplate', (token, templateData) => api.post('/api/recruitment-templates', templateData));
  createDirectApiHandler('updateRecruitmentTemplate', (token, templateId, templateData) => api.put(`/api/recruitment-templates/${templateId}`, templateData));
  createDirectApiHandler('deleteRecruitmentTemplate', (token, templateId) => api.delete(`/api/recruitment-templates/${templateId}`));
  createDirectApiHandler('fetchGroups', () => api.get('/api/groups'));
  createDirectApiHandler('createGroup', (token, groupData) => api.post('/api/groups', { name: groupData.name }));
  createDirectApiHandler('updateGroup', (token, groupId, groupData) => api.put(`/api/groups/${groupId}`, groupData));
  createDirectApiHandler('deleteGroup', (token, groupId) => api.delete(`/api/groups/${groupId}`));

  ipcMain.handle('authenticateAccount', async (event, data) => {
    return workerManager.startAuthentication(data);
  });

  ipcMain.handle('start-automation', async (event, data) => {
    const { account } = data || {};
    if (!account || !account.id) {
      return { success: false, message: 'Dados da conta inválidos.' };
    }
    return workerManager.startAutomation(account);
  });

  ipcMain.handle('stop-automation', async (event, accountId) => {
    return workerManager.stopAutomation(accountId);
  });

  ipcMain.handle('startVillageViewer', async (event, data) => {
    return workerManager.startVillageViewer(data);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    workerManager.shutdownAllWorkers();
    app.quit();
  }
});