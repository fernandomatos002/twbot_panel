const bytenode = require('bytenode');
const fs = require('fs');
const path = require('path');

// Lê a versão do Electron para garantir compatibilidade
const pkg = require('./package.json');
const electronVersion = pkg.devDependencies.electron.replace('^', '').replace('~', '');
console.log(`[Build] Target Electron Version: ${electronVersion}`);

const mainDir = path.join(__dirname, 'src', 'main');
const distDir = path.join(__dirname, 'dist', 'main');

// 1. Arquivos para COMPILAR (Ofuscar -> .jsc)
// Apenas arquivos que são carregados dinamicamente ou são Entry Points
const FILES_TO_COMPILE = [
    'index.cjs', // Se quiser ofuscar o main, senão mova para COPY
    'apiService.cjs',
    'updater.cjs',
    'windowManager.cjs',
    'workerManager.cjs',
    // Workers (são chamados pelo workerManager que sabe lidar com .jsc)
    'authentication-worker.cjs',
    'core_automation-worker.cjs',
    'village_viewer_worker.cjs'
];

// 2. Arquivos/Pastas para APENAS COPIAR (Manter .cjs)
// Isso corrige o erro "Cannot find module", pois o código espera .cjs
const DIRS_TO_COPY = [
    'utils',
    'automation_modules',
    'worker_core' // Importante: Contém BotWorker, authService, etc.
];

// Função auxiliar para copiar pasta recursivamente
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((childItemName) => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

(async () => {
    console.log('[Build] Iniciando processo de build corrigido...');
    
    // Limpa dist
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
    }
    fs.mkdirSync(distDir, { recursive: true });

    // 1. Copia as dependências (.cjs) sem alterar
    console.log('[Build] Copiando módulos e utilitários (mantendo .cjs)...');
    for (const dir of DIRS_TO_COPY) {
        const sourcePath = path.join(mainDir, dir);
        const destPath = path.join(distDir, dir);
        if (fs.existsSync(sourcePath)) {
            copyRecursiveSync(sourcePath, destPath);
            console.log(`   -> Copiado: ${dir}`);
        } else {
            console.warn(`   [AVISO] Pasta não encontrada: ${dir}`);
        }
    }

    // 2. Compila os arquivos principais (.jsc)
    console.log('[Build] Compilando Entry Points e Workers...');
    for (const file of FILES_TO_COMPILE) {
        const sourcePath = path.join(mainDir, file);
        const destPathJSC = path.join(distDir, file.replace(/\.cjs$/, '.jsc'));
        
        // Nota: Para o index.cjs, geralmente mantemos uma cópia .cjs de loader ou compilamos.
        // Se compilarmos o index.cjs, precisamos garantir que o package.json aponte para index.jsc ou ter um loader.
        // Para simplificar, se for index.cjs, vamos apenas copiar, a menos que você tenha um loader externo.
        if (file === 'index.cjs') {
            fs.copyFileSync(sourcePath, path.join(distDir, file));
            console.log(`   -> Copiado (Loader): ${file}`);
            continue;
        }

        if (fs.existsSync(sourcePath)) {
            try {
                await bytenode.compileFile({
                    filename: sourcePath,
                    output: destPathJSC,
                    electron: true,
                    electronVersion: electronVersion
                });
                console.log(`   -> Ofuscado: ${file}`);
            } catch (err) {
                console.error(`   [ERRO] Falha ao ofuscar ${file}:`, err.message);
            }
        } else {
            console.warn(`   [AVISO] Arquivo não encontrado: ${file}`);
        }
    }
    
    console.log('[Build] Concluído! Dependências .cjs preservadas.');
})();