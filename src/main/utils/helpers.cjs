// src/main/utils/helpers.cjs (CORRIGIDO E MESCLADO)

const util = require('util');
const axios = require('axios'); // Dependência para testProxy
const { URL } = require('url');   // Dependência para testProxy
const setTimeoutPromise = util.promisify(setTimeout);

/**
 * Aguarda um tempo fixo (em milissegundos).
 * @param {number} ms - O tempo de espera em milissegundos.
 */
async function sleep(ms) {
    await setTimeoutPromise(ms);
}

/**
 * Aguarda um tempo aleatório dentro de um intervalo.
 * @param {number} minMs - Tempo mínimo de espera.
 * @param {number} maxMs - Tempo máximo de espera.
 */
async function randomWait(minMs, maxMs) {
    const waitTime = minMs + Math.random() * (maxMs - minMs);
    await setTimeoutPromise(waitTime);
}

/**
 * Simula um clique mais humano.
 * Move o mouse sobre o elemento, espera um pouco e então clica.
 * @param {import('playwright').Locator} locator - O localizador do Playwright para clicar.
 * @param {number} [minHoverMs=150] - Tempo mínimo de espera após o hover.
 * @param {number} [maxHoverMs=450] - Tempo máximo de espera após o hover.
 */
async function humanClick(locator, minHoverMs = 150, maxHoverMs = 450) {
    if (!locator) {
        console.error('humanClick recebeu um localizador nulo ou indefinido.');
        return;
    }
    
    try {
        // 1. Move o mouse sobre o elemento
        await locator.hover({ timeout: 5000 }); 
        
        // 2. Espera um tempo aleatório (simulando cognição)
        await randomWait(minHoverMs, maxHoverMs);

        // 3. Clica
        await locator.click({ timeout: 5000, delay: Math.random() * 100 }); // Adiciona um pequeno delay ao clique

    } catch (error) {
        console.warn(`[humanClick] Falha no clique humano: ${error.message}. Tentando clique forçado.`);
        // Fallback: Se o hover/clique normal falhar (ex: elemento coberto)
        try {
            await locator.click({ timeout: 5000, force: true });
        } catch (forceClickError) {
             console.error(`[humanClick] Falha no clique forçado: ${forceClickError.message}`);
             // Propaga o erro se até o clique forçado falhar
             throw forceClickError;
        }
    }
}

/**
 * (Vindo da Refatoração)
 * Testa a conexão de um proxy fazendo uma requisição leve.
 * @param {object} proxyConfig - { server: 'ip:port', username: 'user', password: 'pw' }
 * @param {string} accountId - (Para logs)
 * @returns {Promise<boolean>} - True se funcionar, false se falhar.
 */
async function testProxy(proxyConfig, accountId = 'unknown') {
    if (!proxyConfig || !proxyConfig.server) {
        console.warn(`[helper/testProxy-${accountId}] Teste de proxy pulado: Nenhuma configuração.`);
        return true;
    }

    try {
        let serverString = proxyConfig.server;
        
        // Garante que o protocolo http:// esteja presente
        if (!serverString.startsWith('http://') && !serverString.startsWith('https://')) {
            serverString = `http://${serverString}`;
        }
        
        const proxyUrl = new URL(serverString);
        const axiosProxyConfig = {
            protocol: proxyUrl.protocol.replace(':', ''),
            host: proxyUrl.hostname,
            port: parseInt(proxyUrl.port, 10),
            auth: undefined
        };
        if (proxyConfig.username) {
            axiosProxyConfig.auth = {
                username: proxyConfig.username,
                password: proxyConfig.password
            };
        }

        const targetUrl = 'https://api.ipify.org'; // URL leve para teste
        console.log(`[helper/testProxy-${accountId}] Testando proxy: ${axiosProxyConfig.protocol}://${axiosProxyConfig.host}:${axiosProxyConfig.port}...`);
        await axios.get(targetUrl, {
            proxy: axiosProxyConfig,
            timeout: 15000 // 15 segundos
        });
        console.log(`[helper/testProxy-${accountId}] Teste de proxy bem-sucedido.`);
        return true;

    } catch (error) {
        if (error instanceof TypeError && error.message.includes('Invalid URL')) {
             console.error(`[helper/testProxy-${accountId}] Falha CRÍTICA: String '${proxyConfig.server}' é uma URL inválida.`);
        } else {
            console.error(`[helper/testProxy-${accountId}] Falha no teste de proxy:`, error.message);
            if (error.code === 'ECONNABORTED') {
                console.error(`[helper/testProxy-${accountId}] O proxy atingiu o timeout de 15s.`);
            }
        }
        return false;
    }
}

/**
 * (Vindo da Refatoração)
 * Verifica rapidamente se algum seletor de CAPTCHA está visível.
 * @param {import('playwright').Page} page
 * @param {string} accountId - (Para logs)
 * @returns {Promise<boolean>} - True se CAPTCHA for detectado.
 */
async function checkForCaptcha(page, accountId = 'unknown') {
    const CAPTCHA_SELECTORS = [
        '#botprotection_quest',
        'td.bot-protection-row',
        'div.captcha'
    ];
    try {
        // Validação da página adicionada para robustez
        if (!page || page.isClosed()) {
             console.warn(`[helper/captcha-${accountId}] Verificação de CAPTCHA pulada, página está fechada.`);
             return false;
        }
        const racePromises = CAPTCHA_SELECTORS.map(selector => 
            page.waitForSelector(selector, { state: 'visible', timeout: 2000 })
        );
        await Promise.race(racePromises);
        
        console.warn(`[helper/captcha-${accountId}] DETECÇÃO DE CAPTCHA: Seletor encontrado.`);
        return true;
    } catch (error) {
        // Timeout é o esperado (sem CAPTCHA)
        return false;
    }
}


module.exports = {
    sleep,
    randomWait,
    humanClick,
    testProxy,
    checkForCaptcha
};