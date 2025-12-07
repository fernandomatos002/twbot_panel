// src/preload/preload.cjs (v21) - Adiciona Handlers de Recrutamento
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  login: async (credentials) => {
    console.log('{preload] Recebido pedido de login:', credentials);
    try {
      const result = await ipcRenderer.invoke('login', credentials);
      console.log('{preload] Resultado do invoke("login"):', result);
      return result;
    } catch (error) {
      console.error('{preload] Erro durante invoke("login"):', error);
      throw error;
    }
  },

  register: async (userData) => {
    // (Adicionar logs aqui se necessário)
    return ipcRenderer.invoke('register', userData);
  },

  // **** NOVO: Função para o App.jsx pedir um novo Access Token ****
  refreshToken: async (token) => {
    console.log('{preload] Solicitando refresh do token...');
    return ipcRenderer.invoke('refreshToken', token);
  },

  // **** NOVO: Função para o App.jsx invalidar o Refresh Token no logout ****
  logout: async (refreshToken) => {
    console.log('{preload] Solicitando logout (invalidar refresh token)...');
    return ipcRenderer.invoke('logout', refreshToken);
  },

  // BUSCA DE DADOS
  fetchDashboardData: async (token) => {
    // (Adicionar logs aqui se necessário)
    return ipcRenderer.invoke('fetchDashboardData', token);
  },

  // GESTÃO DE CONTAS TW
  addTwAccount: async (data) => {
    console.log('{preload] addTwAccount recebendo:', data);
    return ipcRenderer.invoke('addTwAccount', data);
  },

  deleteTwAccount: async (data) => {
    return ipcRenderer.invoke('deleteTwAccount', data);
  },

  // NOVO: Método para atualizar a conta (ex: proxy)
  updateTwAccount: async (accountId, data) => {
    console.log(`{preload] updateTwAccount para ID ${accountId} com dados:`, data);
    return ipcRenderer.invoke('update-tw-account', accountId, data);
  },

  authenticateAccount: async (data) => {
    return ipcRenderer.invoke('authenticateAccount', data);
  },

  // GESTÃO DE PROXY
  addProxies: async (data) => {
    return ipcRenderer.invoke('addProxies', data);
  },

  deleteProxy: async (data) => {
    return ipcRenderer.invoke('deleteProxy', data);
  },

  // =================================================================
  // GESTÃO DE AUTOMAÇÃO (LOCAL) - start e stop
  // =================================================================
  startAutomation: async (data) => {
    console.log('{preload] Chamando start-automation para conta:', data.accountId);
    return ipcRenderer.invoke('start-automation', data);
  },

  stopAutomation: async (accountId) => {
    console.log('{preload] Chamando stop-automation para conta:', accountId);
    return ipcRenderer.invoke('stop-automation', accountId);
  },

  startVillageViewer: async (data) => {
    console.log('{preload] Chamando startVillageViewer para conta:', data.account.id);
    return ipcRenderer.invoke('startVillageViewer', data);
  },

  // --- Listas de Construção ---
  fetchConstructionLists: (token) => ipcRenderer.invoke('fetchConstructionLists', token),
  createConstructionList: (token, listData) => ipcRenderer.invoke('createConstructionList', token, listData),
  updateConstructionList: (token, listId, listData) => ipcRenderer.invoke('updateConstructionList', token, listId, listData),
  deleteConstructionList: (token, listId) => ipcRenderer.invoke('deleteConstructionList', token, listId),

  // --- Grupos ---
  fetchGroups: (token) => ipcRenderer.invoke('fetchGroups', token),
  createGroup: (token, groupData) => ipcRenderer.invoke('createGroup', token, groupData),
  updateGroup: (token, groupId, groupData) => ipcRenderer.invoke('updateGroup', token, groupId, groupData),
  deleteGroup: (token, groupId) => ipcRenderer.invoke('deleteGroup', token, groupId),
  
  // --- (v21) INÍCIO DA MODIFICAÇÃO (Templates de Recrutamento) ---
  fetchRecruitmentTemplates: (token) => ipcRenderer.invoke('fetchRecruitmentTemplates', token),
  createRecruitmentTemplate: (token, templateData) => ipcRenderer.invoke('createRecruitmentTemplate', token, templateData),
  updateRecruitmentTemplate: (token, templateId, templateData) => ipcRenderer.invoke('updateRecruitmentTemplate', token, templateId, templateData),
  deleteRecruitmentTemplate: (token, templateId) => ipcRenderer.invoke('deleteRecruitmentTemplate', token, templateId),
  // --- (v21) FIM DA MODIFICAÇÃO ---

  // =================================================================
  // LISTENERS (Eventos do Main para o Renderer)
  // =================================================================

  onAutomationStatusUpdate: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('automation-status-update', listener);
    return () => ipcRenderer.removeListener('automation-status-update', listener);
  },

  onProxyStatusUpdate: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('automation-proxy-status-update', listener);
    return () => ipcRenderer.removeListener('automation-proxy-status-update', listener);
  },

  onDashboardUpdate: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('dashboard-update', listener);
    return () => ipcRenderer.removeListener('dashboard-update', listener);
  },

  onTokenWasUpdated: (callback) => {
    const channel = 'token:updated'; 
    const listener = (_event, data) => {
      console.log('{preload] Recebido evento token:updated do main process.');
      callback(data); 
    };
    
    ipcRenderer.on(channel, listener);

    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  }
});