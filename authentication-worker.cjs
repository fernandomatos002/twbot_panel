const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let config = null;
let browser = null;
let context = null;
let page = null;
let isExiting = false;

function sendStatus(message) {
    if (!config?.accountId || !process.connected || isExiting) {
        return;
    }
    try {
        process.send({
            type: 'status',
            payload: { message }
        });
    } catch (ipcError) {
        console.warn(`[AuthWorker-${config.accountId}] Falha ao enviar status IPC: ${ipcError.message}`);
    }
}

async function sendResultAndExit(payload) {
    if (isExiting) return;
    isExiting = true;

    if (page) {
        try { await page.close(); } catch (e) { }
        page = null;
    }
    if (context) {
        try { await context.close(); } catch (e) { }
        context = null;
    }
    if (browser) {
        try { await browser.close(); } catch (e) { }
        browser = null;
    }

    if (process.connected) {
        try {
            process.send({ type: 'result', payload });
        } catch (ipcError) {
            console.error(`[AuthWorker-${config?.accountId || 'UKN'}] Falha ao enviar resultado IPC: ${ipcError.message}`);
        }
    }

    process.exit(payload.success ? 0 : 1);
}

async function runAuthentication(receivedConfig) {
    config = receivedConfig;
    const { accountId, loginUrl, gameUrlPattern, proxyConfig } = config;

    if (!accountId || !loginUrl || !gameUrlPattern) {
        await sendResultAndExit({ success: false, error: 'Configuração inválida.' });
        return;
    }

    try {
        sendStatus('Abrindo navegador...');
        browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            proxy: proxyConfig || undefined
        });

        browser.on('disconnected', async () => {
            if (!isExiting) {
                await sendResultAndExit({ success: false, error: 'Autenticação cancelada (navegador fechado).' });
            }
        });

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        });

        page = await context.newPage();

        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        sendStatus('Aguardando login manual na janela do navegador...');
        
        const navigationTimeout = 300000;
        await page.waitForURL(new RegExp(gameUrlPattern.replace(/\*/g, '.*')), { timeout: navigationTimeout });

        sendStatus('Login detectado! Extraindo dados da aldeia...');
        await page.waitForTimeout(2000);

        let villageData = null;
        try {
            await page.waitForFunction("window.game_data && window.game_data.village && window.game_data.village.id", { timeout: 15000 });
            
            villageData = await page.evaluate(`
                (() => {
                    if (window.game_data && window.game_data.village) {
                        return {
                            id: window.game_data.village.id,
                            name: window.game_data.village.name
                        };
                    }
                    return null;
                })()
            `);
        } catch (waitError) {
             try {
                const screenshotsDir = path.join(process.cwd(), 'screenshots');
                if (!fs.existsSync(screenshotsDir)){
                    fs.mkdirSync(screenshotsDir);
                }
                const screenshotPath = path.join(screenshotsDir, `error_no_gamedata_${accountId}_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath });
             } catch(ssError) { }
             throw new Error(`Não foi possível encontrar os dados da aldeia: ${waitError.message}`);
        }

        if (!villageData || !villageData.id) {
             throw new Error('Login detectado, mas não foi possível extrair o ID da aldeia (retornou nulo).');
        }

        sendStatus('Salvando sessão...');
        await page.waitForTimeout(1000);

        const cookies = await context.cookies();
        if (!cookies || cookies.length === 0) {
            throw new Error('Login detectado, mas não foi possível extrair os cookies.');
        }

        const finalPayload = {
            success: true,
            cookies: cookies,
            villageId: villageData.id
        };

        await sendResultAndExit(finalPayload);

    } catch (error) {
        let errorMessage = error.message;
        
        try {
            if (page && !page.isClosed()){
                const screenshotsDir = path.join(process.cwd(), 'screenshots');
                if (!fs.existsSync(screenshotsDir)){
                    fs.mkdirSync(screenshotsDir);
                }
                const screenshotPath = path.join(screenshotsDir, `error_general_auth_${accountId}_${Date.now()}.png`);
                await page.screenshot({ path: screenshotPath });
            }
         } catch(ssError) { }

        if (error.name === 'TimeoutError' && error.message.includes('waitForURL')) {
            errorMessage = 'Tempo limite excedido para login.';
        } else if (error.message.includes('browser has been closed')) {
            errorMessage = 'Autenticação cancelada (navegador fechado).';
        }

        await sendResultAndExit({ success: false, error: errorMessage });
    }
}

process.on('message', (message) => {
    if (isExiting) return;

    if (message?.type === 'start') {
        if (message.config) {
            runAuthentication(message.config).catch(async (err) => {
                await sendResultAndExit({ success: false, error: `Erro fatal: ${err.message || err}` });
            });
        } else {
            sendResultAndExit({ success: false, error: 'Configuração ausente.' });
        }
    }
});

process.on('uncaughtException', async (error) => {
    await sendResultAndExit({ success: false, error: `Erro fatal não capturado: ${error.message}` });
});

process.on('SIGTERM', async () => {
    await sendResultAndExit({ success: false, error: 'Processo terminado externamente.' });
});