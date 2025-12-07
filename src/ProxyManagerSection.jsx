// src/ProxyManagerSection.jsx

import React, { useState } from 'react';

// Mapeamento ampliado de códigos de país para nomes (NOVO)
const COUNTRY_NAMES = {
    // América do Sul
    'BR': 'Brasil',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colômbia',
    'PE': 'Peru',
    
    // América do Norte e Central
    'US': 'Estados Unidos',
    'CA': 'Canadá',
    'MX': 'México',
    
    // Europa Ocidental e Sul
    'PT': 'Portugal',
    'ES': 'Espanha',
    'FR': 'França',
    'DE': 'Alemanha',
    'GB': 'Reino Unido', // Ou 'UK'
    'NL': 'Holanda',
    'IT': 'Itália',
    'BE': 'Bélgica',
    'CH': 'Suíça',
    'SE': 'Suécia',
    'NO': 'Noruega',

    // Europa Oriental
    'RU': 'Rússia',
    'PL': 'Polônia',
    'UA': 'Ucrânia',
    
    // Ásia
    'JP': 'Japão',
    'CN': 'China',
    'KR': 'Coreia do Sul',
    'IN': 'Índia',
    'ID': 'Indonésia',
    
    // Oceania
    'AU': 'Austrália',
    'NZ': 'Nova Zelândia',

    // Oriente Médio
    'TR': 'Turquia',
    
    // África
    'ZA': 'África do Sul',
    // ... Adicione mais conforme necessário
};


// --- Sub-componente: Renderiza a célula de Status do Proxy ---
function ProxyStatus({ status }) {
    if (!status) return <span className="text-gray-500 font-bold">N/A</span>;
    
    const normalizedStatus = status.toLowerCase();

    const statusClasses = {
        'ativo': 'text-green-400 font-bold',
        'funcional': 'text-green-400 font-bold',
        'pendente': 'text-yellow-400 font-bold',
        'erro': 'text-red-400 font-bold',
        'falha': 'text-red-400 font-bold',
        'testando': 'text-blue-400 font-bold animate-pulse', 
    };

    // CORREÇÃO CRÍTICA: Acesso ao objeto/map usa colchetes [ ]
    const className = statusClasses[normalizedStatus] || 'text-yellow-400 font-bold';
    return <span className={className}>{status}</span>;
}

// Função auxiliar para classes de mensagem
const getMessageClass = (type) => {
    if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
    if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
    return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
}

// Função auxiliar para análise da string de proxies (Lógica em Lote)
function parseProxyList(text) {
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');
    const proxies = [];

    for (const line of lines) {
        const parts = line.split(':');
        
        if (parts.length < 2 || parts.length === 3 || parts.length > 4) {
             throw new Error(`Linha inválida: "${line}". Formato deve ser IP:PORT ou IP:PORT:USER:PASS.`);
        }
        
        // Uso de desestruturação para obter os campos, com defaults
        const [ip, port, user = '', pass = ''] = parts;
        
        proxies.push({ ip, port, user, pass });
    }
    return proxies;
}

// Sub-componente Modal de Confirmação
function ConfirmationModal({ message, onConfirm, onCancel, targetIp }) {
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-red-500/30 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-red-400 mb-4">⚠️ Confirmação</h3>
                <p className="text-slate-300 mb-6 font-semibold">
                    {message}
                </p>
                
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onCancel}
                        className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="py-2 px-4 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-all"
                    >
                        Excluir {targetIp ? `(${targetIp})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Componente Principal da Seção de Gerenciamento de Proxies ---
function ProxyManagerSection({ initialProxies = [], onAddProxies, onDeleteProxy }) { 
  
  const [proxyListText, setProxyListText] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false); 
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [proxyToDelete, setProxyToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Handlers de Formulário e Exclusão ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; 
    
    if (!proxyListText.trim()) {
        setMessage({ text: 'Insira pelo menos um proxy na lista.', type: 'error' });
        return;
    }

    setIsSubmitting(true);
    setMessage({ text: 'Analisando e adicionando proxies...', type: 'info' });
    let parsedProxies = [];
    
    try {
        parsedProxies = parseProxyList(proxyListText);
    } catch (error) {
        setMessage({ text: `Erro de formatação: ${error.message}`, type: 'error' });
        setIsSubmitting(false);
        return;
    }
    
    setMessage({ 
        text: `Processando ${parsedProxies.length} proxies. O status de checagem será atualizado pelo servidor.`, 
        type: 'info' 
    });

    try {
      await onAddProxies(parsedProxies); 
      
      setMessage({ text: `${parsedProxies.length} proxies adicionados com sucesso! O status final será exibido em breve.`, type: 'success' });
      setProxyListText('');
    } catch (error) {
      setMessage({ text: `Falha ao processar proxies: ${error.message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Função para abrir o modal de confirmação
  const confirmDelete = (proxyId, ip) => {
      if (!proxyId) {
          setMessage({ text: 'Erro: O ID do proxy não está disponível para exclusão.', type: 'error' });
          return;
      }
      setProxyToDelete({ id: proxyId, ip: ip });
      setIsDeleteModalOpen(true);
  };
  
  // Função que executa a exclusão após a confirmação no modal
  const executeDelete = async () => {
      if (!proxyToDelete || !proxyToDelete.id) {
          setMessage({ text: 'Erro interno: ID do proxy não encontrado.', type: 'error' });
          setIsDeleteModalOpen(false);
          setProxyToDelete(null);
          return;
      }
      
      const { id: proxyId, ip } = proxyToDelete;
      setIsDeleteModalOpen(false); 
      setMessage({ text: `Deletando proxy ${ip}...`, type: 'info' });
      
      try {
          await onDeleteProxy(proxyId);
          setMessage({ text: `Proxy ${ip} removido com sucesso.`, type: 'success' });
      } catch (error) {
          setMessage({ text: `Erro ao deletar proxy ${ip}: ${error.message}`, type: 'error' });
      } finally {
          setProxyToDelete(null);
      }
  };

  
  return (
    <div id="proxy-manager-section">
      <h2 className="text-2xl font-black text-yellow-400 mb-4">🛡️ Gerenciador de Proxies</h2> 
      
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-400 text-sm">Adicione seus proxies em lote no formato IP:PORT ou IP:PORT:USUARIO:SENHA.</p>
        
        <button 
            onClick={() => setIsBuyModalOpen(true)}
            className="py-2 px-4 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm font-bold transition-all"
        >
            🛒 Comprar Proxies
        </button>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> 
        
        {/* --- Coluna 1: Formulário de Adição de Proxy (LOTE) --- */}
        <div className="lg:col-span-1 space-y-6"> 
          <div className="rounded-xl bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6"> 
            <h3 className="text-lg font-bold text-white mb-4">Adicionar Lote de Proxies</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="proxy-list" className="block mb-2 text-xs font-medium text-yellow-400">Lista de Proxies (um por linha)</label> 
                <textarea id="proxy-list" name="proxyListText" placeholder="Ex: 127.0.0.1:8080" required rows="10"
                  className="w-full p-2.5 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                  value={proxyListText}
                  onChange={(e) => setProxyListText(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 text-slate-900 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adicionando...' : 'Adicionar Proxies'}
              </button>
              
              {message.text && (
                 <div className={`p-3 text-xs rounded-lg ${getMessageClass(message.type)}`} style={{ marginTop: '10px' }}>
                   {message.text}
                 </div>
              )}
            </form>
          </div>
        </div>
        
        {/* --- Coluna 2/3: Tabela de Proxies --- */}
        <div className="lg:col-span-2 space-y-6"> 
          <div className="rounded-xl bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6"> 
            <h3 className="text-lg font-bold text-white mb-4">Proxies Registrados ({initialProxies.length})</h3>
            
            <div className="">
              
              <table className="w-full text-left text-sm"> 
                <thead>
                  <tr className="border-b border-slate-700">
                    {/* Largura da Coluna: PAÍS */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-16">PAÍS</th> 
                    
                    {/* Largura da Coluna: ENDEREÇO */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-36">ENDEREÇO</th>
                    
                    {/* Largura da Coluna: AUTH */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-16">AUTH</th>
                    
                    {/* Largura da Coluna: USADO POR */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-32">USADO POR</th> 
                    
                    {/* Largura da Coluna: STATUS */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-20">STATUS</th>
                    
                    {/* Largura da Coluna: ÚLTIMO TESTE */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-16">ÚLTIMO TESTE</th>
                    
                    {/* Largura da Coluna: AÇÕES */}
                    <th className="p-2 text-xs font-bold uppercase text-slate-400 w-16">AÇÕES</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {initialProxies.map((proxy) => (
                    <tr key={proxy.id || `${proxy.ip}:${proxy.port}`} className="border-b border-slate-800 hover:bg-slate-800/50">
                      
                      {/* Célula País (EXIBINDO O NOME COMPLETO COM FALLBACK) */}
                      <td className="p-2 w-16">
                          <span className='text-xs font-semibold text-slate-400'>
                              {proxy.country === 'Desconhecido' 
                                  ? 'N/A' 
                                  : (COUNTRY_NAMES[proxy.country] || proxy.country)} 
                          </span>
                      </td> 

                      {/* Célula Endereço (w-36) */}
                      <td className="p-2 w-36">{proxy.ip}:{proxy.port}</td>
                      
                      {/* Célula Auth (w-16) */}
                      <td className="p-2 w-16">{proxy.user ? 'Sim' : 'Não'}</td>
                      
                      {/* Célula "Usado por" (w-32) */}
                      {/* MODIFICAÇÃO (Etapa 3 - Correção de Bug): Lógica atualizada */}
                      <td className="p-2 w-32">
                        {(() => {
                            if (proxy.assignedTo) {
                                return <span className='text-red-400 font-semibold text-xs'>{proxy.assignedTo}</span>;
                            }
                            const status = proxy.status?.toLowerCase();
                            if (status === 'ativo' || status === 'funcional') {
                                return <span className='text-green-400 font-semibold text-xs'>Livre</span>;
                            }
                            // Se não estiver atribuído, mas também não estiver ativo (ex: Pendente, Erro),
                            // será marcado como Indisponível.
                            return <span className='text-yellow-400 font-semibold text-xs'>Indisponível</span>;
                        })()}
                      </td> 
                      
                      {/* Célula Status (w-20) */}
                      <td className="p-2 w-20">
                        <ProxyStatus status={proxy.status} /> 
                      </td>
                      
                      {/* Célula Último Teste (w-16) */}
                      <td className="p-2 text-xs text-slate-400 w-16">
                        {proxy.last_tested_at ? new Date(proxy.last_tested_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Nunca'}
                      </td>
                      
                      {/* Célula Ações (w-16) */}
                      <td className="p-2 w-16">
                        <button 
                            onClick={() => confirmDelete(proxy.id, proxy.ip)}
                            disabled={!proxy.id} 
                            className="py-1 px-3 bg-red-700 hover:bg-red-600 rounded text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {initialProxies.length === 0 && (
              <p className="text-center text-slate-400 mt-4 text-sm">
                Nenhum proxy adicionado.
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Modal de Compra/Exclusão */}
      {isBuyModalOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-slate-800 p-8 rounded-xl border border-yellow-500/30 shadow-2xl w-full max-w-md">
                  <h3 className="text-2xl font-bold text-yellow-400 mb-4">🛒 Comprar Proxies</h3>
                  <p className="text-slate-300 mb-6">
                      Funcionalidade em desenvolvimento.
                  </p>
                  <button 
                      onClick={() => setIsBuyModalOpen(false)}
                      className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-lg"
                  >
                      Fechar
                  </button>
              </div>
          </div>
      )}
      
      {isDeleteModalOpen && proxyToDelete && (
          <ConfirmationModal
              message={`Você está prestes a deletar o proxy ${proxyToDelete.ip}. Esta ação não pode ser desfeita.`}
              onConfirm={executeDelete}
              onCancel={() => setIsDeleteModalOpen(false)}
              targetIp={proxyToDelete.ip}
          />
      )}
    </div>
  );
}

export default ProxyManagerSection;