// src/main/authentication-worker.cjs
const { chromium } = require('playwright'); [cite_start]// [cite: 3]
const fs = require('fs');
const path = require('path');

let config = null;
let browser = null;
let context = null;
let page = null;
let isExiting = false;

// ... (Funções auxiliares sendStatus e sendResultAndExit mantidas iguais) ...
function sendStatus(message) {
    if (!config?.accountId || !process.connected || isExiting) return;
    try { process.send({ type: 'status', payload: { message } }); } catch (e) {}
}

async function sendResultAndExit(payload) {
    if (isExiting) return;
    isExiting = true;
    if (page) try { await page.close(); } catch (e) {}
    if (context) try { await context.close(); } catch (e) {}
    if (browser) try { await browser.close(); } catch (e) {}
    if (process.connected) try { process.send({ type: 'result', payload }); } catch (e) {}
    process.exit(payload.success ? 0 : 1);
}

async function runAuthentication(receivedConfig) {
    config = receivedConfig;
    const { accountId, loginUrl, gameUrlPattern, proxyConfig } = config;

    if (!accountId || !loginUrl) {
        await sendResultAndExit({ success: false, error: 'Configuração inválida.' });
        return;
    }

    try {
        sendStatus('Abrindo navegador...');
        console.log(`[AuthWorker-${accountId}] Tentando lançar navegador (Google Chrome)...`);

        // --- CORREÇÃO AQUI ---
        browser = await chromium.launch({
            headless: false,
            channel: 'chrome', // <--- FORÇA O USO DO CHROME INSTALADO
            proxy: proxyConfig || undefined
        });
        // ---------------------

        browser.on('disconnected', async () => {
            if (!isExiting) await sendResultAndExit({ success: false, error: 'Navegador fechado.' });
        });

        context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        page = await context.newPage();

        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        sendStatus('Aguardando login manual...');

        // Espera login (timeout 5 min)
        await page.waitForURL(new RegExp(gameUrlPattern.replace(/\*/g, '.*')), { timeout: 300000 });

        sendStatus('Login detectado! Extraindo dados...');
        await page.waitForTimeout(1000);

        // Extrai ID da aldeia
        const villageData = await page.evaluate(() => {
            return (window.game_data && window.game_data.village) ? { id: window.game_data.village.id } : null;
        });

        if (!villageData) throw new Error('Falha ao obter ID da aldeia.');

        const cookies = await context.cookies();
        await sendResultAndExit({ success: true, cookies: cookies, villageId: villageData.id });

    } catch (error) {
        console.error(`[AuthWorker] Erro: ${error.message}`);
        
        let msg = error.message;
        if (msg.includes('Executable doesn\'t exist') || msg.includes('browserType.launch')) {
            msg = 'Erro: Google Chrome não encontrado. Por favor, instale o Google Chrome.';
        } else if (msg.includes('Target closed')) {
            msg = 'Navegador fechado manualmente.';
        }
        
        await sendResultAndExit({ success: false, error: msg });
    }
}

process.on('message', (msg) => {
    if (msg?.type === 'start' && msg.config) runAuthentication(msg.config);
});