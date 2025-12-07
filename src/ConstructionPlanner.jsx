// src/ConstructionPlanner.jsx (Layout Refatorado com Grid e Drag-and-Drop)
import React, { useState, useEffect, useCallback } from 'react';

// --- Ícones Lucide ---
import {
    Plus, Save, Trash2, Download, Upload, X, Hammer, Building2,
    GripVertical // Ícone para Drag-and-Drop
} from 'lucide-react';

// --- Configuração ---
import { BUILDINGS, BUILDINGS_MAP, BUILDING_NAMES } from './config/buildings.jsx';

// --- dnd-kit (Drag and Drop) ---
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Funções da API (expostas via window.api) ---
const {
    fetchConstructionLists,
    createConstructionList,
    updateConstructionList,
    deleteConstructionList
} = window.api || {};

// --- Funções Auxiliares ---

// Função auxiliar para classes de mensagem (Inalterada)
const getMessageClass = (type) => {
    if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
    if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
    return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
};

// checkPrerequisites (Usada para *adicionar* novos, inalterada)
const checkPrerequisites = (buildingId, currentSteps) => {
    const buildingInfo = BUILDINGS_MAP[buildingId];
    if (!buildingInfo) return { canAdd: false, reason: "Edifício desconhecido.", currentLevel: 0 };

    const maxLevelCurrent = currentSteps
        .filter(step => step.buildingId === buildingId)
        .reduce((max, step) => Math.max(max, step.level), 0);

    const nextLevel = maxLevelCurrent + 1;

    if (nextLevel > buildingInfo.maxLevel) {
        return {
            canAdd: false,
            reason: `Nível máximo (${buildingInfo.maxLevel}) já atingido na lista.`,
            currentLevel: maxLevelCurrent
        };
    }

    let missingPrerequisite = null;
    if (buildingInfo.prerequisites && buildingInfo.prerequisites.length > 0) {
        for (const prereq of buildingInfo.prerequisites) {
            const met = currentSteps.some(step => step.buildingId === prereq.building && step.level >= prereq.level);
            if (!met) {
                missingPrerequisite = `${BUILDING_NAMES[prereq.building] || prereq.building} Nv. ${prereq.level}`;
                break;
            }
        }
    }

    if (missingPrerequisite) {
        return {
            canAdd: false,
            reason: `Requer ${missingPrerequisite}.`,
            currentLevel: maxLevelCurrent
        };
    }

    return {
        canAdd: true,
        reason: `Adicionar ${buildingInfo.name} Nv. ${nextLevel}`,
        nextLevel: nextLevel,
        currentLevel: maxLevelCurrent
    };
};

/**
 * NOVO: Recalcula os níveis sequencialmente.
 * Garante que (Edifício Nv. 4, Edifício Nv. 1) vira (Edifício Nv. 1, Edifício Nv. 2)
 */
const recalculateQueueLevels = (steps) => {
    const levelTracker = {};
    return steps.map(step => {
        const currentLevel = levelTracker[step.buildingId] || 0;
        const newLevel = currentLevel + 1;
        levelTracker[step.buildingId] = newLevel;
        // Retorna o passo com o nível recalculado
        return { ...step, level: newLevel };
    });
};

/**
 * NOVO: Valida se a fila inteira obedece aos pré-requisitos.
 */
const isQueueValid = (steps) => {
    // Itera por cada passo na fila recalculada
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const buildingInfo = BUILDINGS_MAP[step.buildingId];

        // Verifica os pré-requisitos deste edifício
        if (buildingInfo.prerequisites && buildingInfo.prerequisites.length > 0) {
            // Só pode verificar contra os passos que vêm ANTES dele
            const stepsSoFar = steps.slice(0, i); 
            
            for (const prereq of buildingInfo.prerequisites) {
                // O pré-requisito (ex: Ed. Principal Nv. 1) foi cumprido?
                const met = stepsSoFar.some(s =>
                    s.buildingId === prereq.building && s.level >= prereq.level
                );
                
                if (!met) {
                    // Se não foi cumprido, a fila é inválida
                    return false;
                }
            }
        }
    }
    // Se passou por todos os passos e todos são válidos
    return true;
};


// --- Componente Principal ---

function ConstructionPlanner({ token }) {
    const [lists, setLists] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const [currentListName, setCurrentListName] = useState('');
    const [currentSteps, setCurrentSteps] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    // --- Carregamento Inicial ---
    const loadLists = useCallback(async () => {
        // ... (lógica inalterada) ...
        if (!fetchConstructionLists) {
            setMessage({ text: 'Erro: API para buscar listas não disponível.', type: 'error' });
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const result = await fetchConstructionLists(token);
            if (result?.success) {
                setLists(result.lists || []);
            } else {
                throw new Error(result?.message || 'Falha ao buscar listas do servidor.');
            }
        } catch (error) {
            setMessage({ text: `Erro ao carregar listas: ${error.message}`, type: 'error' });
            setLists([]);
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        if (token) {
            loadLists();
        } else {
            setMessage({ text: 'Erro: Usuário não autenticado.', type: 'error' });
            setIsLoading(false);
        }
    }, [loadLists, token]);

    // --- Manipuladores ---

    // handleListSelectionChange (Inalterado)
    const handleListSelectionChange = (event) => {
        const listId = event.target.value;
        setSelectedListId(listId);

        if (listId === 'new') {
            setCurrentListName('');
            setCurrentSteps([]);
        } else if (listId) {
            const selected = lists.find(l => l.id === listId);
            if (selected) {
                setCurrentListName(selected.name);
                const stepsWithIds = (selected.steps || []).map((step) => ({
                    ...step,
                    id: crypto.randomUUID()
                }));
                setCurrentSteps(stepsWithIds);
            }
        } else {
            setCurrentListName('');
            setCurrentSteps([]);
        }
        setMessage({ text: '', type: '' });
    };

    /**
     * MODIFICADO: hasChanges agora usa as funções de recálculo
     * para comparar corretamente.
     */
    const hasChanges = () => {
        if (selectedListId === 'new') return true;
        const originalList = lists.find(l => l.id === selectedListId);
        if (!originalList) return false;
        if (originalList.name !== currentListName.trim()) return true;

        const originalSteps = originalList.steps || [];
        if (originalSteps.length !== currentSteps.length) return true;

        // Cria uma versão "limpa" dos steps atuais para comparação
        // (Sem ID e com níveis recalculados, embora não devesse ser
        // necessário se o estado for sempre válido)
        const simpleCurrentSteps = currentSteps.map(({ buildingId, level }) => ({ buildingId, level }));
        
        // Compara JSON. A ordem importa.
        return JSON.stringify(originalSteps) !== JSON.stringify(simpleCurrentSteps);
    };
    const canSave = hasChanges() && currentListName.trim() !== '';

    /**
     * MODIFICADO: handleAddStep agora também valida a fila
     * (embora checkPrerequisites já deva fazer isso)
     * e recalcula os níveis.
     */
    const handleAddStep = (buildingId) => {
        if (!selectedListId) {
            setSelectedListId('new');
        }
        
        // Verifica se PODE adicionar
        const check = checkPrerequisites(buildingId, currentSteps);
        
        if (check.canAdd) {
            const newStep = {
                id: crypto.randomUUID(),
                buildingId,
                level: check.nextLevel // Nível é temporário, será recalculado
            };

            // Adiciona e recalcula
            // (Isto é mais para robustez, o nível de check.nextLevel deve estar correto)
            const newSteps = [...currentSteps, newStep];
            const recalculatedSteps = recalculateQueueLevels(newSteps);

            // Valida (isto é uma dupla verificação, mas garante integridade)
            if (isQueueValid(recalculatedSteps)) {
                 setCurrentSteps(recalculatedSteps);
                 setMessage({ text: '', type: '' });
            } else {
                // Isto não devia acontecer se checkPrerequisites estiver correto
                 setMessage({ text: 'Erro: Não foi possível adicionar. Falha na validação.', type: 'error' });
            }

        } else {
            setMessage({ text: check.reason, type: 'error' });
        }
    };

    // handleRemoveStep (Inalterado)
    const handleRemoveStep = (idToRemove) => {
        // Após remover, recalcula os níveis dos restantes
        const newSteps = currentSteps.filter((step) => step.id !== idToRemove);
        const recalculatedSteps = recalculateQueueLevels(newSteps);
        setCurrentSteps(recalculatedSteps);
    };

    // handleSaveList (Inalterado, pois os 'id's já são removidos)
    const handleSaveList = async () => {
        if (!currentListName.trim()) {
            setMessage({ text: 'Por favor, dê um nome à lista.', type: 'error' });
            return;
        }
        if (!hasChanges()) {
            setMessage({ text: 'Nenhuma alteração para salvar.', type: 'info' });
            return;
        }

        setIsSaving(true);
        setMessage({ text: 'Salvando lista...', type: 'info' });

        const stepsToSave = currentSteps.map(({ buildingId, level }) => ({ buildingId, level }));

        const listData = {
            name: currentListName.trim(),
            steps: stepsToSave,
        };

        try {
            let result;
            let savedList;

            if (selectedListId === 'new') {
                if (!createConstructionList) throw new Error("API indisponível.");
                result = await createConstructionList(token, listData);
                if (result?.success && result.list) {
                    savedList = result.list;
                    setMessage({ text: 'Lista criada!', type: 'success' });
                    setLists(prev => [...prev, savedList].sort((a, b) => a.name.localeCompare(b.name)));
                    setSelectedListId(savedList.id);
                } else {
                    throw new Error(result?.message || 'Falha ao criar.');
                }
            } else {
                if (!updateConstructionList) throw new Error("API indisponível.");
                result = await updateConstructionList(token, selectedListId, listData);
                if (result?.success && result.list) {
                    savedList = result.list;
                    setMessage({ text: 'Lista atualizada!', type: 'success' });
                    setLists(prev => prev.map(l => l.id === selectedListId ? savedList : l).sort((a, b) => a.name.localeCompare(b.name)));
                } else {
                    throw new Error(result?.message || 'Falha ao atualizar.');
                }
            }

            const savedStepsWithIds = (savedList.steps || []).map((step) => ({
                ...step,
                id: crypto.randomUUID()
            }));

            setCurrentListName(savedList.name);
            setCurrentSteps(savedStepsWithIds);

        } catch (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // handleDeleteList (Inalterado)
    const handleDeleteList = async () => {
        if (!selectedListId || selectedListId === 'new') {
            setMessage({ text: 'Nenhuma lista salva selecionada.', type: 'error' });
            return;
        }
        if (!deleteConstructionList) {
            setMessage({ text: 'API indisponível.', type: 'error' });
            return;
        }

        if (!window.confirm(`Excluir a lista "${currentListName}"?`)) return;

        setIsLoading(true);
        setMessage({ text: `Excluindo "${currentListName}"...`, type: 'info' });

        try {
            const result = await deleteConstructionList(token, selectedListId);
            if (result?.success) {
                setMessage({ text: 'Lista excluída!', type: 'success' });
                setLists(prev => prev.filter(l => l.id !== selectedListId));
                setSelectedListId('');
                setCurrentListName('');
                setCurrentSteps([]);
            } else {
                throw new Error(result?.message || 'Falha ao excluir.');
            }
        } catch (error) {
            setMessage({ text: `Erro: ${error.message}`, type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    // handleExportList / handleImportList (Inalterados)
    const handleExportList = () => { /* ... */ alert("Exportar não implementado."); };
    const handleImportList = () => { /* ... */ alert("Importar não implementado."); };

    // getBuildingIcon (Inalterado)
    const getBuildingIcon = (buildingId) => {
        const building = BUILDINGS_MAP[buildingId];
        return building?.icon ? building.icon : Building2;
    };

    // --- Configuração do Drag-and-Drop (dnd-kit) ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    /**
     * --- MODIFICAÇÃO CHAVE ---
     * handleDragEnd agora recalcula e valida a fila.
     */
    const handleDragEnd = (event) => {
        const { active, over } = event;

        // Se não largou sobre um item válido ou largou sobre si mesmo
        if (!over || active.id === over.id) {
            return;
        }

        // 1. Obtém a nova ordem visual
        const oldIndex = currentSteps.findIndex(step => step.id === active.id);
        const newIndex = currentSteps.findIndex(step => step.id === over.id);
        const newOrderedSteps = arrayMove(currentSteps, oldIndex, newIndex);

        // 2. Recalcula os níveis sequencialmente
        const recalculatedSteps = recalculateQueueLevels(newOrderedSteps);

        // 3. Valida se a nova ordem obedece aos pré-requisitos
        const isValid = isQueueValid(recalculatedSteps);

        if (isValid) {
            // 4. Se for válido, atualiza o estado
            setCurrentSteps(recalculatedSteps);
            setMessage({ text: '', type: '' }); // Limpa erros
        } else {
            // 5. Se for inválido, reverte (não atualizando o estado)
            //    e mostra uma mensagem de erro.
            setMessage({
                text: 'Não é possível mover. A nova ordem quebra um pré-requisito.',
                type: 'error'
            });
            // Como setCurrentSteps não foi chamado, a UI reverte ao estado anterior.
        }
    };

    /**
     * Componente Interno para o item da Fila
     * (Inalterado desde a correção anterior, continua a calcular o index)
     */
    function SortableStepItem({ step }) {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging
        } = useSortable({ id: step.id });

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            zIndex: isDragging ? 10 : 'auto',
        };

        const IconComp = getBuildingIcon(step.buildingId);

        // Calcula o índice atual (para a numeração 1, 2, 3...)
        const currentIndex = currentSteps.findIndex(s => s.id === step.id);

        return (
            <div
                ref={setNodeRef}
                style={style}
                className={`group flex items-center gap-3 p-2.5 rounded-lg border border-slate-700/50 bg-slate-700/30 transition duration-150 ease-in-out ${
                    isDragging ? 'shadow-lg shadow-yellow-500/20' : 'hover:bg-slate-700/50'
                }`}
            >
                {/* ÁREA DE ARRASTE (DRAG HANDLE) */}
                <button
                    {...attributes}
                    {...listeners}
                    className="flex-shrink-0 p-1 text-slate-500 hover:text-slate-200 cursor-grab active:cursor-grabbing"
                    title="Mover"
                >
                    <GripVertical size={16} />
                </button>

                {/* ÍNDICE (Corrigido) */}
                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-slate-600 flex items-center justify-center text-xs font-bold text-slate-300">
                    {currentIndex + 1}
                </div>
                
                {/* ÍCONE EDIFÍCIO */}
                <IconComp className="flex-shrink-0 text-amber-400" size={18} />
                
                {/* NOME E NÍVEL (Agora sempre correto devido ao recálculo) */}
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate">
                        {BUILDING_NAMES[step.buildingId] || step.buildingId} › <span className="font-bold text-amber-300">{step.level}</span>
                    </p>
                </div>
                
                {/* BOTÃO REMOVER */}
                <button
                    onClick={() => handleRemoveStep(step.id)}
                    disabled={isLoading || isSaving}
                    className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Remover"
                >
                    <X size={14} />
                </button>
            </div>
        );
    }


    // --- Renderização ---

    return (
        <div className="p-1">
            <h2 className="text-2xl font-bold text-yellow-400 mb-5 flex items-center gap-2">
                <Hammer size={24} className="text-amber-400" /> Planejador de Construção
            </h2>

            {/* Barra de Gerenciamento (Inalterada) */}
            <div className="bg-slate-800/60 backdrop-blur-md rounded-xl border border-slate-700/50 p-4 mb-6 shadow-lg flex flex-wrap items-center gap-4 sticky top-20 z-10">
                <div className="flex-shrink-0">
                    <label htmlFor="list-select" className="sr-only">Selecionar ou Criar Lista</label>
                    <select
                        id="list-select"
                        value={selectedListId}
                        onChange={handleListSelectionChange}
                        disabled={isLoading || isSaving}
                        className="p-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm h-10"
                    >
                        <option value="">-- Carregar Lista --</option>
                        <option value="new">✨ Criar Nova...</option>
                        {isLoading && <option disabled>Carregando...</option>}
                        {!isLoading && lists.map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                    </select>
                </div>
                {(selectedListId) && (
                    <div className="flex-grow min-w-[200px]">
                        <label htmlFor="list-name-input" className="sr-only">Nome da Lista</label>
                        <input
                            type="text"
                            id="list-name-input"
                            placeholder="Nome da Lista"
                            value={currentListName}
                            onChange={(e) => setCurrentListName(e.target.value)}
                            disabled={isLoading || isSaving}
                            className="w-full p-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-sm h-10"
                        />
                    </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleSaveList}
                        disabled={isLoading || isSaving || !canSave}
                        className={`py-2 px-3 rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition ${
                            canSave ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        }`}
                        title={canSave ? (selectedListId === 'new' ? "Criar e Salvar Lista" : "Salvar Alterações") : "Nenhuma alteração para salvar ou nome inválido"}
                    >
                        <Save size={16} /> Salvar
                    </button>
                    <button
                        onClick={handleDeleteList}
                        disabled={isLoading || isSaving || !selectedListId || selectedListId === 'new'}
                        className="py-2 px-3 bg-red-700 hover:bg-red-600 text-white rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Excluir lista selecionada"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={handleExportList}
                        disabled={isLoading || isSaving || !selectedListId || selectedListId === 'new'}
                        className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Exportar lista"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={handleImportList}
                        disabled={isLoading || isSaving}
                        className="py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-md font-semibold text-sm flex items-center gap-1.5 h-10 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Importar lista"
                    >
                        <Upload size={16} />
                    </button>
                </div>
            </div>

            {/* Mensagem de Feedback (Inalterada) */}
            {message.text && (
                 <div className={`p-3 text-sm rounded-lg ${getMessageClass(message.type)} mb-4 flex justify-between items-center animate-in fade-in duration-300`}>
                    <span>{message.text}</span>
                    <button onClick={() => setMessage({text: '', type: ''})} className="font-bold text-lg px-2 leading-none">&times;</button>
                </div>
            )}

            {/* Área Principal (Edifícios e Fila) */}
            {selectedListId ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Coluna Esquerda - Grid de Edifícios (Inalterada) */}
                    <div className="md:col-span-1 bg-slate-800/50 backdrop-blur border border-slate-700/50 p-4 rounded-xl shadow-lg">
                        <h3 className="text-lg font-semibold text-white mb-3">Adicionar à Fila</h3>
                        <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {BUILDINGS.map(building => {
                                const check = checkPrerequisites(building.id, currentSteps);
                                const canAdd = check.canAdd;
                                const IconComp = building.icon || Building2;

                                return (
                                    <button
                                        key={building.id}
                                        onClick={() => handleAddStep(building.id)}
                                        disabled={isLoading || isSaving || !canAdd}
                                        className={`group relative rounded-lg p-3 transition duration-150 ease-in-out flex flex-col items-center justify-center text-center aspect-square ${
                                            canAdd
                                            ? 'bg-slate-700/40 hover:bg-slate-700/70 border border-transparent hover:border-amber-400/50 hover:shadow-md hover:shadow-amber-500/10'
                                            : 'bg-slate-700/20 border border-transparent cursor-not-allowed opacity-60'
                                        }`}
                                        title={check.reason}
                                    >
                                        <IconComp className={`mb-1.5 ${canAdd ? 'text-amber-400 group-hover:scale-105' : 'text-slate-500'} transition`} size={24} />
                                        <span className={`text-xs font-medium leading-tight ${canAdd ? 'text-slate-100 group-hover:text-amber-300' : 'text-slate-500'} transition`}>
                                            {building.name}
                                        </span>
                                        <span className={`text-xs mt-0.5 ${canAdd ? 'text-slate-400' : 'text-slate-600'}`}>
                                            Nv. {check.currentLevel}
                                        </span>
                                        {canAdd && (
                                            <div className="absolute top-1 right-1 p-0.5 bg-slate-800/50 rounded-full text-slate-400 group-hover:text-amber-400 group-hover:bg-slate-700 transition">
                                                <Plus size={12} />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Coluna Direita - Fila Atual com DnD (Inalterada) */}
                    <div className="md:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700/50 p-4 rounded-xl shadow-lg">
                        <h3 className="text-lg font-semibold text-white mb-3">Fila Atual ({currentSteps.length} passos)</h3>
                        {currentSteps.length === 0 ? (
                            <div className="bg-slate-900/40 rounded-lg p-6 border border-dashed border-slate-600/50 text-center min-h-[150px] flex flex-col justify-center items-center">
                                <div className="text-3xl mb-2 opacity-50">🧱</div>
                                <p className="text-slate-400 text-sm">
                                    Nenhum edifício adicionado.<br /> Clique em um edifício na lista à esquerda.
                                </p>
                            </div>
                        ) : (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={currentSteps.map(step => step.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {currentSteps.map((step) => (
                                            <SortableStepItem
                                                key={step.id}
                                                step={step}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>

                </div>
            ) : (
                // Placeholder (Inalterado)
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-dashed border-slate-700/50 p-12 shadow-lg text-center min-h-[400px] flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="text-5xl mb-4 opacity-30">🏗️</div>
                    <p className="text-slate-400">Selecione uma lista no menu acima ou crie uma nova para começar</p>
                </div>
            )}
        </div>
    );
}

export default ConstructionPlanner;