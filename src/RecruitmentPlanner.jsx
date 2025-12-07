// src/RecruitmentPlanner.jsx
// (v21) - NOVO: Planejador de Recrutamento (Alvo de Tropas)
import React, { useState, useEffect, useCallback } from 'react';

// --- Ícones Lucide ---
import {
    Plus, Save, Trash2, X, ShieldCheckIcon, UsersIcon
} from 'lucide-react';

// --- Configuração de Tropas ---
import { TROOPS_CONFIG, TROOP_NAMES } from './config/troops.jsx';

// --- Funções da API (expostas via window.api) ---
const {
    fetchRecruitmentTemplates,
    createRecruitmentTemplate,
    updateRecruitmentTemplate,
    deleteRecruitmentTemplate
} = window.api || {}; // (Presume que 'window.api' será atualizado para expor isso)

// --- Funções Auxiliares ---

// Função auxiliar para classes de mensagem
const getMessageClass = (type) => {
    if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
    if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
    return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
};

// Template Padrão Vazio
const EMPTY_TEMPLATE = {
    spear: 0, sword: 0, axe: 0, archer: 0,
    spy: 0, light: 0, marcher: 0, heavy: 0,
    ram: 0, catapult: 0, knight: 0
};

// --- Componente Principal ---

function RecruitmentPlanner({ token }) {
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [currentTemplateName, setCurrentTemplateName] = useState('');
    const [currentTarget, setCurrentTarget] = useState(EMPTY_TEMPLATE);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // --- Carregamento Inicial ---
    const loadTemplates = useCallback(async () => {
        if (!fetchRecruitmentTemplates) {
            setMessage({ text: 'Erro: API para buscar templates não disponível.', type: 'error' });
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const result = await fetchRecruitmentTemplates(token);
            if (result?.success) {
                setTemplates(result.templates || []);
            } else {
                throw new Error(result?.message || 'Falha ao buscar templates do servidor.');
            }
        } catch (error) {
            setMessage({ text: `Erro ao carregar templates: ${error.message}`, type: 'error' });
            setTemplates([]);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            loadTemplates();
        } else {
            setMessage({ text: 'Erro: Usuário não autenticado.', type: 'error' });
            setIsLoading(false);
        }
    }, [loadTemplates, token]);

    // --- Manipuladores ---

    const handleTemplateSelectionChange = (event) => {
        const templateId = event.target.value;
        setSelectedTemplateId(templateId);

        if (templateId === 'new') {
            setCurrentTemplateName('');
            setCurrentTarget(EMPTY_TEMPLATE);
        } else if (templateId) {
            const selected = templates.find(l => l.id === templateId);
            if (selected) {
                setCurrentTemplateName(selected.name);
                // Mescla o template salvo com o EMPTY_TEMPLATE para garantir que todos os campos existam
                setCurrentTarget({ ...EMPTY_TEMPLATE, ...(selected.template || {}) });
            }
        } else {
            setCurrentTemplateName('');
            setCurrentTarget(EMPTY_TEMPLATE);
        }
        setMessage({ text: '', type: '' });
    };

    const hasChanges = () => {
        if (selectedTemplateId === 'new') return true;
        const originalTemplate = templates.find(l => l.id === selectedTemplateId);
        if (!originalTemplate) return false;
        if (originalTemplate.name !== currentTemplateName.trim()) return true;

        // Compara os alvos (garantindo que ambos tenham as mesmas chaves)
        const originalTarget = { ...EMPTY_TEMPLATE, ...(originalTemplate.template || {}) };
        return JSON.stringify(originalTarget) !== JSON.stringify(currentTarget);
    };
    const canSave = hasChanges() && currentTemplateName.trim() !== '';

    // Manipulador para alterar o valor de uma tropa
    const handleTargetChange = (unitId, value) => {
        const newValue = Math.max(0, parseInt(value, 10) || 0); // Garante número positivo
        setCurrentTarget(prev => ({
            ...prev,
            [unitId]: newValue
        }));
    };

    // Salvar (Criar ou Atualizar)
    const handleSaveTemplate = async () => {
        if (!currentTemplateName.trim()) {
            setMessage({ text: 'Por favor, dê um nome ao template.', type: 'error' });
            return;
        }
        if (!hasChanges()) {
            setMessage({ text: 'Nenhuma alteração para salvar.', type: 'info' });
            return;
        }

        setIsSaving(true);
        setMessage({ text: 'Salvando template...', type: 'info' });

        // Remove chaves com valor 0 para economizar espaço no DB (opcional, mas limpo)
        const templateToSave = {};
        for (const unitId in currentTarget) {
            if (currentTarget[unitId] > 0) {
                templateToSave[unitId] = currentTarget[unitId];
            }
        }

        const templateData = {
            name: currentTemplateName.trim(),
            template: templateToSave,
        };

        try {
            let result;
            let savedTemplate;

            if (selectedTemplateId === 'new') {
                if (!createRecruitmentTemplate) throw new Error("API indisponível.");
                result = await createRecruitmentTemplate(token, templateData);
                if (result?.success && result.template) {
                    savedTemplate = result.template;
                    setMessage({ text: 'Template criado!', type: 'success' });
                    setTemplates(prev => [...prev, savedTemplate].sort((a, b) => a.name.localeCompare(b.name)));
                    setSelectedTemplateId(savedTemplate.id);
                } else {
                    throw new Error(result?.message || 'Falha ao criar.');
                }
            } else {
                if (!updateRecruitmentTemplate) throw new Error("API indisponível.");
                result = await updateRecruitmentTemplate(token, selectedTemplateId, templateData);
                if (result?.success && result.template) {
                    savedTemplate = result.template;
                    setMessage({ text: 'Template atualizado!', type: 'success' });
                    setTemplates(prev => prev.map(l => l.id === selectedTemplateId ? savedTemplate : l).sort((a, b) => a.name.localeCompare(b.name)));
                } else {
                    throw new Error(result?.message || 'Falha ao atualizar.');
                }
            }
            
            // Recarrega o estado com os dados salvos (para normalizar)
            setCurrentTemplateName(savedTemplate.name);
            setCurrentTarget({ ...EMPTY_TEMPLATE, ...(savedTemplate.template || {}) });

        } catch (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Excluir
    const handleDeleteTemplate = async () => {
        if (!selectedTemplateId || selectedTemplateId === 'new') {
            setMessage({ text: 'Nenhum template salvo selecionado.', type: 'error' });
            return;
        }
        if (!deleteRecruitmentTemplate) {
            setMessage({ text: 'API indisponível.', type: 'error' });
            return;
        }

        if (!window.confirm(`Excluir o template "${currentTemplateName}"?`)) return;

        setIsLoading(true);
        setMessage({ text: `Excluindo "${currentTemplateName}"...`, type: 'info' });

        try {
            const result = await deleteRecruitmentTemplate(token, selectedTemplateId);
            if (result?.success) {
                setMessage({ text: 'Template excluído!', type: 'success' });
                setTemplates(prev => prev.filter(l => l.id !== selectedTemplateId));
                setSelectedTemplateId('');
                setCurrentTemplateName('');
                setCurrentTarget(EMPTY_TEMPLATE);
            } else {
                throw new Error(result?.message || 'Falha ao excluir.');
            }
        } catch (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };


    // --- Renderização ---

    return (
        <div className="p-1">
            <h2 className="text-2xl font-bold text-yellow-400 mb-5 flex items-center gap-2">
                <UsersIcon size={24} className="text-amber-400" /> Planejador de Recrutamento
            </h2>

            {/* Barra de Gerenciamento */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 mb-6 shadow-lg flex flex-wrap items-center gap-4 sticky top-20 z-10">
                <div className="flex-shrink-0">
                    <label htmlFor="template-select" className="sr-only">Selecionar ou Criar Template</label>
                    <select
                        id="template-select"
                        value={selectedTemplateId}
                        onChange={handleTemplateSelectionChange}
                        disabled={isLoading || isSaving}
                        className="p-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm h-10"
                    >
                        <option value="">-- Carregar Template --</option>
                        <option value="new">✨ Criar Novo...</option>
                        {isLoading && <option disabled>Carregando...</option>}
                        {!isLoading && templates.map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                    </select>
                </div>
                {(selectedTemplateId) && (
                    <div className="flex-grow min-w-[200px]">
                        <label htmlFor="template-name-input" className="sr-only">Nome do Template</label>
                        <input
                            type="text"
                            id="template-name-input"
                            placeholder="Nome do Template"
                            value={currentTemplateName}
                            onChange={(e) => setCurrentTemplateName(e.target.value)}
                            disabled={isLoading || isSaving}
                            className="w-full p-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm h-10"
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleSaveTemplate}
                        disabled={isLoading || isSaving || !canSave}
                        className={`py-2 px-3 rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition ${
                            canSave ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        }`}
                        title={canSave ? (selectedTemplateId === 'new' ? "Criar e Salvar Template" : "Salvar Alterações") : "Nenhuma alteração para salvar ou nome inválido"}
                    >
                        <Save size={16} /> Salvar
                    </button>
                    <button
                        onClick={handleDeleteTemplate}
                        disabled={isLoading || isSaving || !selectedTemplateId || selectedTemplateId === 'new'}
                        className="py-2 px-3 bg-red-700 hover:bg-red-600 text-white rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir template selecionado"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Mensagem de Feedback */}
            {message.text && (
                 <div className={`p-3 text-sm rounded-lg ${getMessageClass(message.type)} mb-4 flex justify-between items-center animate-in fade-in duration-300`}>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage({text: '', type: ''})} className="font-bold text-lg px-2 leading-none">&times;</button>
                </div>
            )}

            {/* Área Principal (Template) */}
            {selectedTemplateId ? (
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-xl shadow-lg">
                    <h3 className="text-lg font-semibold text-white mb-4">Alvo de Tropas (Total na Aldeia)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                        {/* Mapeia os grupos de edifícios (Quartel, Estábulo, etc) */}
                        {Object.values(TROOPS_CONFIG).map((group) => (
                            <div key={group.name} className="space-y-3">
                                <h4 className="text-md font-bold text-yellow-400 border-b border-slate-700 pb-2 flex items-center gap-2">
                                    {group.icon()}
                                    {group.name}
                                </h4>
                                
                                {/* Mapeia as unidades dentro do grupo */}
                                {group.units.map(unit => (
                                    <div key={unit.id} className="grid grid-cols-3 items-center gap-2">
                                        <label
                                            htmlFor={`unit-${unit.id}`}
                                            className="col-span-1 flex items-center text-sm text-slate-200"
                                            title={unit.name}
                                        >
                                            <span className="mr-2">{unit.icon}</span>
                                            {unit.name}
                                        </label>
                                        <div className="col-span-2">
                                            <input
                                                type="number"
                                                id={`unit-${unit.id}`}
                                                min="0"
                                                placeholder="0"
                                                value={currentTarget[unit.id] || ''}
                                                onChange={(e) => handleTargetChange(unit.id, e.target.value)}
                                                disabled={isLoading || isSaving}
                                                className="w-full p-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                // Placeholder
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-dashed border-slate-700/50 p-12 shadow-lg text-center min-h-[400px] flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="text-5xl mb-4 opacity-30">🛡️</div>
                    <p className="text-slate-400">Selecione um template no menu acima ou crie um novo para começar</p>
                </div>
            )}
        </div>
    );
}

export default RecruitmentPlanner;