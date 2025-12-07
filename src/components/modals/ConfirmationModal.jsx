// src/components/modals/ConfirmationModal.jsx
// (v16) - Extraído do TwAccountsManager
import React from 'react';

export default function ConfirmationModal({ message, onConfirm, onCancel, targetUsername }) {
    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-slate-800 p-8 rounded-xl border border-red-500/30 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-50 duration-300">
                <h3 className="text-2xl font-bold text-red-400 mb-4">⚠️ Confirmação de Exclusão</h3>
                <p className="text-slate-300 mb-6 font-semibold">
                    {message} <br /> {targetUsername && <span className="text-yellow-400">{targetUsername}</span>}
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-bold transition-all"> Cancelar </button>
                    <button onClick={onConfirm} className="py-2 px-4 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold transition-all"> Confirmar Exclusão </button>
                </div>
            </div>
        </div>
    );
}