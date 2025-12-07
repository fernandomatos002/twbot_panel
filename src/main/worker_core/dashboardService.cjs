// src/main/services/dashboard_service.cjs (REATORAÇÃO v12 - Status da Coleta)

/**
 * Formata os dados brutos de scavengeInfo para o ViewModel do painel.
 * @param {Object} scavengeInfo - O objeto gameState.scavengeInfo (que é o objeto 'village' da API de coleta)
 * @returns {Object} - Um objeto formatado para a UI.
 */
function formatScavengeStatus(scavengeInfo) {
    // Estado padrão
    const status = {
        overallStatus: 'Inativo', // 'Inativo', 'Coletando', 'Desbloqueando', 'Bloqueado'
        options: []
    };

    if (!scavengeInfo || !scavengeInfo.options) {
        // Se não houver dados, retorna 4 slots bloqueados (para UI)
        for (let i = 1; i <= 4; i++) {
            status.options.push({ id: String(i), status: 'Bloqueado', timestamp: null });
        }
        status.overallStatus = 'Bloqueado';
        return status; 
    }

    const options = scavengeInfo.options;
    let isCollecting = false;
    let isUnlocking = false;
    let allLocked = true;

    // O ID das opções no TW é "1", "2", "3", "4"
    for (const optionId in options) {
        const opt = options[optionId];
        const optionStatus = {
            id: optionId,
            status: 'Bloqueado', // 'Bloqueado', 'Desbloqueando', 'Inativo', 'Coletando'
            timestamp: null // (timestamp de 'return_time' or 'unlock_time')
        };

        if (opt.scavenging_squad !== null) {
            // Está coletando
            optionStatus.status = 'Coletando';
            optionStatus.timestamp = opt.scavenging_squad.return_time || null;
            isCollecting = true;
            allLocked = false;
        } else if (opt.unlock_time !== null) {
            // Está desbloqueando (e o tempo não é nulo)
            optionStatus.status = 'Desbloqueando';
            optionStatus.timestamp = opt.unlock_time;
            isUnlocking = true;
            allLocked = false;
        } else if (opt.is_locked === false) {
            // Não está coletando, não está desbloqueando, mas está aberto
            optionStatus.status = 'Inativo';
            allLocked = false;
        }
        // Se nenhum dos acima, o status 'Bloqueado' padrão permanece

        status.options.push(optionStatus);
    }

    // Define o status geral (para a cor da coluna)
    if (isCollecting) {
        status.overallStatus = 'Coletando';
    } else if (isUnlocking) {
        status.overallStatus = 'Desbloqueando';
    } else if (!allLocked) {
        status.overallStatus = 'Inativo';
    }
    // Se não, permanece 'Bloqueado'

    return status;
}


/**
 * Constrói o View Model de recursos e o envia para o Main Process (index.cjs)
 * para ser retransmitido à UI (React).
 *
 * @param {string} currentAccountId - O ID da conta para taguear a mensagem.
 * @param {Object} gameState - O objeto de estado extraído (window.game_data).
 */
function updateDashboardState(currentAccountId, gameState) {
    // Validação inicial (mantida)
    if (!currentAccountId) {
        console.error('[DashboardService] Tentativa de notificar UI sem currentAccountId.');
        return;
    }

    // Validação MÍNIMA: Garante que gameState existe
    if (!gameState) {
         console.warn(`[DashboardService-${currentAccountId}] Tentativa de notificar UI com gameState nulo ou undefined.`);
        return; // Retorna se o gameState inteiro for nulo
    }

    try {
        // **** INÍCIO DA MODIFICAÇÃO (v12): Construção do viewModel com Coleta ****
        const viewModel = {
            // Usa optional chaining (?.) e nullish coalescing (??) para evitar erros
            playerPoints: 
            Math.floor(gameState.player?.points ?? 0),
            resources: {
                wood: Math.floor(gameState.village?.wood ?? 0), 
                clay: Math.floor(gameState.village?.stone ?? 0), 
                iron: Math.floor(gameState.village?.iron ?? 0), 
                population: {
                    current: gameState.village?.pop ?? 0,
                    max: gameState.village?.pop_max ?? 0
                },
                storage: {
                    max: gameState.village?.storage_max ?? 0
                }
            },
            // Nova propriedade para o status da coleta (formatada)
            scavengeStatus: formatScavengeStatus(gameState.scavengeInfo)
        };
        // **** FIM DA MODIFICAÇÃO (v12) ****

        // Log para depuração
        // console.log(`[DashboardService-${currentAccountId}] Enviando viewModel:`, JSON.stringify(viewModel));
        
        // Envia os dados para o Main Process (index.cjs) via IPC
        if (process.connected) {
            process.send({
                type: 'dashboard-update', // Canal que o React (via Preload) espera
                accountId: currentAccountId,
                state: viewModel, // Envia o objeto 'state' completo
                timestamp: new Date().toISOString()
            });
        } else {
             console.warn(`[DashboardService-${currentAccountId}] Canal IPC desconectado, não é possível enviar dashboard-update.`);
        }

    } catch (error) {
        // Captura erros inesperados da construção do objeto ou do process.send()
        console.error(`[DashboardService-${currentAccountId}] Falha INESPERADA ao construir ou enviar o View Model: ${error.message}`, error);
    }
}

module.exports = {
    updateDashboardState
};