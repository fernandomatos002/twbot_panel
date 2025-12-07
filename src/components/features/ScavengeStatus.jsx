// src/components/features/ScavengeStatus.jsx
// (v15) - Lógica de UI da Coleta extraída do TwAccountsManager
// (v14) - Lógica do cronômetro atualizada para "tempo mais longo"
import React, { useState, useEffect } from 'react';
import {
    ArrowUturnLeftIcon, // Para Coletando (Retornando)
    LockOpenIcon, // Para Desbloqueando
    LockClosedIcon, // Para Bloqueado
    NoSymbolIcon // Para Inativo
} from '@heroicons/react/24/outline';

// --- Helpers do Cronômetro (Movidos para cá) ---

/**
 * Formata milissegundos em uma string HH:MM:SS
 */
const formatTimeHHMMSS = (ms) => {
    if (ms <= 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return [hours, minutes, seconds]
        .map(v => v.toString().padStart(2, '0'))
        .join(':');
};

/**
 * Hook customizado para o Cronômetro.
 * @param {number} targetTimestampInSeconds - O timestamp (em SEGUNDOS) do evento futuro.
 */
const useCountdown = (targetTimestampInSeconds) => {
    const [timeLeft, setTimeLeft] = useState(null);

    useEffect(() => {
        if (!targetTimestampInSeconds) {
            setTimeLeft('00:00:00');
            return;
        }

        const targetMs = targetTimestampInSeconds * 1000;
        let intervalId = null;

        const updateTimer = () => {
            const diff = targetMs - Date.now();
            if (diff <= 0) {
                setTimeLeft('00:00:00');
                if (intervalId) clearInterval(intervalId);
            } else {
                setTimeLeft(formatTimeHHMMSS(diff));
            }
        };

        updateTimer();
        intervalId = setInterval(updateTimer, 1000);
        return () => clearInterval(intervalId);

    }, [targetTimestampInSeconds]); 

    return timeLeft;
};

/**
 * Encontra o último (maior) timestamp positivo de um evento de coleta (Lógica v14)
 */
const getLongestTimestamp = (scavengeStatus) => {
    if (!scavengeStatus || !scavengeStatus.options) return null;
    
    const longestTimestamp = scavengeStatus.options.reduce((maxTimestamp, opt) => {
        // Considera apenas timestamps futuros (vezes 1000 para comparar com Date.now())
        if (opt.timestamp && (opt.timestamp * 1000) > Date.now()) {
            if (maxTimestamp === null || opt.timestamp > maxTimestamp) {
                return opt.timestamp;
            }
        }
        return maxTimestamp;
    }, null); // Inicia com null

    return longestTimestamp;
};


// --- Componentes Internos (Movidos para cá) ---

/**
 * Componente (linha) para o Modal de Coleta
 */
const ScavengeOptionRow = ({ option }) => {
    const optionNames = { "1": "Busca Simples", "2": "Busca Humilde", "3": "Busca Ousada", "4": "Busca Extrema" };
    const countdown = useCountdown(option.timestamp);

    let Icon, statusText, statusColor, timerText;

    switch (option.status) {
        case 'Coletando':
            Icon = ArrowUturnLeftIcon;
            statusText = 'Retornando';
            statusColor = 'text-green-400';
            timerText = countdown;
            break;
        case 'Desbloqueando':
            Icon = LockOpenIcon;
            statusText = 'Desbloqueando';
            statusColor = 'text-yellow-400';
            timerText = countdown;
            break;
        case 'Inativo':
            Icon = NoSymbolIcon;
            statusText = 'Inativo';
            statusColor = 'text-slate-400';
            timerText = '---';
            break;
        case 'Bloqueado':
        default:
            Icon = LockClosedIcon;
            statusText = 'Bloqueado';
            statusColor = 'text-red-500';
            timerText = '---';
            break;
    }

    return (
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
            <div className="flex items-center">
                <Icon className={`w-6 h-6 mr-3 ${statusColor}`} />
                <span className="font-semibold text-white">{optionNames[option.id] || `Opção ${option.id}`}</span>
            </div>
            <div className="text-right">
                <div className={`font-bold ${statusColor}`}>{statusText}</div>
                <div className="text-xs text-slate-300 font-mono">{timerText}</div>
            </div>
        </div>
    );
};

// --- Componentes Exportados ---

/**
 * Modal (Popup) que mostra o status das 4 opções de coleta
 * EXPORTADO
 */
export function ScavengeStatusModal({ isOpen, onClose, scavengeStatus }) {
    if (!isOpen || !scavengeStatus) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-yellow-500/30 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-yellow-400 mb-6">Status da Coleta</h3>
                <div className="space-y-3">
                    {scavengeStatus.options.map(opt => (
                        <ScavengeOptionRow key={opt.id} option={opt} />
                    ))}
                </div>
                <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}


/**
 * Célula da Tabela que mostra o status geral da coleta e o próximo timer
 * EXPORTADO
 */
export const ScavengeStatusCell = ({ scavengeStatus, onClick }) => {
    if (!scavengeStatus) {
        return <span className="text-slate-500">N/A</span>;
    }
    
    const longestTimestamp = getLongestTimestamp(scavengeStatus);
    const countdown = useCountdown(longestTimestamp);
    
    let Icon, statusText, statusColor, timerText;

    switch (scavengeStatus.overallStatus) {
        case 'Coletando':
            Icon = ArrowUturnLeftIcon;
            statusText = 'Coletando';
            statusColor = 'text-green-400';
            timerText = (countdown && countdown !== '00:00:00') ? countdown : '...';
            break;
        case 'Desbloqueando':
            Icon = LockOpenIcon;
            statusText = 'Desbloqueando';
            statusColor = 'text-yellow-400';
            timerText = (countdown && countdown !== '00:00:00') ? countdown : '...';
            break;
        case 'Inativo':
            Icon = NoSymbolIcon;
            statusText = 'Inativo';
            statusColor = 'text-slate-400';
            timerText = '---';
            break;
        case 'Bloqueado':
        default:
            Icon = LockClosedIcon;
            statusText = 'Bloqueado';
            statusColor = 'text-red-500';
            timerText = '---';
            break;
    }

    return (
        <button 
            onClick={onClick} 
            title="Clique para ver detalhes da Coleta"
            className="flex flex-col items-center justify-center w-full px-1 py-1 rounded-md hover:bg-slate-700/50 transition-colors duration-150"
        >
            <div className={`flex items-center font-bold ${statusColor}`}>
                <Icon className="w-5 h-5 mr-1.5" />
                <span>{statusText}</span>
            </div>
            <div className="text-xs text-slate-300 font-mono mt-0.5">{timerText}</div>
        </button>
    );
};