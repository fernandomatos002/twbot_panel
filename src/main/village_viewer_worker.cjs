const { chromium } = require('playwright');

let chromiumInstance;
try {
    chromiumInstance = chromium;
    if (!chromiumInstance) {
        throw new Error('Chromium nulo.');
    }
} catch (error) {
    if (process.connected) {
        try {
            process.send({
                type: 'village-viewer-result',
                payload: {
                    success: false,
                    accountId: 'UKN',
                    error: `Playwright erro: ${error.message}`,
                    shouldRestart: false
                }
            });
        } catch (ipcErr) {}
    }
    process.exit(1);
}

let config = null;
let browser = null;
let isExiting = false;
let monitorIntervalId = null;

async function sendResultAndExit(payload) {
    const accountId = config?.accountId || 'UKN';

    if (isExiting) return;
    isExiting = true;

    if (monitorIntervalId) {
        clearInterval(monitorIntervalId);
        monitorIntervalId = null;
    }

    if (browser) {
        try { await browser.close(); } catch (e) {}
        browser = null;
    }

    if (process.connected) {
        try {
            const finalPayload = {
                ...payload,
                accountId: accountId,
                shouldRestart: payload.shouldRestart !== undefined ? payload.shouldRestart : payload.success
            };
            process.send({
                type: 'village-viewer-result',
                payload: finalPayload
            });
        } catch (ipcError) { }
    }
    process.exit(payload.success ? 0 : 1);
}

function startBrowserMonitor() {
    monitorIntervalId = setInterval(async () => {
        if (isExiting) {
            clearInterval(monitorIntervalId);
            monitorIntervalId = null;
            return;
        }
        if (browser) {
            try {
                const isConnected = browser.isConnected();
                if (!isConnected) {
                    await sendResultAndExit({ success: true, message: 'Visualizador fechado (monitor).', shouldRestart: true });
                }
            } catch (e) {
                await sendResultAndExit({ success: true, message: `Visualizador fechado (erro monitor: ${e.message}).`, shouldRestart: true });
            }
        } else {
            await sendResultAndExit({ success: true, message: 'Visualizador fechado (navegador nulo).', shouldRestart: true });
        }
    }, 3000);
}

async function runVillageViewer(receivedConfig) {
    config = receivedConfig;
    const { accountId, gameUrl, cookies, proxyConfig } = config;
    if (!accountId || !gameUrl || !cookies || cookies.length === 0) {
        await sendResultAndExit({ success: false, error: 'Configuração inválida.', shouldRestart: false });
        return;
    }

    try {
        browser = await chromiumInstance.launch({
            headless: false,
            proxy: proxyConfig || undefined
        });

        browser.on('disconnected', async () => {
            if (!isExiting) {
                await sendResultAndExit({ success: true, message: 'Visualizador fechado (browser desconectado).', shouldRestart: true });
            }
        });

        const context = await browser.newContext();
        await context.addCookies(cookies);

        const page = await context.newPage();
        page.on('close', async () => {
            if (!isExiting) {
                await sendResultAndExit({ success: true, message: 'Visualizador fechado pelo usuário.', shouldRestart: true });
            }
        });

        await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const currentUrl = page.url();
        const isLoggedIn = currentUrl.includes('/game.php');
        if (!isLoggedIn) {
            throw new Error('Sessão inválida ou expirada.');
        }

        startBrowserMonitor();

    } catch (error) {
        let errorMessage = error.message;
        let shouldRestartOnFail = false;

        if (error.message.includes('Sessão inválida ou expirada')) {
            errorMessage = error.message;
            shouldRestartOnFail = false;
        } else if (error.name === 'TimeoutError') {
            errorMessage = 'Tempo limite excedido.';
            shouldRestartOnFail = true;
        } else if (error.message.includes('browser has been closed') || error.message.includes('Target closed')) {
            if (!isExiting) {
                await sendResultAndExit({ success: true, message: 'Visualizador interrompido.', shouldRestart: true });
            }
            return;
        }

        await sendResultAndExit({ success: false, error: errorMessage, shouldRestart: shouldRestartOnFail });
    }
}

process.on('message', (message) => {
    if (isExiting) return;

    if (message?.type === 'start') {
        if (message.config) {
            runVillageViewer(message.config).catch(async (err) => {
                await sendResultAndExit({ success: false, error: `Erro fatal: ${err.message}`, accountId: message.config?.accountId || 'UKN', shouldRestart: false });
            });
        } else {
            sendResultAndExit({ success: false, error: 'Configuração ausente.', shouldRestart: false });
        }
    }
});

process.on('uncaughtException', async (error) => {
    await sendResultAndExit({ success: false, error: `Erro fatal não capturado: ${error.message}`, accountId: config?.accountId || 'UKN', shouldRestart: false });
});

process.on('unhandledRejection', async (reason, promise) => {
    await sendResultAndExit({ success: false, error: `Erro assíncrono fatal: ${reason instanceof Error ? reason.message : reason}`, accountId: config?.accountId || 'UKN', shouldRestart: false });
});

process.on('SIGTERM', async () => {
    if (!isExiting) {
        await sendResultAndExit({ success: true, message: 'Worker encerrado por SIGTERM.', shouldRestart: true });
    }
});