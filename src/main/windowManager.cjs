// src/main/windowManager.cjs
// (v30) - Versão Final Corrigida para Produção/Dev

const { BrowserWindow, screen, app } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

/**
 * Cria a janela principal da aplicação.
 */
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const { x, y } = primaryDisplay.workArea;

  // --- 1. DEFINIÇÃO DO CAMINHO DO PRELOAD ---
  let preloadPath;

  if (app.isPackaged) {
    // EM PRODUÇÃO (Arquivo .exe instalado):
    // A estrutura interna do ASAR geralmente é:
    // /resources/app.asar/dist/main/windowManager.jsc (onde estamos)
    // /resources/app.asar/dist/preload/preload.cjs (onde queremos ir)
    preloadPath = path.join(__dirname, '../preload/preload.cjs');
  } else {
    // EM DESENVOLVIMENTO (Rodando npm run dev):
    // Geralmente src/main/windowManager.cjs
    // Queremos ir para src/preload/preload.cjs
    preloadPath = path.join(__dirname, '../preload/preload.cjs');
  }

  // Verifica se o preload existe (útil para debug)
  if (!fs.existsSync(preloadPath)) {
    console.error(`[WindowManager] ERRO CRÍTICO: Preload não encontrado em: ${preloadPath}`);
  } else {
    console.log(`[WindowManager] Preload definido para: ${preloadPath}`);
  }

  // --- 2. CRIAÇÃO DA JANELA ---
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: x,
    y: y,
    show: false, // Só mostra quando estiver pronta para evitar piscar
    frame: true,
    maximizable: true,
    webPreferences: {
      preload: preloadPath, // Caminho calculado acima
      nodeIntegration: false, // Segurança: Desabilitado
      contextIsolation: true, // Segurança: Habilitado
      sandbox: false // Necessário para alguns requires no preload
    }
  });

  // --- 3. CARREGAMENTO DO CONTEÚDO (HTML ou SERVIDOR) ---
  // Verifica se estamos em DEV (usando variável de ambiente ou argumento)
  const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));

  if (isDev) {
    // MODO DEV: Carrega o servidor do Vite
    console.log('[WindowManager] Modo DEV detectado. Carregando http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173').catch(e => {
      console.error('[WindowManager] Erro ao carregar URL de Dev:', e);
    });
    // Abre o Inspetor (F12) automaticamente em Dev
    // mainWindow.webContents.openDevTools(); 
  } else {
    // MODO PROD: Carrega o arquivo compilado
    // Estamos em: .../dist/main/
    // O HTML está em: .../dist-renderer/index.html
    const htmlPath = path.join(__dirname, '../../dist-renderer/index.html');
    
    console.log(`[WindowManager] Modo PROD. Carregando arquivo: ${htmlPath}`);
    
    mainWindow.loadFile(htmlPath).catch(e => {
      console.error('[WindowManager] Erro ao carregar index.html:', e);
    });
  }

  // --- 4. EVENTOS DA JANELA ---
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[WindowManager] O processo da interface (Renderer) travou!');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Retorna a instância atual da janela.
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * Verifica se a janela existe e não foi destruída.
 */
function isWindowAvailable() {
  return mainWindow && mainWindow.webContents && !mainWindow.isDestroyed();
}

// --- FUNÇÕES DE COMUNICAÇÃO (ENVIAR DADOS PARA O FRONTEND) ---

function sendStatusToRenderer(statusData) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('automation-status-update', statusData);
  }
}

function sendProxyStatusToRenderer(statusData) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('automation-proxy-status-update', statusData);
  }
}

function sendDashboardUpdateToRenderer(dashboardData) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('dashboard-update', dashboardData);
  }
}

function sendAuthStatusToRenderer(accountId, message) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('automation-status-update', {
      type: 'statusUpdate',
      accountId: accountId,
      status: 'AUTENTICANDO',
      log: message,
      timestamp: new Date().toISOString()
    });
  }
}

function sendTokenUpdateToRenderer(accountId, newAccessToken) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('token:updated', {
      accountId: accountId,
      newAccessToken: newAccessToken
    });
  }
}

function sendForceLogout(message) {
  if (isWindowAvailable()) {
    mainWindow.webContents.send('force-logout', message);
  }
}

// Exporta tudo para ser usado no index.cjs e workerManager.cjs
module.exports = {
  createWindow,
  getMainWindow,
  sendStatusToRenderer,
  sendProxyStatusToRenderer,
  sendDashboardUpdateToRenderer,
  sendAuthStatusToRenderer,
  sendTokenUpdateToRenderer,
  sendForceLogout
};