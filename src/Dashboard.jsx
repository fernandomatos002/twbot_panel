// src/Dashboard.jsx
// (v21) - Adiciona a aba de Recrutamento
import React, { useState, useEffect } from 'react';
// Importa componentes existentes
import ProxyManagerSection from './ProxyManagerSection';
import TwAccountsManager from './TwAccountsManager';
import ConstructionPlanner from './ConstructionPlanner'; 
import GroupManager from './GroupManager'; 

// --- INÍCIO DA MODIFICAÇÃO (v21) ---
import RecruitmentPlanner from './RecruitmentPlanner'; // Importa o novo componente
// --- FIM DA MODIFICAÇÃO (v21) ---


// Chave para buscar o token (necessário para a função de refresh)
const TOKEN_KEY = 'jwtToken';

// --- Constantes de Status (para cálculo de bots rodando) ---
const BOT_STATUS = {
    ON: 'EM_EXECUÇÃO', OFF: 'PARADO', STARTING: 'INICIANDO...', STOPPING: 'PARANDO...',
    AUTHENTICATING: 'AUTENTICANDO', SESSION_MISSING: 'SESSÃO_AUSENTE',
    WORKER_MISSING: 'WORKER_AUSENTE', FAILURE: 'FALHA!',
};


// --- Sub-componente: Item do Menu ---
function MenuItem({ icon, label, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all whitespace-nowrap ${
        active
          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 shadow-lg shadow-yellow-500/20'
          : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
      }`}
    >
      <span className="mr-2">{icon}</span>{label}
    </button>
  );
}

// --- Sub-componente: Seção Configurações ---
function SettingsSection() {
  return (
    <div id="settings-section">
      <div className="rounded-2xl bg-slate-800/50 backdrop-blur border border-slate-700/50 p-8">
        <h2 className="text-2xl font-bold text-white mb-4">Configurações</h2>
        <p className="text-slate-400">Aqui você poderá ajustar as configurações do seu painel e dos bots.</p>
        {/* Futuras opções de configuração podem ir aqui */}
      </div>
    </div>
  );
}


// --- Componente Principal do Dashboard ---
function Dashboard({
    user,
    dashboardData, // Contém { user, tw_accounts, proxies }
    onLogout,
    onAddAccount,
    onDeleteAccount,
    onAddProxies,
    onDeleteProxy,
    onRefreshData,
    onSetAccountStatus,
    onAuthenticationStart,
    onAuthenticationEnd,
    fetchError,
    clearFetchError,
    onUpdateAccount,
}) {
  const [activeSection, setActiveSection] = useState('tw-accounts'); 

  // --- EFEITO: Atualiza dados UMA VEZ ao entrar na aba Proxies ---
  useEffect(() => {
    // Apenas atualiza se a aba ativa for 'proxy-manager'
    if (activeSection === 'proxy-manager') {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            console.log('[Dashboard.jsx] Entrando na aba Proxies, atualizando dados UMA VEZ.');
            onRefreshData(token);
        }
    }
  }, [activeSection, onRefreshData]);

  // --- Cálculos para o Header ---
  const stats = {
      activeAccountsCount: dashboardData?.tw_accounts?.length || 0,
      nextExpirationDate: dashboardData?.user?.plan_expiration_date ?
                                new Date(dashboardData.user.plan_expiration_date).toLocaleDateString('pt-BR') : 'N/A',
      runningBotsCount: dashboardData?.tw_accounts?.filter(acc => acc.botStatus === BOT_STATUS.ON).length || 0,
      activeProxiesCount: dashboardData?.proxies?.filter(p => p.status?.toLowerCase() === 'ativo').length || 0
  };

  const planStatus = dashboardData?.user?.plan_expiration_date ?
    `Plano expira em: ${stats.nextExpirationDate}` : 'Nenhum plano ativo';

  // Pega o token para passar aos componentes filhos que precisam dele
  const token = localStorage.getItem(TOKEN_KEY);

  // --- Renderização do Componente ---
  return (
    <div id="dashboard-section" className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      {/* Overlay de fundo (Grid pontilhado) */}
      <div className="fixed inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 1px, transparent 1px, transparent 35px)',
      }}></div>

      {/* Navbar Fixa no Topo */}
      <nav className="sticky top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b-2 border-yellow-500/30 backdrop-blur-md">
        {/* Barra Superior da Navbar */}
        <div className="px-8 py-4 flex items-center justify-between">
          {/* Lado Esquerdo: Logo e Info Usuário */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="text-center">
              <h1 className="text-2xl font-black text-yellow-400" style={{textShadow: '0px 0px 10px rgba(250,204,21,0.5)'}}>
                ⚔ TRIBAL WARS ⚔
              </h1>
              <p className="text-xs text-slate-400">Painel de Controle Avançado</p>
            </div>
            {/* Info Usuário (oculto em telas pequenas) */}
            <div className="border-l border-yellow-500/30 pl-8 hidden md:block">
              <p className="text-sm text-slate-200">
                Bem-vindo,
                <span id="dashboard-username" className="font-bold text-yellow-400">{user?.username || 'Usuário'}</span>!
              </p>
              <p id="plan-status" className="text-xs text-slate-400">{planStatus}</p>
            </div>
          </div>
          {/* Lado Direito: Stats Rápidos e Botões */}
          <div className="flex items-center gap-3">
             {/* Info rápida (oculto em telas menores) */}
             <div className="hidden lg:flex items-center gap-4 border-r border-yellow-500/30 pr-4 mr-1 text-xs">
                <span title="Contas Registradas">👥 {stats.activeAccountsCount}</span>
                <span title="Bots em Execução">🟢 {stats.runningBotsCount}</span>
                <span title="Proxies Ativos">🛡️ {stats.activeProxiesCount}</span>
             </div>
             {/* Botão Configurações */}
            <button
              onClick={() => setActiveSection('settings')}
              title="Configurações"
              className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600 text-slate-100 rounded-lg font-semibold transition-all border border-slate-600 hover:shadow-lg hover:shadow-yellow-500/20">
              ⚙
            </button>
            {/* Botão Sair */}
            <button
              id="logout-btn"
              onClick={onLogout}
              title="Sair"
              className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-100 rounded-lg font-semibold transition-all border border-red-700 hover:shadow-lg hover:shadow-red-500/20">
              🚪
            </button>
          </div>
        </div>
        {/* (Fim da Barra Superior) */}

        {/* Barra Inferior da Navbar (Abas de Navegação) */}
        <div className="bg-slate-800/50 border-t border-slate-700/50 px-8 py-2 flex gap-8 overflow-x-auto">
          <MenuItem icon="🏠" label="Visão Geral" active={activeSection === 'tw-accounts'} onClick={() => setActiveSection('tw-accounts')} />
          <MenuItem icon="🛡️" label="Proxies" active={activeSection === 'proxy-manager'} onClick={() => setActiveSection('proxy-manager')} />
          <MenuItem icon="🏗️" label="Construção" active={activeSection === 'construction-planner'} onClick={() => setActiveSection('construction-planner')} />
          
          {/* --- INÍCIO DA MODIFICAÇÃO (v21) --- */}
          <MenuItem icon="⚔️" label="Recrutamento" active={activeSection === 'recruitment-planner'} onClick={() => setActiveSection('recruitment-planner')} />
          {/* --- FIM DA MODIFICAÇÃO (v21) --- */}
          
          <MenuItem icon="👥" label="Grupos" active={activeSection === 'group-manager'} onClick={() => setActiveSection('group-manager')} />
        </div>
        {/* (Fim da Barra Inferior / Abas) */}
      </nav>
      {/* (Fim da Navbar) */}

      {/* Conteúdo Principal da Página (v15 - max-w-7xl removido) */}
      <main className="pt-8 px-8 pb-8 mx-auto w-full">
        {/* Exibição de Erros Globais (vindo do App.jsx) */}
        {fetchError && (
            <div className="mb-6 p-4 text-sm rounded-lg bg-red-900 text-red-300 border border-red-700 flex justify-between items-center">
                <span>Erro: {fetchError}</span>
                <button onClick={clearFetchError} className="font-bold text-lg px-2 leading-none">&times;</button>
            </div>
        )}

        {/* Renderização Condicional da Seção Ativa */}

        {/* Seção Visão Geral (Contas TW) */}
         {activeSection === 'tw-accounts' &&
            <TwAccountsManager
                accounts={dashboardData.tw_accounts}
                proxies={dashboardData.proxies || []}
                onAddAccount={onAddAccount}
                onDeleteAccount={onDeleteAccount}
                token={token} 
                onSetAccountStatus={onSetAccountStatus}
                onAuthenticationStart={onAuthenticationStart}
                onAuthenticationEnd={onAuthenticationEnd}
                onUpdateAccount={onUpdateAccount}
                onRefreshData={onRefreshData}
                // onOpenVillageViewer={...} // (Passar se o App.jsx controlar)
            />
        }

        {/* Seção Proxies */}
        {activeSection === 'proxy-manager' &&
            <ProxyManagerSection
                initialProxies={dashboardData.proxies}
                onAddProxies={onAddProxies}
                onDeleteProxy={onDeleteProxy}
                token={token} 
            />
        }

        {/* Seção Planejador de Construção */}
        {activeSection === 'construction-planner' &&
            <ConstructionPlanner
                token={token}
            />
        }
        
        {/* --- INÍCIO DA MODIFICAÇÃO (v21) --- */}
        {/* Seção Planejador de Recrutamento */}
        {activeSection === 'recruitment-planner' &&
            <RecruitmentPlanner
                token={token}
            />
        }
        {/* --- FIM DA MODIFICAÇÃO (v21) --- */}


        {/* Seção Gerenciador de Grupos */}
        {activeSection === 'group-manager' &&
            <GroupManager
                token={token} 
                allAccounts={dashboardData.tw_accounts || []} 
            />
        }

        {/* Seção Configurações */}
        {activeSection === 'settings' && <SettingsSection />}

      </main>
      {/* (Fim do Conteúdo Principal) */}
    </div> /* Fim do container principal */
  );
}

export default Dashboard;