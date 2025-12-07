// src/main/services/dashboard_service.cjs (Versão Segura + Debug Logs de Tipo)

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
        // **** ADICIONE ESTES LOGS DE TIPO ****
        console.log(`[DashboardService-${currentAccountId}] DEBUG: Tipo de gameState.village: ${typeof gameState.village}`);
        if(gameState.village) {
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.wood: ${gameState.village.wood}, Tipo: ${typeof gameState.village.wood}`);
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.stone: ${gameState.village.stone}, Tipo: ${typeof gameState.village.stone}`);
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.iron: ${gameState.village.iron}, Tipo: ${typeof gameState.village.iron}`);
             // Log adicional para as propriedades float, caso sejam elas as corretas
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.wood_float: ${gameState.village.wood_float}, Tipo: ${typeof gameState.village.wood_float}`);
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.stone_float: ${gameState.village.stone_float}, Tipo: ${typeof gameState.village.stone_float}`);
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.village.iron_float: ${gameState.village.iron_float}, Tipo: ${typeof gameState.village.iron_float}`);
        } else {
             console.warn(`[DashboardService-${currentAccountId}] DEBUG: gameState.village está undefined ou nulo.`);
        }
        console.log(`[DashboardService-${currentAccountId}] DEBUG: Tipo de gameState.player: ${typeof gameState.player}`);
        if(gameState.player) {
             console.log(`[DashboardService-${currentAccountId}] DEBUG: Valor gameState.player.points: ${gameState.player.points}, Tipo: ${typeof gameState.player.points}`);
        } else {
             console.warn(`[DashboardService-${currentAccountId}] DEBUG: gameState.player está undefined ou nulo.`);
        }
        // **** FIM DOS LOGS ADICIONADOS ****

        // **** INÍCIO DA MODIFICAÇÃO: Construção Segura do viewModel **** (Código existente)
        const viewModel = {
            // Usa optional chaining (?.) e nullish coalescing (??) para evitar erros
            // Se gameState.player ou gameState.player.points não existirem, usa 0
            playerPoints: Math.floor(gameState.player?.points ?? 0),
            resources: {
                // Se gameState.village ou gameState.village.wood não existirem, usa 0
                // **ATENÇÃO:** Usar wood_float, stone_float, iron_float se os logs mostrarem que wood/stone/iron não são os corretos
                wood: Math.floor(gameState.village?.wood ?? 0), // <- VERIFICAR logs se deve ser wood_float
                clay: Math.floor(gameState.village?.stone ?? 0), // <- VERIFICAR logs se deve ser stone_float (Mapeamento: gameData.village.stone -> viewModel.resources.clay)
                iron: Math.floor(gameState.village?.iron ?? 0), // <- VERIFICAR logs se deve ser iron_float
                population: {
                    current: gameState.village?.pop ?? 0,
                    max: gameState.village?.pop_max ?? 0
                },
                storage: {
                    max: gameState.village?.storage_max ?? 0
                }
            }
        };
        // **** FIM DA MODIFICAÇÃO ****

        // Log para depuração (opcional, pode remover depois)
        console.log(`[DashboardService-${currentAccountId}] Enviando viewModel:`, JSON.stringify(viewModel));

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
        console.error(`[DashboardService-${currentAccountId}] Falha INESPERADA ao construir ou enviar o View Model: ${error.message}`, error); // Log do erro completo
    }
}

module.exports = {
    updateDashboardState
};