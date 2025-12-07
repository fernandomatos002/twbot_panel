// dummy-worker.js

/**
 * Worker para execução de automações (Versão com controle de parada).
 * Simula a execução de um bot, gerencia seu ciclo de vida e responde ao comando 'stop'.
 */

// Simula os estados de status (deve corresponder aos usados no frontend)
const STATUS = {
    INITIALIZING: 'INICIANDO...',
    RUNNING: 'EM_EXECUÇÃO',
    STOPPING: 'PARANDO...',
    STOPPED: 'PARADO',
    SESSION_MISSING: 'SESSÃO_AUSENTE', // Exemplo de erro inicial
    FAILURE: 'FALHA!' // Erro genérico ou crash
};

let isRunning = false;
let accountId = null;
let simulationIntervalId = null; // ID do intervalo da simulação principal

// --- Função Auxiliar para Envio de Status ---

/**
 * Envia um objeto de status padronizado para o processo principal (Main Process).
 * @param {string} status - O novo status (e.g., STATUS.RUNNING).
 * @param {string} [log=''] - Uma mensagem de log opcional.
 */
const sendStatusUpdate = (status, log = '') => {
    // Verifica se process.send está disponível (confirmação de execução como child process)
    if (process.send) {
        process.send({
            type: 'statusUpdate', // Identificador da mensagem
            accountId: accountId, // ID da conta associada
            status: status,       // O estado atual
            log: log,             // Mensagem descritiva
            timestamp: new Date().toISOString() // Data/Hora do evento
        });
    } else {
        // Loga no console do worker se IPC não estiver disponível (não deve acontecer em uso normal)
        console.error(`[Worker-${accountId || 'unknown'}] Erro: Tentativa de enviar status, mas process.send não está disponível.`);
    }
};

// --- Funções de Controle da Automação ---

/**
 * Inicia a simulação principal do bot.
 * @param {object} config - Configuração recebida do Main Process ({ accountId, session }).
 */
const startAutomation = (config) => {
    accountId = config.accountId; // Armazena globalmente no worker para referência

    // Verifica a sessão (exemplo)
    if (!config.session || config.session.length === 0) {
        console.error(`[Worker-${accountId}] Erro Crítico: Sessão (cookies) não fornecida ou vazia.`);
        sendStatusUpdate(STATUS.SESSION_MISSING, 'Erro: Dados de sessão ausentes. Autentique novamente.');
        process.exit(1); // Encerra com código de erro
        return;
    }

    isRunning = true;
    console.log(`[Worker-${accountId}] (PID: ${process.pid}) Iniciando simulação com ${config.session.length} cookies.`);
    sendStatusUpdate(STATUS.INITIALIZING, `Inicializando bot para ${accountId}...`);

    // Simula um tempo de inicialização
    setTimeout(() => {
        sendStatusUpdate(STATUS.RUNNING, 'Automação iniciada e em execução (simulada).');

        let cycleCount = 0;
        // Inicia o loop de simulação de tarefas
        simulationIntervalId = setInterval(() => {
            cycleCount++;
            const logMessage = `Ciclo ${cycleCount}: Verificando recursos e tropas (simulado)...`;
            console.log(`[Worker-${accountId}] ${logMessage}`);
            sendStatusUpdate(STATUS.RUNNING, logMessage);

            // Simula uma falha aleatória para teste
            if (Math.random() < 0.05) { // 5% de chance de falha por ciclo
                console.error(`[Worker-${accountId}] Erro simulado durante a execução!`);
                sendStatusUpdate(STATUS.FAILURE, 'Erro simulado: Falha ao processar dados da aldeia.');
                clearInterval(simulationIntervalId); // Para o loop
                isRunning = false;
                process.exit(1); // Encerra com erro
            }

        }, 8000); // Simula uma tarefa a cada 8 segundos

    }, 2000); // 2 segundos de inicialização simulada
};

/**
 * Executa a rotina de parada limpa da automação.
 */
const stopAutomationCleanly = () => {
    if (!isRunning) {
        console.log(`[Worker-${accountId}] Recebido comando 'stop', mas já não estava em execução.`);
        // Garante que o status 'PARADO' seja enviado caso algo tenha dado errado antes
        sendStatusUpdate(STATUS.STOPPED, 'Já estava parado.');
        process.exit(0);
        return;
    }

    console.log(`[Worker-${accountId}] Recebido comando 'stop'. Iniciando parada limpa...`);
    isRunning = false; // Sinaliza que não deve mais executar tarefas

    // 1. Limpa o intervalo da simulação principal
    if (simulationIntervalId) {
        clearInterval(simulationIntervalId);
        simulationIntervalId = null;
    }

    // 2. Envia o status 'PARANDO...' para o Main Process/Frontend
    sendStatusUpdate(STATUS.STOPPING, 'Finalizando tarefas e salvando estado...');

    // 3. Simula o tempo necessário para limpeza (ex: fechar conexão, salvar dados)
    setTimeout(() => {
        console.log(`[Worker-${accountId}] Limpeza concluída.`);

        // 4. Envia o status final 'PARADO'
        sendStatusUpdate(STATUS.STOPPED, 'Automação encerrada de forma limpa.');

        // 5. Encerra o processo do worker com sucesso
        process.exit(0);

    }, 2500); // Simula 2.5 segundos de limpeza
};


// --- Ponto de Entrada e Listeners de Comunicação e Erro ---

// Listener principal para mensagens do Main Process ('start' ou 'stop')
process.on('message', (message) => {
  if (!message || typeof message.type !== 'string') {
      console.error('[Worker] Mensagem inválida recebida do Main Process:', message);
      return;
  }

  console.log(`[Worker${accountId ? `-${accountId}` : ''}] Mensagem recebida: tipo='${message.type}'`);

  if (message.type === 'start' && !isRunning) {
    if (!message.config || !message.config.accountId) {
         console.error('[Worker] Comando "start" recebido sem config.accountId.');
         sendStatusUpdate(STATUS.FAILURE, 'Erro interno: Dados de configuração ausentes no comando start.');
         process.exit(1);
         return;
    }
    startAutomation(message.config);
  } else if (message.type === 'start' && isRunning) {
      console.warn(`[Worker-${accountId}] Recebido comando 'start', mas a automação já está rodando.`);
  } else if (message.type === 'stop') {
    stopAutomationCleanly();
  } else {
      console.warn(`[Worker${accountId ? `-${accountId}` : ''}] Recebido tipo de mensagem não reconhecido: ${message.type}`);
  }
});

// Listener para exceções não capturadas
process.on('uncaughtException', (err) => {
  const errorMsg = `Exceção não tratada: ${err.message || err}`;
  console.error(`[Worker-${accountId || 'init'}] ${errorMsg}`, err.stack);
  // Tenta enviar um status de falha antes de sair
  sendStatusUpdate(STATUS.FAILURE, errorMsg);
  // Espera um pouco para dar chance da mensagem IPC ser enviada
  setTimeout(() => process.exit(1), 500);
});

// Listener para promessas rejeitadas não tratadas
process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = `Rejeição de promessa não tratada: ${reason instanceof Error ? reason.message : reason}`;
  console.error(`[Worker-${accountId || 'init'}] ${errorMsg}`, reason);
  // Tenta enviar um status de falha antes de sair
  sendStatusUpdate(STATUS.FAILURE, errorMsg);
  // Espera um pouco para dar chance da mensagem IPC ser enviada
  setTimeout(() => process.exit(1), 500);
});

// Log inicial para indicar que o script do worker foi carregado e está pronto
console.log(`[Worker (PID: ${process.pid})] Script carregado. Aguardando comando 'start' ou 'stop'.`);