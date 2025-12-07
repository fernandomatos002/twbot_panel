// src/components/TwAccountsManager.jsx (REFATORADO - v16 - Modais Extraídos)
import React, { useState, useRef, useEffect, useCallback } from 'react';
// Ícones importados
import {
    PlusIcon, TrashIcon, PlayIcon, StopIcon, XCircleIcon,
    ClockIcon, KeyIcon, ArrowPathIcon, Cog6ToothIcon, CogIcon,
    CubeIcon, Square3Stack3DIcon, UserGroupIcon, ArchiveBoxIcon,
    GlobeAltIcon, UserIcon, MapIcon, SignalIcon, BoltIcon,
    EyeIcon,
    ChatBubbleLeftEllipsisIcon,
    CpuChipIcon,
    ShieldCheckIcon // Mantido para o header da tabela
} from '@heroicons/react/24/outline';

// --- INÍCIO DA MODIFICAÇÃO (v17) - Corrigindo os caminhos de importação ---
import { ScavengeStatusCell, ScavengeStatusModal } from './components/features/ScavengeStatus.jsx';
import AddAccountModal from './components/modals/AddAccountModal.jsx';
import EditAccountModal from './components/modals/EditAccountModal.jsx';
import ConfirmationModal from './components/modals/ConfirmationModal.jsx';
// --- FIM DA MODIFICAÇÃO (v17) ---


// --- Constantes de Status ---
const BOT_STATUS = {
    ON: 'EM_EXECUÇÃO', OFF: 'PARADO', STARTING: 'INICIANDO...', STOPPING: 'PARANDO...',
    CHECKING: 'VERIFICANDO...', AUTHENTICATING: 'AUTENTICANDO', SESSION_MISSING: 'SESSÃO_AUSENTE',
    WORKER_MISSING: 'WORKER_AUSENTE', FAILURE: 'FALHA!',
    VIEWING: 'VISUALIZANDO', 
    CAPTCHA_DETECTADO: 'CAPTCHA_DETECTADO'
};


// --- Função auxiliar para classes de mensagem (Mantida para mensagens do Manager) ---
const getMessageClass = (type) => {
    if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
    if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
    return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
}

// Função auxiliar para formatar números grandes
function formatNumber(num) {
    if (num === undefined || num === null) return '...';
    const numF = Math.floor(num);
    if (numF < 10000) return numF.toString();
    if (numF < 1000000) return (numF / 1000).toFixed(1) + 'k';
    return (numF / 1000000).toFixed(1) + 'm';
}

// Função auxiliar para formatar o horário
const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
        return new Date(isoString).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.error("Erro ao formatar data:", e);
        return '';
    }
};

// --- INÍCIO DA MODIFICAÇÃO (v16) ---
// Os modais (Add, Edit, Confirm) foram MOVIDOS para 'src/components/modals/'
// A Lógica de Coleta (useCountdown, Modais, Célula) foi MOVIDA para 'src/components/features/ScavengeStatus.jsx'
// --- FIM DA MODIFICAÇÃO (v16) ---


// --- Componente Principal da Seção ---
function TwAccountsManager({
    accounts,
    onAddAccount,
    onDeleteAccount,
    proxies,
    token,
    onSetAccountStatus,
    onAuthenticationStart,
    onAuthenticationEnd,
    onUpdateAccount,
    onOpenVillageViewer, 
    onRefreshData 
}) {
    const [message, setMessage] = useState({ text: '', type: '' });
    const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState(null);
    const [expandedLogRowId, setExpandedLogRowId] = useState(null); 
    const [isScavengeModalOpen, setIsScavengeModalOpen] = useState(false);
    const [scavengeModalData, setScavengeModalData] = useState(null);
    
    const handleOpenScavengeModal = (scavengeStatus) => {
        if (scavengeStatus) {
            setScavengeModalData(scavengeStatus);
            setIsScavengeModalOpen(true);
        }
    };

    const { startAutomation, stopAutomation, authenticateAccount, startVillageViewer } = window.api || {};
    const { SESSION_MISSING, WORKER_MISSING, FAILURE, STARTING, STOPPING, ON, VIEWING, AUTHENTICATING, CAPTCHA_DETECTADO } = BOT_STATUS;


    // --- Handlers de Ação ---
    const confirmDeleteAccount = (accountId, tw_username) => {
        if (!accountId) {
            setMessage({ text: 'Erro: ID da conta inválido.', type: 'error' });
            return;
        }
        setAccountToDelete({ id: accountId, username: tw_username });
        setIsDeleteAccountModalOpen(true);
        setMessage({ text: '', type: '' });
    };

    const executeDeleteAccount = async () => {
        if (!accountToDelete?.id) {
            setMessage({ text: 'Erro interno: Dados de exclusão não encontrados.', type: 'error' });
            setIsDeleteAccountModalOpen(false);
            setAccountToDelete(null);
            return;
        }
        const { id: accountId, username: tw_username } = accountToDelete;
        setIsDeleteAccountModalOpen(false);
        setMessage({ text: `Excluindo conta ${tw_username}...`, type: 'info' });
        try {
            await onDeleteAccount(accountId);
            setMessage({ text: `Conta ${tw_username} removida com sucesso.`, type: 'success' });
        } catch (error) {
            setMessage({ text: `Erro ao iniciar exclusão: ${error.message}`, type: 'error' });
        } finally {
            setAccountToDelete(null);
        }
    };

    // --- Handlers de Automação ---
    const handleStartAutomation = useCallback(async (account) => {
        if (!startAutomation || !account || !account.id) {
            console.error("[TwManager] StartAutomation: Dados inválidos.");
            return;
        }
        console.log(`[TwManager] Iniciando automação para ${account.id}`);
        onSetAccountStatus(account.id, STARTING);
        try {
            const result = await startAutomation({ account: account });
            if (!result || !result.success) {
                const errorMsg = result?.message || "Falha ao iniciar o worker.";
                const errorStatus = result?.code === 'SESSION_MISSING' ? SESSION_MISSING : result?.code === 'WORKER_MISSING' ? WORKER_MISSING : FAILURE;
                console.error(`[TwManager] Falha ao iniciar automação: ${errorMsg} (Code: ${result?.code})`);
                onSetAccountStatus(account.id, errorStatus, errorMsg);
            }
        } catch (error) {
            console.error(`[TwManager] Erro crítico ao chamar startAutomation: ${error.message}`);
            onSetAccountStatus(account.id, FAILURE, `Erro comunicação: ${error.message}`);
        }
    }, [onSetAccountStatus, startAutomation, SESSION_MISSING, WORKER_MISSING, FAILURE, STARTING]);

    const handleStopAutomation = useCallback(async (accountId) => {
        if (!stopAutomation) return;
        console.log(`[TwManager] Parando automação para ${accountId}`);
        onSetAccountStatus(accountId, STOPPING);
        try {
            const result = await stopAutomation(accountId);
            if (!result || !result.success) {
                const errorMsg = result?.message || "Falha ao parar o worker.";
                console.error(`[TwManager] Falha ao parar automação: ${errorMsg}`);
                onSetAccountStatus(accountId, FAILURE, errorMsg);
            }
        } catch (error) {
            console.error(`[TwManager] Erro crítico ao chamar stopAutomation: ${error.message}`);
            onSetAccountStatus(accountId, FAILURE, `Erro comunicação: ${error.message}`);
        }
    }, [onSetAccountStatus, stopAutomation, STOPPING, FAILURE]);

    const handleAuthentication = useCallback(async (account) => {
        if (!token || !authenticateAccount || !account || !account.id) return;
        console.log(`[TwManager] Iniciando autenticação para ${account.id}`);
        const originalStatus = account.botStatus;
        onAuthenticationStart(account.id);
        try {
            const result = await authenticateAccount({ token: token, accountId: account.id, region: account.region, proxyId: account.proxy_id });
            if (result && result.success) {
                console.log('[TwManager] Autenticação IPC sucesso.');
                onSetAccountStatus(account.id, BOT_STATUS.OFF, "Autenticação manual concluída.");
                console.log('[TwManager] Autenticação bem-sucedida, atualizando dados...');
                onRefreshData(token); 
            } else if (result && !result.success) {
                const errorMsg = result.message || "Falha desconhecida na autenticação.";
                console.warn(`[TwManager] Falha/Cancelamento autenticação IPC: ${errorMsg}`);
                onSetAccountStatus(account.id, originalStatus, errorMsg);
            } else {
                console.error('[TwManager] Resposta inesperada de authenticateAccount:', result);
                onSetAccountStatus(account.id, originalStatus, "Resposta inesperada do processo de autenticação.");
            }
        } catch (error) {
            console.error(`[TwManager] Erro crítico ao chamar authenticateAccount: ${error.message}`);
            if (error.message.includes('net::ERR_ABORTED') || error.message.includes('closed')) {
                onSetAccountStatus(account.id, originalStatus, "Autenticação cancelada pelo usuário.");
            } else {
                onSetAccountStatus(account.id, FAILURE, `Erro comunicação: ${error.message}`);
            }
        } finally {
            onAuthenticationEnd(account.id);
        }
    }, [token, onAuthenticationStart, onAuthenticationEnd, onSetAccountStatus, authenticateAccount, onRefreshData, FAILURE]);

    
    const handleOpenVillageViewer = useCallback(async (account) => {
        if (!startVillageViewer) {
            console.error("[TwManager] StartVillageViewer: API IPC 'startVillageViewer' não está disponível.");
            return;
        }
        if (!account || !account.id) {
            console.error("[TwManager] StartVillageViewer: Dados da conta inválidos (account ou account.id estão faltando).");
            return;
        }
        const hasSessionPotential = account.sessionDataId || account.botStatus === SESSION_MISSING || account.botStatus === FAILURE || account.botStatus === CAPTCHA_DETECTADO || account.botStatus === ON;
        if (!hasSessionPotential) {
            setMessage({ text: 'Não há dados de sessão para iniciar o visualizador. Tente autenticar primeiro.', type: 'error' });
            return;
        }
        const isBusy = account.busyAuthentication || account.botStatus === STARTING || account.botStatus === STOPPING || account.botStatus === VIEWING;
        if (isBusy) return;
        console.log(`[TwManager] Solicitando visualizador para ${account.id} (interromper e visualizar)...`);
        onSetAccountStatus(account.id, VIEWING, "Parando automação e abrindo visualizador...");
        try {
            const result = await startVillageViewer({ account: account });
            if (!result || !result.success) {
                const errorMsg = result?.message || "Falha ao iniciar o visualizador. Tentando restaurar estado anterior.";
                console.error(`[TwManager] Falha ao iniciar visualizador: ${errorMsg}`);
                setMessage({ text: errorMsg, type: 'error' });
            }
        } catch (error) {
            console.error(`[TwManager] Erro crítico ao chamar startVillageViewer: ${error.message}`);
            setMessage({ text: `Erro de comunicação: ${error.message}. O estado pode estar inconsistente.`, type: 'error' });
        }
    }, [onSetAccountStatus, startVillageViewer, SESSION_MISSING, FAILURE, CAPTCHA_DETECTADO, ON, STARTING, STOPPING, VIEWING]);

    const handleOpenEditModal = (account) => {
        if (!account || !account.id) {
            setMessage({ text: 'Erro: Dados da conta inválidos para edição.', type: 'error' });
            return;
        }
        const proxyInfo = account.proxy_id ? proxies.find(p => p.id === account.proxy_id) : null;
        const initialDataForModal = { ...account, proxy_ip: proxyInfo?.ip, proxy_port: proxyInfo?.port, proxy_country: proxyInfo?.country };
        setAccountToEdit(initialDataForModal);
        setIsEditModalOpen(true);
        setMessage({ text: '', type: '' });
    };

    const handleToggleLog = (accountId) => {
        setExpandedLogRowId(prevId => (prevId === accountId ? null : accountId));
    };

    // --- Funções de Renderização (Status) ---

    const renderBotStatus = (status, log, accountId, onToggleLog) => {
        const baseStatus = (() => {
            switch (status) {
                case ON: 
                    return <span className="flex items-center text-green-400 font-bold"><CpuChipIcon className="w-5 h-5 mr-1.5" /> Ativo</span>;
                case BOT_STATUS.OFF: 
                    return <span className="flex items-center text-red-500 font-bold"><CpuChipIcon className="w-5 h-5 mr-1.5" /> Inativo</span>;
                case VIEWING:
                case STARTING:
                case STOPPING:
                case AUTHENTICATING:
                case BOT_STATUS.CHECKING:
                    return <span className="flex items-center text-red-500 font-bold"><CpuChipIcon className="w-5 h-5 mr-1.5" /> Inativo</span>;
                case SESSION_MISSING: 
                    return <span className="flex items-center text-red-500 font-bold"><KeyIcon className="w-5 h-5 mr-1.5" /> Sessão Ausente</span>;
                case WORKER_MISSING: 
                    return <span className="flex items-center text-red-500 font-bold"><XCircleIcon className="w-5 h-5 mr-1.5" /> Worker Ausente</span>;
                case FAILURE: 
                    return <span className="flex items-center text-red-600 font-extrabold"><XCircleIcon className="w-5 h-5 mr-1.5" /> Falha!</span>;
                case CAPTCHA_DETECTADO: 
                    return <span className="flex items-center text-red-600 font-extrabold"><XCircleIcon className="w-5 h-5 mr-1.5" /> Captcha Detectado</span>;
                default: 
                    return <span className="flex items-center text-slate-500"><ClockIcon className="w-5 h-5 mr-1.5" /> (Inativo)</span>;
            }
        })();

        return (
            <div className="flex items-center justify-center space-x-2">
                {baseStatus}
                {log && (
                    <button
                        onClick={() => onToggleLog(accountId)}
                        title="Ver/Ocultar último log"
                        className="p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    >
                        <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    };

    
    const renderExecutionStatus = (status, log, lastUpdateTimestamp) => {
        switch (status) {
            case STARTING:
            case STOPPING:
            case AUTHENTICATING:
            case BOT_STATUS.CHECKING:
            case VIEWING:
                return <span className="flex items-center justify-center text-yellow-400 animate-pulse"><ArrowPathIcon className="w-5 h-5 mr-1.5 animate-spin" /> {status}</span>;
            case ON:
                if (log && (log.includes('Ciclo completo') || log.includes('Próximo ciclo em'))) {
                    const time = formatTime(lastUpdateTimestamp);
                    return (
                        <div className="flex flex-col items-center">
                            <span className="text-green-400 font-bold">Verificado</span>
                            {time && <span className="text-xs text-slate-400">às {time}</span>}
                        </div>
                    );
                }
                return <span className="flex items-center justify-center text-blue-400 animate-pulse">Executando...</span>;
            default:
                return <span className="text-slate-500">---</span>;
        }
    };


    const renderProxyStatus = (status) => {
        const s = status?.toLowerCase() || 'desconhecido';
        if (s === 'ativo' || s === 'funcional' || s === 'active' || s === 'valid') { return <span className="text-green-400 font-bold">Valid</span>; }
        if (s === 'inativo' || s === 'inactive' || s === 'falha' || s === 'invalid') { return <span className="text-red-500">Falha</span>; }
        if (s === 'verificando...') { return <span className="text-yellow-400 animate-pulse">Verificando...</span>; }
        return <span className="text-slate-500">N/A</span>;
    };

    return (
        <div id="tw-accounts-manager-section">
            {/* Header e Botão Add */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-yellow-400">👥 Gerenciamento de Contas TW</h2>
                <button
                    onClick={() => setIsAddAccountModalOpen(true)}
                    className="py-2 px-4 bg-purple-700 hover:bg-purple-600 text-white rounded-lg font-bold text-sm transition-all"
                >
                    <PlusIcon className="w-5 h-5 inline-block mr-1" /> Adicionar Nova Conta
                </button>
            </div>

            {/* Conteúdo Principal */}
            <div className="rounded-2xl bg-slate-800/50 backdrop-blur border border-slate-700/50 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Contas Registradas ({accounts?.length || 0})</h3>
                <div className="overflow-x-auto">
                    {/* (v15) - min-w removido */}
                    <table id="tw-accounts-table" className="w-full text-left">
                        <thead className="border-b border-slate-700">
                            <tr>
                                <th className="py-2 px-1 text-center" title="Proxy">
                                    <div className="flex flex-col items-center gap-1"><GlobeAltIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Proxy</span></div>
                                </th>
                                <th className="py-2 px-1 text-center" title="Conta">
                                    <div className="flex flex-col items-center gap-1"><UserIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Conta</span></div>
                                </th>
                                <th className="py-2 px-1 text-center w-12" title="Madeira">
                                    <div className="flex flex-col items-center gap-1"><CubeIcon className="w-6 h-6 text-orange-400" /><span className="text-xs font-medium text-slate-400">Mad.</span></div>
                                </th>
                                <th className="py-2 px-1 text-center w-12" title="Argila">
                                    <div className="flex flex-col items-center gap-1"><Square3Stack3DIcon className="w-6 h-6 text-red-400" /><span className="text-xs font-medium text-slate-400">Arg.</span></div>
                                </th>
                                <th className="py-2 px-1 text-center w-12" title="Ferro">
                                    <div className="flex flex-col items-center gap-1"><CogIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Fer.</span></div>
                                </th>
                                <th className="py-2 px-1 text-center w-12" title="População">
                                    <div className="flex flex-col items-center gap-1"><UserGroupIcon className="w-6 h-6 text-blue-400" /><span className="text-xs font-medium text-slate-400">Pop.</span></div>
                                </th>
                                <th className="py-2 px-1 text-center w-12" title="Armazém">
                                    <div className="flex flex-col items-center gap-1"><ArchiveBoxIcon className="w-6 h-6 text-yellow-400" /><span className="text-xs font-medium text-slate-400">Arm.</span></div>
                                </th>
                                <th className="py-2 px-1 text-center" title="Status">
                                    <div className="flex flex-col items-center gap-1"><SignalIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Status</span></div>
                                </th>
                                <th className="py-2 px-1 text-center" title="Último Ciclo/Execução">
                                    <div className="flex flex-col items-center gap-1"><ClockIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Últ. Ciclo</span></div>
                                </th>
                                <th className="py-2 px-1 text-center" title="Coleta">
                                    <div className="flex flex-col items-center gap-1"><ShieldCheckIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Coleta</span></div>
                                </th>
                                <th className="py-2 px-1 text-center" title="Ações">
                                    <div className="flex flex-col items-center gap-1"><BoltIcon className="w-6 h-6 text-slate-400" /><span className="text-xs font-medium text-slate-400">Ações</span></div>
                                </th>
                            </tr>
                        </thead>

                        <tbody className="text-slate-200">
                            {accounts && accounts.length > 0 ? (
                                accounts.filter(acc => acc && acc.id).map(account => {
                                    const isBusyAuthenticating = account.busyAuthentication || account.botStatus === AUTHENTICATING;
                                    const isBusyStartingOrStopping = account.botStatus === STARTING || account.botStatus === STOPPING;
                                    const isViewing = account.botStatus === VIEWING;
                                    const isBusy = isBusyAuthenticating || isBusyStartingOrStopping || isViewing;
                                    const isRunning = account.botStatus === ON;
                                    const needsAuth = account.botStatus === SESSION_MISSING;
                                    const isCaptcha = account.botStatus === CAPTCHA_DETECTADO;
                                    const canView = !isBusyStartingOrStopping && !isBusyAuthenticating && (account.sessionDataId || needsAuth || isCaptcha || account.botStatus === FAILURE || isRunning);
                                    const canStart = !isBusy && !needsAuth && !isRunning && (account.botStatus === BOT_STATUS.OFF || account.botStatus === FAILURE || isCaptcha);

                                    return (
                                        <React.Fragment key={account.id}>
                                            <tr className="border-b border-slate-800 hover:bg-slate-800/50 align-middle">
                                                <td className="p-4 whitespace-nowrap text-sm text-center">
                                                    {renderProxyStatus(account.proxyStatus)}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="font-semibold">{account.tw_username}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        <span className="align-middle uppercase">{account.region}{account.tw_world}</span>
                                                        {(account.playerPoints !== null && account.playerPoints !== undefined && account.playerPoints > 0) && (
                                                            <span className="ml-2 pl-2 border-l border-slate-600 align-middle">
                                                                {formatNumber(account.playerPoints)} Pontos
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-xs font-semibold text-center text-orange-400">
                                                    {formatNumber(account.resources?.wood)}
                                                </td>
                                                <td className="p-4 whitespace-nowar text-xs font-semibold text-center text-red-400">
                                                    {formatNumber(account.resources?.clay)}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-xs font-semibold text-center text-slate-300">
                                                    {formatNumber(account.resources?.iron)}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-xs font-semibold text-center text-blue-300">
                                                    {`${formatNumber(account.resources?.population?.current)}/${formatNumber(account.resources?.population?.max)}`}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-xs font-semibold text-center text-yellow-400">
                                                    {formatNumber(account.resources?.storage?.max)}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-sm text-center">
                                                    {renderBotStatus(account.botStatus, account.lastLog, account.id, handleToggleLog)}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-sm text-center">
                                                    {renderExecutionStatus(account.botStatus, account.lastLog, account.lastStatusUpdateTimestamp)}
                                                </td>
                                                <td className="p-4 whitespace-nowrap text-sm text-center">
                                                    <ScavengeStatusCell 
                                                        scavengeStatus={account.scavengeStatus} 
                                                        onClick={() => handleOpenScavengeModal(account.scavengeStatus)}
                                                    />
                                                </td>
                                                <td className="p-4 text-center whitespace-nowrap">
                                                    {isRunning || account.botStatus === STOPPING ? (
                                                        <button
                                                            onClick={() => handleStopAutomation(account.id)}
                                                            title="Parar Automação"
                                                            disabled={account.botStatus === STOPPING || isViewing}
                                                            className={`p-2 ${account.botStatus === STOPPING || isViewing ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white rounded-full transition duration-150 mr-2 disabled:opacity-50`}
                                                        >
                                                            {account.botStatus === STOPPING ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <StopIcon className="w-5 h-5" />}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleStartAutomation(account)}
                                                            title="Iniciar Automação"
                                                            disabled={!canStart}
                                                            className={`p-2 ${!canStart ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-full transition duration-150 mr-2 disabled:opacity-50`}
                                                        >
                                                            {account.botStatus === STARTING ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlayIcon className="w-5 h-5" />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleOpenVillageViewer(account)}
                                                        title={isCaptcha ? "CAPTCHA DETECTADO! Clique para resolver." : "Visualizar Aldeia (Interrompe Automação)"}
                                                        disabled={!canView || isViewing}
                                                        className={`p-2 ${(!canView || isViewing) ? 'bg-gray-500 cursor-not-allowed' : (isCaptcha ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-blue-600 hover:bg-blue-700')} text-white rounded-full transition duration-150 mr-2 disabled:opacity-50`}
                                                    >
                                                        {isViewing ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <EyeIcon className="w-5 h-5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAuthentication(account)}
                                                        title="Autenticar Manualmente (Gerar Sessão)"
                                                        disabled={isBusy || !needsAuth}
                                                        className={`p-2 ${isBusy || !needsAuth ? 'bg-gray-500 cursor-not-allowed' : (needsAuth ? 'bg-orange-600 hover:bg-orange-700 animate-pulse' : 'bg-yellow-600 hover:bg-yellow-700')} text-white rounded-full transition duration-150 mr-2 disabled:opacity-50`}
                                                    >
                                                        {isBusyAuthenticating ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <KeyIcon className="w-5 h-5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenEditModal(account)}
                                                        title="Editar Conta"
                                                        disabled={isBusy}
                                                        className={`p-2 ${isBusy ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full transition duration-150 mr-2 disabled:opacity-50`}
                                                    >
                                                        <Cog6ToothIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => confirmDeleteAccount(account.id, account.tw_username)}
                                                        disabled={isBusy}
                                                        title="Excluir Conta"
                                                        className={`p-2 ${isBusy ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-700 hover:bg-red-600'} text-white rounded-full transition duration-150 disabled:opacity-50`}
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                            {/* Linha Expansível do Log */}
                                            {expandedLogRowId === account.id && (
                                                <tr className="bg-slate-900/50 border-b border-slate-700">
                                                    <td colSpan="11" className="px-4 py-2 text-xs text-slate-400 whitespace-pre-wrap break-words">
                                                        <strong className='text-slate-300'>Último Log:</strong> {account.lastLog || "Nenhum log registrado."}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            ) : (
                                <tr><td colSpan="11" className="p-4 text-center text-slate-400">Nenhuma conta do Tribal Wars adicionada ainda.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Mensagens de feedback */}
            {message.text && (
                <div className={`p-4 text-sm rounded-lg ${getMessageClass(message.type)} mt-6`} style={{ display: 'block' }}>
                    {message.text}
                </div>
            )}
            {/* Modais */}
            <AddAccountModal
                isOpen={isAddAccountModalOpen}
                onClose={() => setIsAddAccountModalOpen(false)}
                onAddAccount={onAddAccount}
                proxies={proxies || []}
                getMessageClass={getMessageClass} 
            />
            {isDeleteAccountModalOpen && accountToDelete && (
                <ConfirmationModal
                    message={`Tem certeza que deseja excluir permanentemente a conta TW:`}
                    targetUsername={accountToDelete.username}
                    onConfirm={executeDeleteAccount}
                    onCancel={() => { setIsDeleteAccountModalOpen(false); setAccountToDelete(null); }}
                />
            )}
            <EditAccountModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onUpdateAccount={onUpdateAccount}
                proxies={proxies || []}
                initialData={accountToEdit}
                getMessageClass={getMessageClass}
            />
            <ScavengeStatusModal
                isOpen={isScavengeModalOpen}
                onClose={() => setIsScavengeModalOpen(false)}
                scavengeStatus={scavengeModalData}
            />
        </div>
    );
}

export default TwAccountsManager;