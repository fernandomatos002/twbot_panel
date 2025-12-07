// src/components/GroupManager.jsx (ou src/GroupManager.jsx)
// (v21) - ATUALIZADO: Adiciona dropdown de Templates de Recrutamento
import React, { useState, useEffect, useCallback } from 'react';
import { PlusIcon, TrashIcon, PencilIcon, XMarkIcon, UsersIcon, ListBulletIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'; 

// --- Funções da API (serão expostas via window.api em preload.cjs) ---
const {
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    fetchConstructionLists,
    fetchRecruitmentTemplates // <-- (v21) NOVO
} = window.api || {}; 

// Função auxiliar para classes de mensagem
const getMessageClass = (type) => {
    if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
    if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
    return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
};


// --- Sub-componente Modal (para Criar/Editar Grupo) ---
function GroupModal({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData = null, 
    allAccounts = [], 
    constructionLists = [],
    recruitmentTemplates = [] // <-- (v21) NOVO
}) {
    const [name, setName] = useState('');
    const [selectedListId, setSelectedListId] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState(''); // <-- (v21) NOVO
    const [selectedAccountIds, setSelectedAccountIds] = useState([]); // Array de IDs (strings)
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setSelectedListId(initialData?.construction_list_id || '');
            setSelectedTemplateId(initialData?.recruitment_template_id || ''); // <-- (v21) NOVO
            setSelectedAccountIds(initialData?.accountIds?.map(String) || []);
            setErrorMessage('');
            setIsSaving(false);
        }
    }, [isOpen, initialData]);

    const handleAccountToggle = (accountId) => {
        const accountIdStr = String(accountId); // Garante string
        setSelectedAccountIds(prev =>
            prev.includes(accountIdStr)
                ? prev.filter(id => id !== accountIdStr)
                : [...prev, accountIdStr]
        );
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setErrorMessage('O nome do grupo é obrigatório.');
            return;
        }
        setIsSaving(true);
        setErrorMessage('');
        try {
            await onSave({
                id: initialData?.id, // Passa o ID se estiver editando
                name: name.trim(),
                constructionListId: selectedListId || null, 
                recruitmentTemplateId: selectedTemplateId || null, // <-- (v21) NOVO
                accountIds: selectedAccountIds // Array de strings
            });
            onClose(); // Fecha o modal em caso de sucesso
        } catch (error) {
            setErrorMessage(error.message || 'Erro desconhecido ao salvar.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-yellow-500/30 shadow-2xl w-full max-w-lg animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-yellow-400 mb-6">{initialData ? 'Editar Grupo' : 'Criar Novo Grupo'}</h3>
                {errorMessage && (
                    <div className={`p-3 mb-4 text-sm rounded-lg ${getMessageClass('error')}`}>{errorMessage}</div>
                )}
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* Nome do Grupo */}
                    <div className="mb-4">
                        <label htmlFor="group-name" className="block mb-2 text-sm font-medium text-yellow-400">Nome do Grupo</label>
                        <input
                            type="text"
                            id="group-name"
                            placeholder="Ex: Mundos Iniciais BR"
                            required
                            className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSaving}
                        />
                    </div>

                    {/* (v21) Grid para Seletores */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Seleção da Lista de Construção */}
                        <div>
                            <label htmlFor="group-construction-list" className="block mb-2 text-sm font-medium text-yellow-400">Lista de Construção</label>
                            <select
                                id="group-construction-list"
                                className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                                value={selectedListId}
                                onChange={(e) => setSelectedListId(e.target.value)}
                                disabled={isSaving}
                            >
                                <option value="">-- Nenhuma Lista --</option>
                                {constructionLists.map(list => (
                                    <option key={list.id} value={list.id}>{list.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* (v21) NOVO: Seleção do Alvo de Tropas */}
                        <div>
                            <label htmlFor="group-recruitment-template" className="block mb-2 text-sm font-medium text-yellow-400">Alvo de Tropas</label>
                            <select
                                id="group-recruitment-template"
                                className="w-full p-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-yellow-500 focus:border-yellow-500"
                                value={selectedTemplateId}
                                onChange={(e) => setSelectedTemplateId(e.target.value)}
                                disabled={isSaving}
                            >
                                <option value="">-- Nenhum Alvo --</option>
                                {recruitmentTemplates.map(tmpl => (
                                    <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>


                    {/* Seleção de Contas */}
                    <div className="mb-6">
                        <label className="block mb-2 text-sm font-medium text-yellow-400">Associar Contas TW</label>
                        <div className="max-h-60 overflow-y-auto border border-slate-600 rounded-lg p-3 bg-slate-700/50 space-y-2">
                            {allAccounts.length === 0 ? (
                                <p className="text-slate-400 text-sm italic">Nenhuma conta TW encontrada.</p>
                            ) : (
                                allAccounts.map(account => (
                                    <div key={account.id} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`account-${account.id}`}
                                            checked={selectedAccountIds.includes(String(account.id))}
                                            onChange={() => handleAccountToggle(account.id)}
                                            disabled={isSaving}
                                            className="w-4 h-4 text-yellow-600 bg-slate-600 border-slate-500 rounded focus:ring-yellow-500 focus:ring-2"
                                        />
                                        <label htmlFor={`account-${account.id}`} className="ml-2 text-sm text-slate-200">
                                            {account.tw_username} ({account.region.toUpperCase()}{account.tw_world})
                                        </label>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Botões */}
                    <div className="flex justify-end gap-3 pt-3">
                        <button type="button" onClick={onClose} disabled={isSaving} className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all disabled:opacity-50">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="py-2 px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 text-slate-900 rounded-lg font-bold disabled:opacity-50">
                            {isSaving ? 'Salvando...' : (initialData ? 'Salvar Alterações' : 'Criar Grupo')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


// --- Componente Principal ---
function GroupManager({ token, allAccounts = [] }) {
    const [groups, setGroups] = useState([]);
    const [constructionLists, setConstructionLists] = useState([]);
    const [recruitmentTemplates, setRecruitmentTemplates] = useState([]); // <-- (v21) NOVO
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null); 

    // --- (v21) Carregamento Inicial Atualizado ---
    const loadInitialData = useCallback(async () => {
        if (!fetchGroups || !fetchConstructionLists || !fetchRecruitmentTemplates) {
            setMessage({ text: 'Erro: API para buscar dados não disponível.', type: 'error' });
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setMessage({ text: '', type: '' });
        try {
            // Busca grupos, listas e templates em paralelo
            const [groupsResult, listsResult, templatesResult] = await Promise.all([
                fetchGroups(token),
                fetchConstructionLists(token),
                fetchRecruitmentTemplates(token) // <-- (v21) NOVO
            ]);

            if (groupsResult?.success) {
                setGroups(groupsResult.groups || []);
            } else {
                throw new Error(groupsResult?.message || 'Falha ao buscar grupos.');
            }

            if (listsResult?.success) {
                setConstructionLists(listsResult.lists || []);
            } else {
                setMessage({ text: `Aviso: ${listsResult?.message || 'Falha ao buscar listas de construção.'}`, type: 'error'});
                setConstructionLists([]);
            }

            // <-- (v21) NOVO -->
            if (templatesResult?.success) {
                setRecruitmentTemplates(templatesResult.templates || []);
            } else {
                setMessage({ text: `Aviso: ${templatesResult?.message || 'Falha ao buscar templates de recrutamento.'}`, type: 'error'});
                setRecruitmentTemplates([]);
            }
            // <-- FIM (v21) -->

        } catch (error) {
            setMessage({ text: `Erro ao carregar dados: ${error.message}`, type: 'error' });
            setGroups([]);
            setConstructionLists([]);
            setRecruitmentTemplates([]); // <-- (v21) NOVO
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            loadInitialData();
        } else {
             setMessage({ text: 'Erro: Usuário não autenticado.', type: 'error'});
             setIsLoading(false);
        }
    }, [loadInitialData, token]);


    // --- Handlers CRUD ---
    const handleOpenCreateModal = () => {
        setEditingGroup(null); 
        setIsModalOpen(true);
        setMessage({ text: '', type: '' });
    };

    const handleOpenEditModal = (group) => {
        setEditingGroup(group);
        setIsModalOpen(true);
        setMessage({ text: '', type: '' });
    };

    // (v21) Atualizado para enviar 'recruitmentTemplateId'
    const handleSaveGroup = async (groupData) => {
        setMessage({ text: 'Salvando grupo...', type: 'info' });
        try {
            let result;
            if (groupData.id) { // Editando
                if (!updateGroup) throw new Error('API de atualização de grupo indisponível.');
                result = await updateGroup(token, groupData.id, groupData);
                if (result?.success && result.group) {
                    setGroups(prev => prev.map(g => g.id === groupData.id ? result.group : g));
                    setMessage({ text: 'Grupo atualizado com sucesso!', type: 'success' });
                } else {
                    throw new Error(result?.message || 'Falha ao atualizar grupo.');
                }
            } else { // Criando
                if (!createGroup) throw new Error('API de criação de grupo indisponível.');
                result = await createGroup(token, { name: groupData.name }); 
                if (result?.success && result.group) {
                    const fullGroupData = { ...result.group, ...groupData, id: result.group.id };
                     if (!updateGroup) throw new Error('API de atualização de grupo indisponível para salvar associações.');
                     const updateResult = await updateGroup(token, result.group.id, fullGroupData);
                     if (updateResult?.success && updateResult.group) {
                        setGroups(prev => [...prev, updateResult.group].sort((a,b) => a.name.localeCompare(b.name)));
                        setMessage({ text: 'Grupo criado com sucesso!', type: 'success' });
                     } else {
                         console.error("Falha ao associar dados após criar grupo:", updateResult?.message);
                         setGroups(prev => [...prev, result.group].sort((a,b) => a.name.localeCompare(b.name))); 
                         throw new Error(`Grupo criado, mas falha ao associar dados: ${updateResult?.message}`);
                     }

                } else {
                    throw new Error(result?.message || 'Falha ao criar grupo.');
                }
            }
        } catch (error) {
            setMessage({ text: `Erro ao salvar grupo: ${error.message}`, type: 'error' });
            throw error; // Re-lança para o modal exibir o erro
        }
    };

     const handleDeleteGroup = async (groupId, groupName) => {
        if (!deleteGroup) {
             setMessage({ text: 'Erro: API para excluir grupo não disponível.', type: 'error' });
             return;
        }
        if (!window.confirm(`Tem certeza que deseja excluir o grupo "${groupName}"? Contas associadas NÃO serão excluídas, apenas desvinculadas.`)) {
            return;
        }

        setMessage({ text: `Excluindo grupo "${groupName}"...`, type: 'info' });
        setIsLoading(true); 

        try {
            const result = await deleteGroup(token, groupId);
            if (result?.success) {
                setGroups(prev => prev.filter(g => g.id !== groupId));
                setMessage({ text: 'Grupo excluído com sucesso!', type: 'success' });
            } else {
                throw new Error(result?.message || 'Falha ao excluir grupo.');
            }
        } catch (error) {
             setMessage({ text: `Erro ao excluir grupo: ${error.message}`, type: 'error' });
        } finally {
             setIsLoading(false);
        }
     };

     // (v21) Helpers para buscar nomes
     const getListName = (listId) => {
         const list = constructionLists.find(l => l.id === listId);
         return list ? list.name : <span className="italic text-slate-500">Nenhuma</span>;
     };
     const getTemplateName = (templateId) => {
         const template = recruitmentTemplates.find(t => t.id === templateId);
         return template ? template.name : <span className="italic text-slate-500">Nenhum</span>;
     };


    return (
        <div id="group-manager-section">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-yellow-400">👥 Gerenciador de Grupos</h2>
                 <button
                    onClick={handleOpenCreateModal}
                    disabled={isLoading}
                    className="py-2 px-4 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold text-sm transition-all flex items-center disabled:opacity-50"
                 >
                    <PlusIcon className="w-5 h-5 mr-1" /> Criar Novo Grupo
                 </button>
            </div>

            {/* Mensagem de Feedback */}
            {message.text && (
                <div className={`p-3 text-sm rounded-lg ${getMessageClass(message.type)} mb-4 flex justify-between items-center`}>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage({text: '', type: ''})} className="font-bold text-lg px-2 leading-none">&times;</button>
                </div>
            )}

            {/* Lista de Grupos */}
            <div className="rounded-lg bg-slate-800/50 backdrop-blur border border-slate-700/50 overflow-hidden">
                {isLoading ? (
                    <p className="p-6 text-center text-slate-400">Carregando grupos...</p>
                ) : groups.length === 0 ? (
                    <p className="p-6 text-center text-slate-400">Nenhum grupo criado ainda.</p>
                ) : (
                    <ul className="divide-y divide-slate-700/50">
                        {groups.map(group => (
                            <li key={group.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-700/30">
                                <div className="flex-1 min-w-[200px]">
                                    <p className="font-semibold text-white">{group.name}</p>
                                    {/* (v21) Info de Associações Atualizada */}
                                    <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>
                                            <UsersIcon className="w-3 h-3 inline mr-1" />
                                            Contas: {group.accountIds?.length || 0}
                                        </span>
                                        <span>
                                            <ListBulletIcon className="w-3 h-3 inline mr-1" />
                                            Construção: {getListName(group.construction_list_id)}
                                        </span>
                                        <span>
                                            <ShieldCheckIcon className="w-3 h-3 inline mr-1" />
                                            Recrutamento: {getTemplateName(group.recruitment_template_id)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                     <button
                                        onClick={() => handleOpenEditModal(group)}
                                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs"
                                        title="Editar Grupo"
                                    >
                                        <PencilIcon className="w-4 h-4"/>
                                    </button>
                                     <button
                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                        className="p-2 bg-red-700 hover:bg-red-600 text-white rounded-md text-xs"
                                        title="Excluir Grupo"
                                    >
                                        <TrashIcon className="w-4 h-4"/>
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Modal */}
            <GroupModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveGroup}
                initialData={editingGroup}
                allAccounts={allAccounts}
                constructionLists={constructionLists}
                recruitmentTemplates={recruitmentTemplates} // <-- (v21) NOVO
            />

        </div>
    );
}

export default GroupManager;