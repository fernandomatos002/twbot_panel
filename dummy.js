// --- LINHA DE DEPURAÇÃO ADICIONADA ---
console.log('[Worker] Script iniciado.');
// --- FIM DA LINHA DE DEPURAÇÃO ---

// dummy-worker.js

// REMOVIDO: require('bytenode'); // <-- ESTA LINHA DEVE SER REMOVIDA!

/**
 * Função principal do worker manequim.
 * Simula o recebimento de dados e o envio de status.
 * @param {string} accountId - O ID da conta recebido.
 * @param {object} session - O objeto de sessão (cookies) recebido.
 */
const runBotSimulation = (accountId, session) => {
  // Verifica se 'process.send' existe (confirma que está rodando como um processo 'fork')
  if (!process.send) {
    console.error(`[Worker-${accountId}] Erro: Não está rodando como um processo filho (IPC indisponível).`);
    process.exit(1); // Sai com código de erro
    return;
  }

  console.log(`[Worker-${accountId}] (PID: ${process.pid}) Processo iniciado com sucesso.`);

  // 1. Envia o primeiro status de volta para o 'main/index.cjs'
  // 'main/index.cjs' captura isso com 'child.on('message', ...)'
  process.send({
    status: 'Iniciado (Manequim)',
    log: `Worker recebendo dados para a conta ${accountId}. Sessão com ${session.length} cookies.`
  });

  // 2. Simula algum trabalho (ex: 5 segundos)
  setTimeout(() => {
    console.log(`[Worker-${accountId}] Simulação de tarefa concluída.`);

    // 3. Envia o status final
    process.send({
      status: 'OFF', // Usamos 'OFF' para indicar conclusão limpa (main/index.cjs tratará isso)
      log: 'Trabalho manequim finalizado com sucesso.'
    });

    // 4. Encerra o processo filho
    process.exit(0); // 0 indica saída bem-sucedida

  }, 5000); // Simula 5 segundos de trabalho
};

// --- Ponto de Entrada do Processo Filho ---

// Escuta a mensagem enviada pelo 'child.send(...)' no 'main/index.cjs'
process.on('message', (message) => {
  console.log(`[Worker] Mensagem recebida do Main: ${message.type}`);

  if (message.type === 'start') {
    const { accountId, session } = message;

    if (!accountId || !session) {
      const errorMsg = '[Worker] Erro: accountId ou session não recebidos.';
      console.error(errorMsg);
      if(process.send) {
        process.send({ status: 'CRASHED', log: errorMsg });
      }
      process.exit(1); // 1 indica saída com erro
      return;
    }

    // Inicia a simulação
    runBotSimulation(accountId, session);
  }
});

// Tratadores de segurança para garantir que o 'main' seja notificado em caso de falha
process.on('uncaughtException', (err) => {
  const errorMsg = `[Worker] Exceção não tratada: ${err.message}`;
  console.error(errorMsg);
  if (process.send) {
    process.send({ status: 'CRASHED', log: errorMsg });
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const errorMsg = `[Worker] Rejeição não tratada: ${reason.message || reason}`;
  console.error(errorMsg);
  if (process.send) {
    process.send({ status: 'CRASHED', log: errorMsg });
  }
  process.exit(1);
});
