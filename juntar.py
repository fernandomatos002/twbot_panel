import os

# Configuração
ARQUIVO_SAIDA = 'projeto_completo.txt'

# Pastas para ignorar (lixo, build, git)
PASTAS_IGNORAR = {
    'node_modules', '.git', 'dist', 'dist-renderer', 
    'release-builds', 'build', 'backup', '.vscode'
}

# Arquivos específicos para ignorar
ARQUIVOS_IGNORAR = {
    'package-lock.json', 'juntar.py', ARQUIVO_SAIDA, 
    'vite.config.js.timestamp'
}

# Extensões que vamos ler
EXTENSOES_ACEITAS = ('.js', '.cjs', '.mjs', '.ts', '.tsx', '.vue', '.html', '.css', '.json')

def juntar_tudo():
    print("Iniciando a leitura dos arquivos...")
    with open(ARQUIVO_SAIDA, 'w', encoding='utf-8') as saida:
        saida.write(f"ESTRUTURA DO PROJETO TRIBAL WARS BOT\n{'='*40}\n\n")
        
        for root, dirs, files in os.walk("."):
            # Remove pastas ignoradas da busca
            dirs[:] = [d for d in dirs if d not in PASTAS_IGNORAR]
            
            for file in files:
                # Pula arquivos ignorados ou timestamps
                if file in ARQUIVOS_IGNORAR or 'timestamp' in file:
                    continue

                if file.endswith(EXTENSOES_ACEITAS):
                    caminho_completo = os.path.join(root, file)
                    
                    saida.write(f"\n{'='*20}\n")
                    saida.write(f"ARQUIVO: {caminho_completo}\n")
                    saida.write(f"{'='*20}\n")
                    
                    try:
                        # errors='ignore' evita travar se tiver algum caractere estranho
                        with open(caminho_completo, 'r', encoding='utf-8', errors='ignore') as f:
                            conteudo = f.read()
                            saida.write(conteudo)
                        print(f"Lido: {file}")
                    except Exception as e:
                        saida.write(f"[Erro ao ler este arquivo: {e}]")
                    
                    saida.write("\n")

    print(f"\nSucesso! Tudo salvo em: {ARQUIVO_SAIDA}")

if __name__ == "__main__":
    juntar_tudo()