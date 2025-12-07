const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'preload', 'preload.cjs');
const destDir = path.join(__dirname, 'dist', 'preload');
const dest = path.join(destDir, 'preload.cjs');

console.log('[CopyPreload] Copiando preload...');

if (!fs.existsSync(src)) {
    console.error('[Erro] Arquivo preload não encontrado em:', src);
    process.exit(1);
}

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(src, dest);
console.log('[CopyPreload] Sucesso! Copiado para:', dest);