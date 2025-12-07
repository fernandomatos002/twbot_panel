// src/main/worker_core/BotWorker.cjs (V42 - Captura o retorno do constructionModule)

const { sleep, randomWait, checkForCaptcha } = require('../utils/helpers.cjs');

// Serviços
const ipcService = require('./ipcService.cjs');
const apiService = require('./apiService.cjs'); // Importa o serviço
const authService = require('./authService.cjs');
const dashboardService = require('./dashboardService.cjs');

// Módulos de Automação
const stateExtractorModule = require('../automation_modules/state_extractor.cjs');
const missionModule = require('../automation_modules/missions.cjs');
const rewardsModule = require('../automation_modules/rewards.cjs');
const constructionModule = require('../automation_modules/construction.cjs');
const scavengerModule = require('../automation_modules/scavenger.cjs');
// --- (v22) NOVO MÓDULO ---
const recruitmentModule = require('../automation_modules/recruitment.cjs');

class BotWorker {
    constructor() {
        this.config = null;
this.accountId = 'UNKNOWN';
        
        // Estado do Playwright
        this.browser = null;
        this.context = null;
this.page = null;

        // Estado do Worker
        this.isRunning = false;
        this.isStopping = false;
this.cycleTimeoutId = null; 
        
        console.log('[BotWorker] Instância criada.');
    }

    /**
     * Inicia o worker: Inicializa serviços, faz login e inicia o loop.
* @param {object} config
     */
    async start(config) {
        if (this.isRunning) {
            console.warn(`[BotWorker-${config.accountId}] Comando 'start' recebido, mas já está em execução.`);
return;
        }

        // 1. Configuração Inicial
        this.config = config;
this.accountId = config.accountId;
        this.isRunning = true;
        this.isStopping = false;

        console.log(`[BotWorker-${this.accountId}] Iniciando...`);
try {
            // 2. Inicializa Serviços com estado
            ipcService.init(this.accountId);
            
            // (v42) O apiService é inicializado AQUI
apiService.init({
                authToken: config.authToken,
                refreshToken: config.refreshToken
            });
// 3. Login (Serviço de Autenticação)
            // authService.loginAndSelectWorld retorna o villageId real encontrado
            const { browser, context, page, villageId, villageName } = await authService.loginAndSelectWorld(config);
this.browser = browser;
            this.context = context;
            this.page = page;

            // (v39) A CORREÇÃO PRINCIPAL: Se o authService retornou um ID, usamos ele,
            // mesmo que a config inicial (do DB) tenha vindo como null.
            if (villageId) {
                this.config.villageId = villageId; // Sobrescreve o null da config
                console.log(`[BotWorker-${this.accountId}] Village ID corrigido após login: ${villageId} (${villageName}).`);
            } else if (!this.config.villageId) {
                console.warn(`[BotWorker-${this.accountId}] ATENÇÃO: Village ID ainda é null após login. Dependendo do StateExtractor...`);
            }


            ipcService.sendStatus('EM_EXECUÇÃO', 'Login e seleção de mundo concluídos.');
// 4. Inicia o loop
            this.runAutomationCycle();
} catch (error) {
            console.error(`[BotWorker-${this.accountId}] Erro fatal durante a inicialização (start):`, error);
ipcService.sendStatus('FALHA!', `Erro inicialização: ${error.message}`);
            await this.stop(1);
        }
    }

    /**
     * Para o worker: Limpa recursos e encerra o processo.
* @param {number} [exitCode=0]
     */
    async stop(exitCode = 0) {
        // (Código inalterado)
        if (this.isStopping) return;
this.isStopping = true;
        this.isRunning = false;
        console.log(`[BotWorker-${this.accountId}] Comando 'stop' (exitCode: ${exitCode}). Limpando recursos...`);
if (this.cycleTimeoutId) {
            clearTimeout(this.cycleTimeoutId);
            this.cycleTimeoutId = null;
}

        try {
            if (this.page) await this.page.close();
if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
        } catch (e) {
            console.warn(`[BotWorker-${this.accountId}] Aviso ao fechar Playwright:`, e.message);
} finally {
            this.page = null;
            this.context = null;
this.browser = null;
        }

        if (exitCode === 0) {
            ipcService.sendStatus('PARADO', 'Automação encerrada.');
}
        
        console.log(`[BotWorker-${this.accountId}] Encerrando processo.`);
        process.exit(exitCode);
}

    /**
     * O loop principal de automação (LÓGICA OTIMIZADA).
*/
    async runAutomationCycle() {
        if (!this.isRunning || this.isStopping) {
            console.log(`[BotWorker-${this.accountId}] Ciclo ignorado (parando).`);
return;
        }

        console.log(`[BotWorker-${this.accountId}] Iniciando ciclo de automação...`);
try {
            // 1. VERIFICAÇÕES DE SEGURANÇA
            if (this.page.isClosed()) throw new Error("A página foi fechada (isClosed() === true).");
const captchaDetected = await checkForCaptcha(this.page, this.accountId);
            if (captchaDetected) {
                ipcService.sendStatus('CAPTCHA_DETECTADO', 'CAPTCHA Detectado. Bot parado.');
await this.stop(0);
                return;
            }
            
            // O Village ID da config deve ser o ID real agora (se o login funcionou)
            const villageIdToUse = this.config.villageId;


            // 2. EXTRAÇÃO DE ESTADO (A ÚNICA RECARGA DE PÁGINA)
            ipcService.sendStatus('EM_EXECUÇÃO', 'Extraindo estado do jogo...');
const gameState = await stateExtractorModule.execute(this.page, ipcService.sendStatus, this.config);
            
            if (!gameState || !gameState.csrfToken) {
                throw new Error('Falha ao extrair gameState ou Token CSRF (h).');
}
            
            // (v39) Se o ID estava null na config (por falha de sincronização), mas o StateExtractor encontrou um ID válido,
            // corrigimos a config AQUI.
            if (!villageIdToUse && gameState.villageId) {
                console.warn(`[BotWorker-${this.accountId}] Village ID (Config: null -> Auto-Corrigido para ${gameState.villageId}).`);
                this.config.villageId = gameState.villageId;
            }
            
            // --- (v22) INÍCIO DA MODIFICAÇÃO ---
            // 3. ATUALIZAÇÃO DA CONFIG (Busca Construção E Recrutamento)
            // (v42) Passa a instância da API (com token) para o fetchBotConfig
            const { constructionListId, recruitmentTemplate, autoFarm, autoWarehouse } = await this.fetchBotConfig(apiService.api);
this.config.constructionListId = constructionListId;
            this.config.recruitmentTemplate = recruitmentTemplate;
            // (v42) Atualiza a config com os valores do banco de dados (que falharam antes)
            this.config.auto_farm_enabled = autoFarm;
            this.config.auto_warehouse_enabled = autoWarehouse;
            // --- (v22) FIM DA MODIFICAÇÃO ---
            
            // --- INÍCIO DOS MÓDULOS DE AÇÃO (SEM NAVEGAÇÃO) ---
            
            // 4. AÇÃO: MISSÕES
            ipcService.sendStatus('EM_EXECUÇÃO', 'Coletando missões...');
await missionModule.execute(this.page, ipcService.sendStatus, this.config, gameState);
            if (!this.isRunning) return;
            await randomWait(3000, 7000);
// 5. AÇÃO: RECOMPENSAS
            ipcService.sendStatus('EM_EXECUÇÃO', 'Coletando recompensas...');
await rewardsModule.execute(this.page, ipcService.sendStatus, this.config, gameState);
            if (!this.isRunning) return;
            await randomWait(3000, 7000);
// 6. AÇÃO: SCAVENGER
            ipcService.sendStatus('EM_EXECUÇÃO', 'Executando: Coleta (Scavenger)...');
const newScavengeState = await scavengerModule.execute(this.page, ipcService.sendStatus, this.config, gameState);
            if (newScavengeState) {
                console.log(`[BotWorker-${this.accountId}] Estado da Coleta atualizado pela ação.`);
gameState.scavengeInfo = newScavengeState; 
            }
            if (!this.isRunning) return;
await randomWait(3000, 7000);
            
            // 7. AÇÃO: CONSTRUÇÃO
            ipcService.sendStatus('EM_EXECUÇÃO', 'Executando: Construção...');
            // --- (v42) INÍCIO DA CORREÇÃO ---
            // Injeta a instância 'api' e captura o retorno
            const newVillageStateConst = await constructionModule.execute(this.page, ipcService.sendStatus, this.config, gameState, apiService.api);
            if (newVillageStateConst) {
                console.log(`[BotWorker-${this.accountId}] Estado da Aldeia (village) atualizado pela ação de CONSTRUÇÃO.`);
                gameState.village = newVillageStateConst; 
                // (v42) Atualiza o 'gameState.resources' local para o próximo módulo
                gameState.resources = {
                    wood: gameState.village?.wood ?? 0,
                    clay: gameState.village?.stone ?? 0,
                    iron: gameState.village?.iron ?? 0,
                    storage: { max: gameState.village?.storage_max ?? 0 },
                };
            }
            // --- (v42) FIM DA CORREÇÃO ---
            if (!this.isRunning) return;
            await randomWait(3000, 7000);
// --- (v22) INÍCIO DA MODIFICAÇÃO ---
            // 8. AÇÃO: RECRUTAMENTO
            ipcService.sendStatus('EM_EXECUÇÃO', 'Executando: Recrutamento...');
// (v27) Captura o retorno do módulo, que pode conter o novo estado de 'village'
            const newVillageStateRec = await recruitmentModule.execute(this.page, ipcService.sendStatus, this.config, gameState);
            if (newVillageStateRec) {
                console.log(`[BotWorker-${this.accountId}] Estado da Aldeia (village) atualizado pela ação de recrutamento.`);
                gameState.village = newVillageStateRec; // Atualiza o gameState principal
            }
if (!this.isRunning) return;
            await randomWait(3000, 7000);
            // --- (v22) FIM DA MODIFICAÇÃO ---

            // 9. ATUALIZAÇÃO DO DASHBOARD (MOVIDO PARA O FIM)
            // (v42) Agora envia o 'gameState' que foi atualizado por construção E recrutamento
            ipcService.sendStatus('EM_EXECUÇÃO', 'Sincronizando painel...');
dashboardService.updateDashboardState(this.accountId, gameState);

            // --- FIM DOS MÓDULOS DE AÇÃO ---

            ipcService.sendStatus('EM_EXECUÇÃO', 'Ciclo completo. Aguardando...');
} catch (cycleError) {
            console.error(`[BotWorker-${this.accountId}] Erro durante o ciclo:`, cycleError);
ipcService.sendStatus('FALHA!', `Erro no ciclo: ${cycleError.message}`);
            
            // Lógica de Recuperação
            if (this.page.isClosed() || cycleError.message.includes('Not attached') || cycleError.message.includes('ERR_TUNNEL_CONNECTION_FAILED')) {
                console.error(`[BotWorker-${this.accountId}] Erro fatal (página morta ou proxy). Parando.`);
await this.stop(1);
            } else {
                try {
                    await this.page.reload({ waitUntil: 'domcontentloaded' });
ipcService.sendStatus('EM_EXECUÇÃO', 'Página recarregada após erro.');
                } catch (reloadError) {
                    console.error(`[BotWorker-${this.accountId}] Falha ao recarregar a página. Parando...`, reloadError);
await this.stop(1);
                }
            }
        } finally {
            // 10. AGENDAMENTO DO PRÓXIMO CICLO (Código inalterado)
            if (this.isRunning && !this.isStopping) {
                const userMinMs = (this.config.cycleMinMinutes || 5) * 60000;
const userMaxMs = (this.config.cycleMaxMinutes || 7) * 60000;
                const botExtraMinMs = 0.5 * 60000;
                const botExtraMaxMs = 1.5 * 60000;
const nextWaitTimeMs = (userMinMs + Math.random() * (userMaxMs - userMaxMs)) + (botExtraMinMs + Math.random() * (botExtraMaxMs - botExtraMinMs));
ipcService.sendStatus('EM_EXECUÇÃO', `Próximo ciclo em ${(nextWaitTimeMs / 60000).toFixed(1)} min.`);
                console.log(`[BotWorker-${this.accountId}] Próximo ciclo agendado em ${(nextWaitTimeMs / 60000).toFixed(2)} minutos.`);
this.cycleTimeoutId = setTimeout(() => this.runAutomationCycle(), nextWaitTimeMs);
            }
        }
    }

    /**
     * (v22) Busca a config de automação (Construção E Recrutamento).
*/
    // (v42) Recebe a instância da API autenticada
    async fetchBotConfig(apiInstance) {
        
        // (v42) Retorna um objeto padrão em caso de falha
        const defaultConfig = {
            constructionListId: null,
            recruitmentTemplate: null,
            autoFarm: false,
            autoWarehouse: false
        };

        // (v42) Verifica se a instância da API está disponível
        if (!apiInstance) {
            console.warn(`[BotWorker-${this.accountId}] fetchBotConfig falhou: apiInstance não fornecida.`);
            return defaultConfig;
        }

        try {
            ipcService.sendStatus('EM_EXECUÇÃO', 'Sincronizando config de automação...');
            
            // --- CORREÇÃO DE ROTA (V40) ---
            const configResponse = await apiInstance.get('/api/data/dashboard-data'); // <-- CORRIGIDO
            // --- FIM DA CORREÇÃO ---
            
            if (configResponse.data?.tw_accounts) {
                const accountData = configResponse.data.tw_accounts.find(acc => String(acc.id) === String(this.accountId));
if (accountData) {
                    // (v42) Retorna o objeto completo
                    return { 
                        constructionListId: accountData.constructionListId || null,
                        recruitmentTemplate: accountData.recruitmentTemplate || null,
                        autoFarm: accountData.auto_farm_enabled || false,
                        autoWarehouse: accountData.auto_warehouse_enabled || false
                    };
}
            }
            console.warn(`[BotWorker-${this.accountId}] fetchBotConfig: Conta ${this.accountId} não encontrada no dashboard-data.`);
            return defaultConfig;
} catch (apiError) {
            console.warn(`[BotWorker-${this.accountId}] Falha ao buscar config de automação: ${apiError.message}`);
return defaultConfig; // Retorna o padrão em caso de erro 404
        }
    }
}

module.exports = BotWorker;