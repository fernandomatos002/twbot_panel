// proxyService.js
const axios = require('axios');
// REMOVIDO: 'http' e 'https' nativos não são mais necessários para o agent
// const http = require('http');
// const https = require('https');

// NOVO: Importa o HttpsProxyAgent
const { HttpsProxyAgent } = require('https-proxy-agent');

// REMOVIDO: Os agents nativos (httpAgent, httpsAgent) foram removidos

// API GeoIP simples (sem necessidade de chave)
const GEOIP_URL = 'http://ip-api.com/json/';

/**
 * Busca o país de origem de um endereço IP.
 * @param {string} ip - O endereço IP do proxy.
 * @returns {string} O código do país (ex: 'US', 'BR') ou 'Desconhecido'.
 */
async function fetchProxyCountry(ip) {
    try {
        // NÃO usamos proxy para esta requisição
        const response = await axios.get(`${GEOIP_URL}${ip}`, {
            timeout: 5000
            // Agents removidos, usa o padrão do axios para esta chamada simples
        });

        if (response.data.status === 'success') {
            return response.data.countryCode || response.data.country || 'N/A';
        }
    } catch (error) {
        console.error(`[GeoIP] Falha ao buscar país para ${ip}:`, error.message);
    }
    return 'Desconhecido';
}


/**
 * Tenta fazer uma requisição HTTP via proxy, busca GeoIP e atualiza o status no PostgreSQL.
 * @param {object} proxy - Dados completos do proxy { id, ip, port, username, password }.
 * @param {object} pgPool - O Pool de Conexões do PostgreSQL.
 */
async function testAndStoreProxyStatus(proxy, pgPool) {
    const { id, ip, port, username, password } = proxy;
    let newStatus = 'Falha';

    // (Lógica de busca de país inalterada)
    let country = proxy.country || null;
    if (country === null || country === 'Desconhecido') {
         console.log(`[ProxyTest] País não fornecido, buscando para ${ip}...`);
         country = await fetchProxyCountry(ip);
    } else {
         console.log(`[ProxyTest] País já conhecido: ${country}`);
    }


    console.log(`[ProxyTest] Iniciando teste para ${ip}:${port} (${country})...`);

    // --- 1. Teste de Conexão ---
    try {
        
        // =================================================================
        // CORREÇÃO: Usando HttpsProxyAgent para resolver EPROTO
        // =================================================================
        
        // 1. Constrói a URL do proxy no formato que o HttpsProxyAgent espera
        // Ex: "http://1.2.3.4:8080" ou "http://user:pass@1.2.3.4:8080"
        let proxyUrl;
        if (username && password) {
            proxyUrl = `http://${username}:${password}@${ip}:${port}`;
        } else {
            proxyUrl = `http://${ip}:${port}`;
        }
        
        // 2. Cria uma instância do HttpsProxyAgent
        // O HttpsProxyAgent fará o "tunneling" da nossa requisição HTTPS (google)
        // através do proxy (que é http ou https, não importa para ele)
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        const testUrl = 'https://www.google.com'; 

        const response = await axios.get(testUrl, {
            timeout: 15000,
            
            // 3. Informa ao Axios para usar este agente APENAS para HTTPS
            // O `httpAgent` nativo será usado para HTTP
            httpsAgent: proxyAgent,
            
            // 4. REMOVE a chave 'proxy' nativa do axios, pois o agent já cuida disso.
            // proxy: { ... } // <-- REMOVIDO
        });
        
        // =================================================================
        
        if (response.status >= 200 && response.status < 400) {
            newStatus = 'Ativo';
        } else {
            newStatus = `Falha (HTTP ${response.status})`;
        }

    } catch (error) {
        // Log detalhado do erro
        const errorCode = error.code || (error.response ? `HTTP ${error.response.status}` : 'Erro Desconhecido');
        
        if (error.response && error.response.status === 400) {
            newStatus = 'Falha (Erro: ERR_BAD_REQUEST)'; 
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            newStatus = 'Falha (Conexão)';
        } else if (error.response && error.response.status === 407) {
            newStatus = 'Falha (Auth Requerida)';
        } else {
             // Captura o EPROTO
            newStatus = `Falha (Erro: ${errorCode}...)`;
        }
        // Loga a causa específica (EPROTO, ERR_BAD_REQUEST, ETIMEDOUT, etc.)
        console.error(`[ProxyTest] Erro de Axios em ${ip}:${port}:`, errorCode, error.message);
    }

    // --- 2. Atualizar o Status Final e País no PostgreSQL ---
    const updateQuery = `
        UPDATE proxies
        SET status = $1, last_tested_at = NOW(),
            country = COALESCE($3, country) -- Atualiza o país SÓ SE $3 não for NULL
        WHERE id = $2;
    `;

    try {
        const result = await pgPool.query(updateQuery, [newStatus, id, country]);

        if (result.rowCount === 0) {
            console.error(`[DB Error] ATENÇÃO: Nenhum proxy encontrado com ID ${id} para atualização.`);
        }

        console.log(`[ProxyTest] DB ATUALIZADO para ${ip}:${port}. Status: ${newStatus}, País: ${country || '(mantido)'}`);
    } catch (dbError) {
        console.error(`[DB Error] FALHA AO ATUALIZAR STATUS do proxy ${id}:`, dbError.message);
    } finally {
        console.log(`[ProxyTest] FIM DA ROTINA assíncrona para ID: ${id}`);
    }

    // Retorna true/false para a rota JIT
    return newStatus === 'Ativo';
}


// Exportação correta (mantida)
module.exports = {
    testAndStoreProxyStatus,
    fetchProxyCountry
};
