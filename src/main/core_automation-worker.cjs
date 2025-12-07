const path = require('path');
const fs = require('fs');
const Module = require('module');

const possibleNodeModules = [
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, '..', 'node_modules'),
    path.join(__dirname, '..', '..', 'node_modules'),
    path.join(process.cwd(), 'node_modules'),
    path.join(process.resourcesPath || '', 'app', 'node_modules')
];

possibleNodeModules.forEach(p => {
    try {
        if (fs.existsSync(p)) {
            if (!module.paths.includes(p)) {
                module.paths.push(p);
                Module.globalPaths.push(p);
            }
        }
    } catch (e) { }
});

console.log('[CoreWorker] Processo iniciado.');

try {
    require('playwright-extra').chromium;
    require('puppeteer-extra-plugin-stealth')();
    require('axios');
    require('cheerio');
    require('./utils/helpers.cjs');
    require('./automation_modules/state_extractor.cjs');
    require('./automation_modules/missions.cjs');
    require('./automation_modules/rewards.cjs');
    require('./automation_modules/construction.cjs');
    require('./automation_modules/recruitment.cjs');
} catch (error) {
    console.error('[CoreWorker] FATAL: Falha ao carregar dependências. Erro:', error);
    if (process.connected) {
        process.send({
            type: 'statusUpdate',
            accountId: 'DESCONHECIDO', 
            status: 'FALHA!',
            log: `Erro crítico: ${error.message}`,
            timestamp: new Date().toISOString()
        });
    }
    process.exit(1); 
}

const BotWorker = require('./worker_core/BotWorker.cjs');
let worker = null;
let startTimeoutId = null;

process.on('message', (message) => {
    if (!message || !message.type) return;
    
    if (startTimeoutId) {
        clearTimeout(startTimeoutId);
        startTimeoutId = null;
    }

    if (message.type === 'start') {
        if (message.config) {
            if (!worker) {
                worker = new BotWorker();
            }
            worker.start(message.config).catch(async (error) => {
                console.error('[CoreWorker] Erro start:', error);
                if (worker && !worker.isStopping) {
                    await worker.stop(1);
                } else {
                    process.exit(1);
                }
            });
        } else {
            process.exit(1);
        }
    } else if (message.type === 'stop') {
        if (worker && !worker.isStopping) {
            worker.stop(0).catch(() => process.exit(0));
        } else {
            process.exit(0);
        }
    }
});

process.on('SIGTERM', async () => {
    if (worker && !worker.isStopping) {
        await worker.stop(0).catch(() => process.exit(0));
    } else {
        process.exit(0);
    }
});

process.on('uncaughtException', async (error) => {
    if (worker && worker.ipcService && !worker.isStopping) {
        worker.ipcService.sendStatus('FALHA!', `Erro fatal: ${error.message}`);
    }
    if (worker && !worker.isStopping) {
        await worker.stop(1).catch(() => process.exit(1));
    } else {
        process.exit(1);
    }
});

process.on('unhandledRejection', async (reason) => {
     if (worker && worker.ipcService && !worker.isStopping) {
        worker.ipcService.sendStatus('FALHA!', `Erro assíncrono: ${reason.message || reason}`);
    }
    if (worker && !worker.isStopping) {
        await worker.stop(1).catch(() => process.exit(1));
    } else {
        process.exit(1);
    }
});

startTimeoutId = setTimeout(() => {
    if (!worker) {
        process.exit(1);
    }
}, 30000);