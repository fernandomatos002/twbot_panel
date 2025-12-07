// src/components/modals/AddAccountModal.jsx
// (v16) - Extraído do TwAccountsManager
import React, { useState, useRef, useEffect } from 'react';

// A função 'getMessageClass' é passada como prop para consistência
export default function AddAccountModal({ isOpen, onClose, onAddAccount, proxies, getMessageClass }) {
    const [twUsername, setTwUsername] = useState('');
    const [worldNumber, setWorldNumber] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('br');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [selectedProxy, setSelectedProxy] = useState('');
    const usernameInputRef = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && usernameInputRef.current) {
            usernameInputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setMessage({ text: '', type: '' });
            setIsSubmitting(false);
            setTwUsername('');
            setWorldNumber('');
            setSelectedRegion('br');
            setSelectedProxy('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const freeProxies = (proxies || []).filter(p => !p.assignedTo && (p.status?.toLowerCase() === 'ativo' || p.status?.toLowerCase() === 'funcional' || p.status?.toLowerCase() === 'active'));
    const handleCloseModal = () => { onClose(); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setMessage({ text: '', type: '' });
        if (!twUsername || !worldNumber) { setMessage({ text: 'Preencha Usuário TW e ID do Mundo.', type: 'error' }); return; }

        setIsSubmitting(true);
        setMessage({ text: 'Adicionando conta...', type: 'info' });
        try {
            const accountData = { tw_username: twUsername, tw_world: worldNumber, region: selectedRegion, proxy_id: selectedProxy || null };
            await onAddAccount(accountData);
            setMessage({ text: 'Conta adicionada com sucesso!', type: 'success' });
            setTimeout(handleCloseModal, 1500);
        } catch (error) {
            setMessage({ text: `Erro ao iniciar adição: ${error.message}`, type: 'error' });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-yellow-500/30 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-yellow-400 mb-6">Adicionar Nova Conta TW</h3>
                <form id="add-tw-account-form" className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="tw-username" className="block mb-2 text-sm font-medium text-yellow-400">Usuário TW</label>
                        <input
                            type="text"
                            id="tw-username"
                            placeholder="Ex: meu_nick_tw"
                            required
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={twUsername}
                            onChange={(e) => setTwUsername(e.target.value)}
                            ref={usernameInputRef}
                        />
                    </div>
                    <div>
                        <label htmlFor="tw-world-region" className="block mb-2 text-sm font-medium text-yellow-400">Região do Mundo</label>
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
                        <label htmlFor="tw-world-number" className="block mb-2 text-sm font-medium text-yellow-400">ID do Mundo</label>
                        <input
                            type="text"
                            id="tw-world-number"
                            placeholder="Ex: 110, c2, s1"
                            required
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={worldNumber}
                            onChange={(e) => setWorldNumber(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="tw-proxy" className="block mb-2 text-sm font-medium text-yellow-400">Associar Proxy (Opcional)</label>
                        <select
                            id="tw-proxy"
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={selectedProxy}
                            onChange={(e) => setSelectedProxy(e.target.value)}
                        >
                            <option value="">Nenhum (Usar IP da máquina)</option>
                            {freeProxies.length > 0 ? (
                                freeProxies.map(proxy => (
                                    <option key={proxy.id} value={proxy.id}>
                                        {proxy.ip}:{proxy.port} ({proxy.country === 'Desconhecido' ? 'N/A' : proxy.country})
                                    </option>
                                ))
                            ) : (
                                <option value="" disabled>Nenhum proxy livre encontrado</option>
                            )}
                        </select>
                    </div>
                    {message.text && (
                        <div id="add-account-message" className={`p-4 text-sm rounded-lg ${getMessageClass(message.type)}`} style={{ display: 'block', marginTop: '10px' }}>
                            {message.text}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-3">
                        <button type="button" onClick={handleCloseModal} disabled={isSubmitting} className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={isSubmitting} className="py-2 px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 text-slate-900 rounded-lg font-bold disabled:opacity-50">
                            {isSubmitting ? 'Adicionando...' : 'Adicionar Conta'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}