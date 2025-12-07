// src/main/worker_core/ipcService.cjs (NOVO)
// Gerencia toda a comunicação IPC (process.send) para o processo principal.

let accountId = 'UNKNOWN';

/**
 * Inicializa o serviço com o ID da conta.
 * @param {string} id
 */
function init(id) {
    accountId = id;
}

/**
 * Função base para enviar mensagens.
 * @param {string} type - O tipo da mensagem (ex: 'statusUpdate')
 * @param {object} payload - O conteúdo da mensagem
 */
function send(type, payload) {
    if (!accountId) {
        console.error('[ipcService] Tentativa de enviar mensagem sem AccountID definido.');
        return;
    }
    if (process.connected) {
        try {
            process.send({
                type: type,
                accountId: accountId,
                ...payload,
                timestamp: new Date().toISOString()
            });
        } catch (ipcError) {
            console.error(`[ipcService-${accountId}] Erro ao enviar mensagem IPC:`, ipcError);
            // Se o IPC falhar, o worker não pode mais ser controlado.
            process.exit(1);
        }
    } else {
        console.warn(`[ipcService-${accountId}] Canal IPC desconectado, não é possível enviar tipo ${type}.`);
        // Se o canal cair, paramos o worker.
        process.exit(1);
    }
}

/**
 * Envia uma atualização de status padrão.
 * @param {string} status 
 * @param {string} log 
 */
function sendStatus(status, log) {
    send('statusUpdate', { status: status, log: log });
}

/**
 * Envia uma atualização de status do proxy.
 * @param {'valid' | 'invalid' | 'not_used'} proxyStatus 
 */
function sendProxyStatus(proxyStatus) {
    send('proxyStatusUpdate', { proxyStatus: proxyStatus });
}

/**
 * Envia os cookies de sessão atualizados para o processo principal.
 * @param {Array} cookies 
 */
function sendSessionUpdate(cookies) {
    console.log(`[ipcService-${accountId}] Enviando cookies atualizados para o Main Process.`);
    send('sessionUpdate', { payload: { cookies: cookies } });
}

/**
 * Envia o novo Access Token para o processo principal.
 * @param {string} newAccessToken 
 */
function sendTokenUpdate(newAccessToken) {
    console.log(`[ipcService-${accountId}] Enviando 'tokenUpdate' para o Main Process.`);
    send('tokenUpdate', { payload: { newAccessToken: newAccessToken } });
}

/**
 * Envia dados formatados para o dashboard.
 * @param {object} stateViewModel 
 */
function sendDashboardUpdate(stateViewModel) {
    send('dashboard-update', { state: stateViewModel });
}

module.exports = {
    init,
    sendStatus,
    sendProxyStatus,
    sendSessionUpdate,
    sendTokenUpdate,
    sendDashboardUpdate
};