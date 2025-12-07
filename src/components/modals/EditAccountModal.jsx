// src/components/modals/EditAccountModal.jsx
// (v25) - Adiciona checkboxes para automação de Fazenda e Armazém
import React, { useState, useRef, useEffect } from 'react';

// A função 'getMessageClass' é passada como prop para consistência
export default function EditAccountModal({ isOpen, onClose, onUpdateAccount, proxies, initialData, getMessageClass }) {
    // Estados do Formulário (Campos Originais)
    const [twUsername, setTwUsername] = useState(initialData?.tw_username || '');
    const [worldNumber, setWorldNumber] = useState(initialData?.tw_world || '');
    const [selectedRegion, setSelectedRegion] = useState(initialData?.region || 'br');
    const [selectedProxy, setSelectedProxy] = useState(initialData?.proxy_id || '');
    
    // --- (v25) INÍCIO DA MODIFICAÇÃO ---
    // Estados do Formulário (Novos Campos)
    const [autoFarm, setAutoFarm] = useState(initialData?.auto_farm_enabled || false);
    const [autoWarehouse, setAutoWarehouse] = useState(initialData?.auto_warehouse_enabled || false);
    // --- (v25) FIM DA MODIFICAÇÃO ---

    const [message, setMessage] = useState({ text: '', type: '' });
    const usernameInputRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && initialData) {
            // Popula os dados originais
            setTwUsername(initialData.tw_username || '');
            setWorldNumber(initialData.tw_world || '');
            setSelectedRegion(initialData.region || 'br');
            setSelectedProxy(initialData.proxy_id || '');
            
            // --- (v25) INÍCIO DA MODIFICAÇÃO ---
            // Popula os novos dados de automação
            setAutoFarm(initialData.auto_farm_enabled || false);
            setAutoWarehouse(initialData.auto_warehouse_enabled || false);
            // --- (v25) FIM DA MODIFICAÇÃO ---

            setMessage({ text: '', type: '' });
            setIsSubmitting(false);
            if (usernameInputRef.current) {
                usernameInputRef.current.focus();
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen || !initialData) return null;

    const availableProxies = (proxies || []).filter(p => {
        const isCurrentProxy = p.id === initialData.proxy_id;
        const isFreeAndActive = !p.assignedTo && (p.status?.toLowerCase() === 'ativo' || p.status?.toLowerCase() === 'funcional' || p.status?.toLowerCase() === 'active');
        return isCurrentProxy || isFreeAndActive;
    });

    const handleCloseModal = () => {
        setMessage({ text: '', type: '' });
        setIsSubmitting(false);
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setMessage({ text: '', type: '' });
        if (!twUsername || !worldNumber) {
            setMessage({ text: 'Preencha Usuário TW e ID do Mundo.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        setMessage({ text: 'Atualizando conta...', type: 'info' });

        // --- (v25) INÍCIO DA MODIFICAÇÃO (Payload) ---
        // Compara o estado atual com o 'initialData' e envia apenas o que mudou
        const updatePayload = {};
        if (twUsername !== initialData.tw_username) { updatePayload.tw_username = twUsername; }
        if (worldNumber !== initialData.tw_world) { updatePayload.tw_world = worldNumber; }
        if (selectedRegion !== initialData.region) { updatePayload.region = selectedRegion; }
        
        const newProxyId = selectedProxy || null;
        const oldProxyId = initialData.proxy_id || null;
        if (newProxyId !== oldProxyId) { updatePayload.proxy_id = newProxyId; }

        // Compara os novos booleanos
        if (autoFarm !== (initialData.auto_farm_enabled || false)) {
            updatePayload.auto_farm_enabled = autoFarm;
        }
        if (autoWarehouse !== (initialData.auto_warehouse_enabled || false)) {
            updatePayload.auto_warehouse_enabled = autoWarehouse;
        }
        // --- (v25) FIM DA MODIFICAÇÃO (Payload) ---

        if (Object.keys(updatePayload).length === 0) {
            setMessage({ text: 'Nenhuma alteração detectada.', type: 'info' });
            setIsSubmitting(false);
            setTimeout(handleCloseModal, 1500);
            return;
        }

        try {
            await onUpdateAccount(initialData.id, updatePayload);
            setMessage({ text: 'Conta atualizada com sucesso!', type: 'success' });
            setTimeout(handleCloseModal, 1500);
        } catch (error) {
            setMessage({ text: `Erro ao iniciar atualização: ${error.message}`, type: 'error' });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-yellow-500/30 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-yellow-400 mb-6">Editar Conta TW ({initialData.tw_username})</h3>
                <form id="edit-tw-account-form" className="space-y-4" onSubmit={handleSubmit}>
                    
                    {/* --- Campos Originais --- */}
                    <div>
                        <label htmlFor="edit-tw-username" className="block mb-2 text-sm font-medium text-yellow-400">Usuário TW</label>
                        <input
                            type="text"
                            id="edit-tw-username"
                            required
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={twUsername}
                            onChange={(e) => setTwUsername(e.target.value)}
                            ref={usernameInputRef}
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-tw-world-region" className="block mb-2 text-sm font-medium text-yellow-400">Região do Mundo</label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-600 mb-4">
                            <button
                                type="button"
                                onClick={() => setSelectedRegion('br')}
                                className={`flex-1 py-3 px-4 text-sm font-bold transition-all ${selectedRegion === 'br' ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            >🇧🇷 BR</button>
                            <button
                                type="button"
                                onClick={() => setSelectedRegion('pt')}
                                className={`flex-1 py-3 px-4 text-sm font-bold transition-all ${selectedRegion === 'pt' ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                            >🇵🇹 PT</button>
                        </div>
                        <label htmlFor="edit-tw-world-number" className="block mb-2 text-sm font-medium text-yellow-400">ID do Mundo</label>
                        <input
                            type="text"
                            id="edit-tw-world-number"
                            required
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={worldNumber}
                            onChange={(e) => setWorldNumber(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-tw-proxy" className="block mb-2 text-sm font-medium text-yellow-400">Associar Proxy</label>
                        <select
                            id="edit-tw-proxy"
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={selectedProxy}
                            onChange={(e) => setSelectedProxy(e.target.value)}
                        >
                            <option value="">Nenhum (Usar IP da máquina)</option>
                            {availableProxies.length > 0 ? (
                                availableProxies.map(proxy => (
                                    <option key={proxy.id} value={proxy.id}>
                                        {proxy.ip}:{proxy.port} ({proxy.country === 'Desconhecido' ? 'N/A' : proxy.country})
                                        {proxy.id === initialData.proxy_id ? ' (Atual)' : ''}
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>Nenhum proxy disponível encontrado</option>
                            )}
                        </select>
                    </div>

                    {/* --- (v25) INÍCIO DA MODIFICAÇÃO (Novos Campos JSX) --- */}
                    <div className="border-t border-slate-700 pt-4">
                        <h4 className="text-md font-semibold text-white mb-3">Automação de Construção</h4>
                        <div className="flex items-center">
                            <input
                                id="auto_farm_enabled"
                                name="auto_farm_enabled"
                                type="checkbox"
                                checked={autoFarm}
                                onChange={e => setAutoFarm(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-yellow-600 focus:ring-yellow-500"
                            />
                            <label htmlFor="auto_farm_enabled" className="ml-3 block text-sm font-medium text-slate-300">
                                Evoluir Fazenda automaticamente (Prioridade)
                            </label>
                        </div>
                        <p className="ml-7 text-xs text-slate-500">Se a população atingir 80%, a Fazenda será construída (se houver recursos).</p>

                        <div className="flex items-center mt-4">
                            <input
                                id="auto_warehouse_enabled"
                                name="auto_warehouse_enabled"
                                type="checkbox"
                                checked={autoWarehouse}
                                onChange={e => setAutoWarehouse(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-yellow-600 focus:ring-yellow-500"
                            />
                            <label htmlFor="auto_warehouse_enabled" className="ml-3 block text-sm font-medium text-slate-300">
                                Evoluir Armazém automaticamente (Prioridade)
                            </label>
                        </div>
                        <p className="ml-7 text-xs text-slate-500">Se o próximo item da lista de construção custar mais que a capacidade atual.</p>
                    </div>
                    {/* --- (v25) FIM DA MODIFICAÇÃO --- */}


                    {message.text && (
                        <div id="edit-account-message" className={`p-4 text-sm rounded-lg ${getMessageClass(message.type)}`} style={{ display: 'block', marginTop: '10px' }}>
                            {message.text}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-3">
                        <button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 text-slate-900 rounded-lg font-bold disabled:opacity-50">
                            {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}