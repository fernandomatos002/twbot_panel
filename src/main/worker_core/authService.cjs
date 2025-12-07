const chromium = require('playwright-extra').chromium;
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const { sleep, testProxy } = require('../utils/helpers.cjs');
const ipcService = require('./ipcService.cjs');

async function loginAndSelectWorld(config) {
    const { session, region, tw_world, villageId, accountId } = config;
    const proxyConfig = session.proxy;
    let browser, context, page;

    try {
        const contextOptions = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            proxy: undefined 
        };

        if (proxyConfig && proxyConfig.server) {
            console.log(`[authService-${accountId}] Configurando proxy: ${proxyConfig.server}`);
            const proxySettings = {
                server: proxyConfig.server, 
                username: proxyConfig.username,
                password: proxyConfig.password
            };
            ipcService.sendStatus('INICIANDO...', 'Testando proxy...');
            
            const isProxyOk = await testProxy(proxySettings, accountId);
            if (!isProxyOk) {
                ipcService.sendProxyStatus('invalid');
                throw new Error('Falha na conexão com o proxy.');
            }
            
            ipcService.sendProxyStatus('valid');
            contextOptions.proxy = proxySettings;
        } else {
            ipcService.sendProxyStatus('not_used');
        }

        ipcService.sendStatus('INICIANDO...', 'Lançando navegador...');
        browser = await chromium.launch({ 
            headless: true
        });

        context = await browser.newContext(contextOptions);
        await context.addCookies(session.cookies);
        await sleep(500);
        page = await context.newPage();

        const loginUrl = region === 'br' ? 'https://www.tribalwars.com.br' : 'https://www.tribalwars.com.pt';
        ipcService.sendStatus('INICIANDO...', `Navegando para ${loginUrl}...`);
        await page.goto(loginUrl, { waitUntil: 'load', timeout: 30000 });

        try {
            ipcService.sendStatus('INICIANDO...', 'Verificando login inicial...');
            await page.waitForSelector('a[href="/page/logout"]', { timeout: 30000 });
            console.log(`[authService-${accountId}] Link de logout encontrado.`);
        } catch (logoutLinkError) {
            throw new Error('Falha ao verificar login (link de logout não encontrado). Autentique manualmente.');
        }

        console.log(`[authService-${accountId}] Verificando seleção de mundo ou jogo...`);
        const worldSelector = `a.world-select[href="/page/play/${region}${tw_world}"]`;
        const gameSelector = '#header_info';
        const raceTimeout = 30000;

        try {
            const winner = await Promise.race([
                page.waitForSelector(worldSelector, { state: 'attached', timeout: raceTimeout }).then(() => 'world_select'),
                page.waitForSelector(gameSelector, { state: 'visible', timeout: raceTimeout }).then(() => 'in_game')
            ]);

            if (winner === 'world_select') {
                await handleWorldSelect(page, worldSelector, gameSelector, accountId, villageId);
            } else if (winner === 'in_game') {
                await handleAlreadyInGame(page, gameSelector, accountId, villageId);
            }

        } catch (raceError) {
            console.error(`[authService-${accountId}] Erro na seleção de mundo ou bônus:`, raceError);
            throw new Error(`Timeout ou falha após login: ${raceError.message}`);
        }

        try {
            const currentCookies = await context.cookies();
            if (currentCookies && currentCookies.length > 0) {
                ipcService.sendSessionUpdate(currentCookies);
            }
        } catch (cookieError) {
            console.error(`[authService-${accountId}] Erro ao obter/enviar cookies atualizados:`, cookieError);
        }

        return { browser, context, page };

    } catch (error) {
        if (page) await page.close().catch(e => {});
        if (context) await context.close().catch(e => {});
        if (browser) await browser.close().catch(e => {});
        throw error;
    }
}

async function handleWorldSelect(page, worldSelector, gameSelector, accountId, villageId) {
    console.log(`[authService-${accountId}] Selecionando mundo...`);
    ipcService.sendStatus('INICIANDO...', `Selecionando mundo...`);
    const worldLinkHandle = await page.waitForSelector(worldSelector, { state: 'attached', timeout: 15000 });

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
        worldLinkHandle.click({ timeout: 15000, force: true })
    ]);
    console.log(`[authService-${accountId}] Navegação de mundo concluída.`);

    const dailyBonusPopupSelector = '#popup_box_daily_bonus';
    const openBonusButtonLocator = page.locator(dailyBonusPopupSelector).locator('a.btn', { hasText: 'Abrir' });
    const closeBonusButtonLocator = page.locator(`${dailyBonusPopupSelector} .popup_box_close`);

    try {
        console.log(`[authService-${accountId}] Verificando Bônus Diário (7s)...`);
        await page.waitForSelector(dailyBonusPopupSelector, { state: 'visible', timeout: 7000 });
        
        console.log(`[authService-${accountId}] Bônus Diário detectado.`);
        ipcService.sendStatus('EM_EXECUÇÃO', 'Lidando com bônus diário...');
        
        const bonusDisappearPromise = page.waitForSelector(dailyBonusPopupSelector, { state: 'hidden', timeout: 60000 });
        try {
            await openBonusButtonLocator.waitFor({ state: 'visible', timeout: 10000 });
            await openBonusButtonLocator.click({ timeout: 15000, force: true });
            console.log(`[authService-${accountId}] Bônus 'Abrir' clicado.`);
        } catch (buttonClickError) {
            console.warn(`[authService-${accountId}] Falha ao clicar 'Abrir'. Tentando fechar popup.`);
            if (await closeBonusButtonLocator.isVisible({ timeout: 3000 })) {
                await closeBonusButtonLocator.click({ timeout: 5000, force: true });
            }
        }
        await bonusDisappearPromise;
        console.log(`[authService-${accountId}] Popup de Bônus fechado.`);
        await sleep(1000);
    } catch (bonusError) {
        if (bonusError.name === 'TimeoutError') {
            console.log(`[authService-${accountId}] Bônus Diário NÃO detectado.`);
        } else {
            throw bonusError;
        }
    }

    await page.waitForSelector(gameSelector, { timeout: 30000 });
    await handleAlreadyInGame(page, gameSelector, accountId, villageId, true);
}

async function handleAlreadyInGame(page, gameSelector, accountId, villageId, navigated = false) {
    if (!navigated) {
        console.log(`[authService-${accountId}] Já estava logado no jogo.`);
    }
    
    const finalGameData = await page.evaluate(() => typeof window.game_data !== 'undefined' ? window.game_data : null);
    if (finalGameData && finalGameData.village && String(finalGameData.village.id) !== String(villageId)) {
        console.warn(`[authService-${accountId}] Aldeia atual (${finalGameData.village.id}) não é a alvo (${villageId}). Navegando...`);
        const correctVillageUrl = page.url().replace(/village=\d+/, `village=${villageId}`);
        await page.goto(correctVillageUrl, { waitUntil: 'load', timeout: 30000 });
        await page.waitForSelector(gameSelector, { timeout: 30000 });
        console.log(`[authService-${accountId}] Navegação para aldeia correta concluída.`);
    } else {
        console.log(`[authService-${accountId}] Entrada final no jogo confirmada (Aldeia: ${villageId}).`);
    }
}

module.exports = { loginAndSelectWorld };