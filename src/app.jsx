import React, { useState, useEffect, useCallback, useRef } from 'react';
import LoginScreen from './LoginScreen';
import Dashboard from './Dashboard';

// **** MODIFICAÇÃO: Chaves para ambos os tokens ****
const TOKEN_KEY = 'jwtToken'; // Chave para o Access Token
const REFRESH_TOKEN_KEY = 'jwtRefreshToken'; // Chave para o Refresh Token
// ************************************************

const DASHBOARD_STATE_PREFIX = 'accountDashboardState_'; // Prefixo para localStorage

// Constantes de Status (para consistência)
const BOT_STATUS = {
  ON: 'EM_EXECUÇÃO',
  OFF: 'PARADO',
  STARTING: 'INICIANDO...',
  STOPPING: 'PARANDO...',
  AUTHENTICATING: 'AUTENTICANDO',
  SESSION_MISSING: 'SESSÃO_AUSENTE',
  WORKER_MISSING: 'WORKER_AUSENTE',
  FAILURE: 'FALHA!',
  CAPTCHA_DETECTADO: 'CAPTCHA_DETECTADO'
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [dashboardData, setDashboardData] = useState({ user: null, tw_accounts: [], proxies: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null); // Estado para guardar erros

  const dashboardDataRef = useRef(dashboardData);
  useEffect(() => { dashboardDataRef.current = dashboardData; }, [dashboardData]);

  // **** MODIFICAÇÃO: 'fetchAndSetDashboardData' agora tenta dar refresh do token ****
  const fetchAndSetDashboardData = useCallback(async (token, isInitialLoad = false, retryAttempt = false) => {
    // Lógica inalterada de validação
    if (!token || typeof window.api === 'undefined') {
      console.error('[App.jsx] fetch: API/Token ausente.');
      setFetchError('API/Token ausente.');
      if (isInitialLoad) setIsLoading(false);
      if (!token && isLoggedIn) {
        // **** MODIFICAÇÃO: Limpa ambos os tokens no logout forçado ****
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setIsLoggedIn(false);
        setUser(null);
        setDashboardData({ user: null, tw_accounts: [], proxies: [] });
      }
      return false;
    }

    console.log(`[App.jsx] Fetching data... (Initial: ${isInitialLoad})`);
    setFetchError(null);
    if (isInitialLoad) setIsLoading(true);

    try {
      const result = await window.api.fetchDashboardData(token);
      console.log('[App.jsx] Fetch response:', result);

      if (result?.success && result.data) {
        console.log('[App.jsx] DEBUG: Dados BRUTOS recebidos do servidor (tw_accounts):', JSON.stringify(result.data.tw_accounts, null, 2));

        // Preserva o estado (lógica inalterada)
        const currentAccountsMap = new Map((dashboardDataRef.current.tw_accounts || []).map(acc => [acc.id, {
          botStatus: acc.botStatus,
          busyAuthentication: acc.busyAuthentication,
          lastLog: acc.lastLog,
          proxyStatus: acc.proxyStatus,
          resources: acc.resources,
          playerPoints: acc.playerPoints,
          lastStatusUpdateTimestamp: acc.lastStatusUpdateTimestamp
        }]));

        const accountsWithStatus = (result.data.tw_accounts || []).map(newAcc => {
          const existingState = currentAccountsMap.get(newAcc.id);
          return {
            ...newAcc,
            botStatus: existingState ? existingState.botStatus : BOT_STATUS.OFF,
            busyAuthentication: existingState ? existingState.busyAuthentication : false,
            lastLog: existingState ? existingState.lastLog : null,
            proxyStatus: existingState ? existingState.proxyStatus : undefined,
            resources: existingState?.resources ?? null,
            playerPoints: existingState?.playerPoints ?? null,
            lastStatusUpdateTimestamp: existingState?.lastStatusUpdateTimestamp ?? null
          };
        });

        setDashboardData({ ...result.data, tw_accounts: accountsWithStatus });
        setUser(result.data.user);
        setIsLoggedIn(true);
        console.log('[App.jsx] Data updated.');
        return true;

      // **** MODIFICAÇÃO: Lógica de Refresh Token do Frontend ****
      } else if (result?.code === 'UNAUTHORIZED' && !retryAttempt) {
        console.warn('[App.jsx] Fetch error: Unauthorized (401). Tentando refresh...');
        setFetchError('Sessão expirou, atualizando...');

        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          console.error('[App.jsx] Refresh falhou: Refresh Token não encontrado.');
          throw new Error('Sessão expirada. Faça login novamente.'); // Vai para o logout
        }

        // Você PRECISARÁ ADICIONAR 'refreshToken' ao seu preload.js e index.cjs
        const refreshResult = await window.api.refreshToken(refreshToken);

        if (refreshResult?.success && refreshResult.accessToken) {
          console.log('[App.jsx] Refresh bem-sucedido. Salvando novo Access Token.');
          localStorage.setItem(TOKEN_KEY, refreshResult.accessToken);
          // Tenta novamente o fetch original, marcando como retentativa
          return await fetchAndSetDashboardData(refreshResult.accessToken, isInitialLoad, true);
        } else {
          console.error('[App.jsx] Refresh falhou: Servidor recusou o refresh token.');
          throw new Error('Sessão expirada. Faça login novamente.'); // Vai para o logout
        }

      } else {
        const errorMessage = result?.message || 'Invalid data structure.';
        console.error('[App.jsx] Fetch failed (success: false):', errorMessage);
        setFetchError(errorMessage);

        // **** MODIFICAÇÃO: Se a retentativa falhou, força o logout ****
        if (result?.code === 'UNAUTHORIZED' && retryAttempt) {
          console.error('[App.jsx] Refresh falhou. Forçando logout.');
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          setIsLoggedIn(false);
          setUser(null);
          setDashboardData({ user: null, tw_accounts: [], proxies: [] });
        }
        return false;
      }
    } catch (error) {
      console.error('[App.jsx] CRITICAL Fetch Error:', error?.message || error);
      setFetchError(`Erro: ${error?.message || String(error)}`);

      // **** MODIFICAÇÃO: Força o logout se o erro for "Sessão expirada" ****
      if (error?.message && error.message.includes('Sessão expirada')) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        setIsLoggedIn(false);
        setUser(null);
        setDashboardData({ user: null, tw_accounts: [], proxies: [] });
      }
      return false;
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetchAndSetDashboardData(token, true);
    } else {
      setIsLoading(false);
    }
  }, [fetchAndSetDashboardData]);

  // **** MODIFICAÇÃO: 'handleLogin' agora salva accessToken e refreshToken ****
  const handleLogin = useCallback(async (credentials) => {
    setFetchError(null);
    try {
      const result = await window.api.login(credentials);

      // **** CORREÇÃO PRINCIPAL ****
      if (result?.success && result.data?.accessToken && result.data?.refreshToken) {
        const { accessToken, refreshToken } = result.data;

        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken); // Salva o refresh token

        setIsLoading(true);
        // Passa o novo accessToken para o fetch
        await fetchAndSetDashboardData(accessToken, true);
        // Não lança erro, permitindo o LoginScreen sumir
      } else {
        // Agora isso é uma falha real (ex: senha errada)
        throw new Error(result?.message || 'Credenciais inválidas.');
      }
    } catch (error) {
      setFetchError(error?.message || String(error));
      setIsLoading(false);
      throw error; // Lança o erro para o LoginScreen exibir
    }
  }, [fetchAndSetDashboardData]);

  const handleRegister = useCallback(async (userData) => {
    setFetchError(null);
    try {
      const result = await window.api.register(userData);
      if (!result?.success) {
        throw new Error(result?.message || 'Falha registro.');
      }
    } catch (error) {
      setFetchError(error?.message || String(error));
      throw error;
    }
  }, []);

  // **** MODIFICAÇÃO: 'handleLogout' agora limpa ambos os tokens e avisa o servidor ****
  const handleLogout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    // Tenta invalidar o token no servidor (mesmo se falhar, desloga localmente)
    if (refreshToken && window.api?.logout) {
      try {
        await window.api.logout(refreshToken);
        console.log('[App.jsx] Refresh token invalidado no servidor.');
      } catch (e) {
        console.warn('[App.jsx] Falha ao invalidar token no servidor (logout local prosseguirá):', e?.message || e);
      }
    }

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY); // Limpa o refresh token
    setUser(null);
    setDashboardData({ user: null, tw_accounts: [], proxies: [] });
    setIsLoggedIn(false);
    setFetchError(null);
  }, []);

  // ====================================================================
  // --- Handlers CRUD (Lógica inalterada, mas usam o TOKEN_KEY correto) ---
  // ====================================================================

  // ** handleAddAccount (MODIFICADO para inicializar playerPoints) **
  const handleAddAccount = useCallback(async (accountData) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { handleLogout(); return; }
    setFetchError(null);
    const optimisticId = `temp-${Date.now()}`;
    // *** Inicializa resources E playerPoints como null ***
    const optimisticAccount = { ...accountData, id: optimisticId, proxy_status: accountData.proxy_id ? 'Verificando...' : null, botStatus: BOT_STATUS.OFF, busyAuthentication: false, resources: null, playerPoints: null, lastStatusUpdateTimestamp: null };
    setDashboardData(prevData => ({ ...prevData, tw_accounts: [...prevData.tw_accounts, optimisticAccount] }));
    console.log(`[App.jsx] Otimista Add Acc ${optimisticId}`);
    try {
      const result = await window.api.addTwAccount({ token, ...accountData });
      if (result && result.success && result.account && result.account.id) {
        console.log('[App.jsx] Sucesso API addAccount:', result.account.id);
        // *** Inicializa resources E playerPoints como null ***
        setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.map(acc => acc.id === optimisticId ? { ...result.account, botStatus: BOT_STATUS.OFF, busyAuthentication: false, proxyStatus: result.account.proxy_id ? 'Verificando...' : null, resources: null, playerPoints: null, lastStatusUpdateTimestamp: null } : acc ) }));
      } else {
        const errorMessage = result?.message || 'Erro add conta (API não retornou dados?).';
        console.error('[App.jsx] Falha API addAccount:', errorMessage, result);
        setFetchError(errorMessage);
        setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.filter(acc => acc.id !== optimisticId) }));
      }
    } catch (error) {
      console.error('[App.jsx] Erro CRÍTICO handleAddAccount:', error?.message || error);
      setFetchError(`Erro comunicação: ${error?.message || String(error)}`);
      setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.filter(acc => acc.id !== optimisticId) }));
    }
  }, [handleLogout]);

  // ** handleDeleteAccount (MODIFICADO para limpar localStorage com novo prefixo) **
  const handleDeleteAccount = useCallback(async (accountId) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { handleLogout(); return; }
    setFetchError(null);
    const accountToRemove = dashboardDataRef.current.tw_accounts.find(acc => acc.id === accountId);
    if (!accountToRemove) return;
    setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.filter(acc => acc.id !== accountId) }));
    console.log(`[App.jsx] Otimista Delete Acc ${accountId}`);
    try {
      const result = await window.api.deleteTwAccount({ token, accountId });
      if (result?.success) {
        console.log('[App.jsx] Sucesso API deleteAccount. Fetching para proxy...');
        localStorage.removeItem(`${DASHBOARD_STATE_PREFIX}${accountId}`); // Limpa o localStorage (novo prefixo)
        console.log(`[App.jsx] Estado do dashboard no localStorage removido para ${accountId}`);
        await fetchAndSetDashboardData(token); // Mantido para atualizar proxy
      } else {
        const errorMessage = result?.message || 'Erro excluir conta.';
        console.error('[App.jsx] Falha API deleteAccount:', errorMessage);
        setFetchError(errorMessage);
        setDashboardData(prevData => ({ ...prevData, tw_accounts: [...prevData.tw_accounts, accountToRemove] })); // Reverte
      }
    } catch (error) {
      console.error('[App.jsx] Erro CRÍTICO handleDeleteAccount:', error?.message || error);
      setFetchError(`Erro comunicação: ${error?.message || String(error)}`);
      setDashboardData(prevData => ({ ...prevData, tw_accounts: [...prevData.tw_accounts, accountToRemove] })); // Reverte
    }
  }, [fetchAndSetDashboardData, handleLogout]);

  // ** handleAddProxies (inalterado) **
  const handleAddProxies = useCallback(async (proxiesList) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { handleLogout(); return; }
    setFetchError(null);
    const optimisticProxies = proxiesList.map((p, i) => ({ id: `temp-proxy-${Date.now()}-${i}`, ip: p.ip, port: p.port, user: p.user, status: 'Pendente', country: 'Verificando...', assignedTo: null, last_tested_at: null }));
    setDashboardData(prevData => ({ ...prevData, proxies: [...prevData.proxies, ...optimisticProxies] }));
    console.log(`[App.jsx] Otimista Add Proxies ${optimisticProxies.length}`);
    try {
      const result = await window.api.addProxies({ token, proxies: proxiesList });
      if (result && result.success) {
        console.log('[App.jsx] Sucesso API addProxies. API não retorna dados, recarregando...');
        await fetchAndSetDashboardData(token);
      } else {
        const errorMessage = result?.message || 'Erro add proxies (API não retornou dados?).';
        console.error('[App.jsx] Falha API addProxies:', errorMessage, result);
        setFetchError(errorMessage);
        setDashboardData(prevData => ({ ...prevData, proxies: prevData.proxies.filter(p => !p.id.startsWith('temp-proxy-')) }));
      }
    } catch (error) {
      console.error('[App.jsx] Erro CRÍTICO handleAddProxies:', error?.message || error);
      setFetchError(`Erro comunicação: ${error?.message || String(error)}`);
      setDashboardData(prevData => ({ ...prevData, proxies: prevData.proxies.filter(p => !p.id.startsWith('temp-proxy-')) }));
    }
  }, [handleLogout, fetchAndSetDashboardData]);

  // ** handleDeleteProxy (inalterado) **
  const handleDeleteProxy = useCallback(async (proxyId) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { handleLogout(); return; }
    setFetchError(null);
    const proxyToRemove = dashboardDataRef.current.proxies.find(p => p.id === proxyId);
    if (!proxyToRemove) return;
    setDashboardData(prevData => ({ ...prevData, proxies: prevData.proxies.filter(p => p.id !== proxyId) }));
    console.log(`[App.jsx] Otimista Delete Proxy ${proxyId}`);
    try {
      const result = await window.api.deleteProxy({ token, proxyId });
      if (result?.success) {
        console.log('[App.jsx] Sucesso API deleteProxy.');
      } else {
        const errMsg = result?.message || 'Erro excluir proxy.';
        console.error('[App.jsx] Falha API deleteProxy:', errMsg);
        setFetchError(errMsg);
        setDashboardData(prevData => ({ ...prevData, proxies: [...prevData.proxies, proxyToRemove] })); // Reverte
      }
    } catch (error) {
      console.error('[App.jsx] Erro CRÍTICO handleDeleteProxy:', error?.message || error);
      setFetchError(`Erro comunicação: ${error?.message || String(error)}`);
      setDashboardData(prevData => ({ ...prevData, proxies: [...prevData.proxies, proxyToRemove] })); // Reverte
    }
  }, [handleLogout]);

  // ** handleUpdateAccount (inalterado) **
  const handleUpdateAccount = useCallback(async (accountId, updatedData) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      handleLogout();
      throw new Error('Sessão expirada. Faça login novamente.'); // Rejeita para o modal
    }
    setFetchError(null);

    // 1. Salvar o estado antigo para rollback
    const accountToUpdate = dashboardDataRef.current.tw_accounts.find(acc => acc.id === accountId);
    if (!accountToUpdate) {
      console.error(`[App.jsx] Falha ao atualizar: Conta ID ${accountId} não encontrada.`);
      throw new Error('Conta não encontrada. Recarregue a página.');
    }

    // 2. Atualização Otimista
    const optimisticAccount = { ...accountToUpdate, ...updatedData };
    if ('proxy_id' in updatedData && updatedData.proxy_id !== accountToUpdate.proxy_id) {
      optimisticAccount.proxyStatus = updatedData.proxy_id ? 'Verificando...' : null;
    }
    setDashboardData(prevData => ({
      ...prevData,
      tw_accounts: prevData.tw_accounts.map(acc =>
        acc.id === accountId ? optimisticAccount : acc
      ),
    }));
    console.log(`[App.jsx] Otimista Update Acc ${accountId}`, updatedData);

    try {
      // 3. Chamada IPC/API
      const result = await window.api.updateTwAccount(accountId, updatedData);

      if (result?.success && result.account) {
        // 4. Sucesso API
        console.log(`[App.jsx] Sucesso API Update Acc ${accountId}`);

        // 5. Caso Especial: Mudança de Proxy
        if ('proxy_id' in updatedData && updatedData.proxy_id !== accountToUpdate.proxy_id) {
          console.log('[App.jsx] Proxy foi alterado. Recarregando todos os dados...');
          await fetchAndSetDashboardData(token);
        } else {
          // Se o proxy NÃO mudou, apenas atualizamos a conta com os dados do servidor
          setDashboardData(prevData => ({
            ...prevData,
            tw_accounts: prevData.tw_accounts.map(acc =>
              acc.id === accountId ? { ...acc, ...result.account, proxyStatus: acc.proxyStatus } : acc
            ),
          }));
        }
        return;

      } else {
        // 6. Falha API (Rollback)
        const errorMessage = result?.message || 'Erro ao atualizar conta.';
        console.error('[App.jsx] Falha API updateAccount:', errorMessage);
        setFetchError(errorMessage);
        setDashboardData(prevData => ({
          ...prevData,
          tw_accounts: prevData.tw_accounts.map(acc =>
            acc.id === accountId ? accountToUpdate : acc
          ),
        }));
        throw new Error(errorMessage);
      }
    } catch (error) {
      // 7. Erro Comunicação (Rollback)
      console.error('[App.jsx] Erro CRÍTICO handleUpdateAccount:', error?.message || error);
      setFetchError(`Erro comunicação: ${error?.message || String(error)}`);
      setDashboardData(prevData => ({
        ...prevData,
        tw_accounts: prevData.tw_accounts.map(acc =>
          acc.id === accountId ? accountToUpdate : acc
        ),
      }));
      throw error;
    }
  }, [handleLogout, fetchAndSetDashboardData]);

  // --- Handlers para Gerenciamento de Estado Otimista dos Bots ---
  const handleSetAccountStatus = useCallback((accountId, status, log = null) => {
    setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.map(acc => acc.id === accountId ? { ...acc, botStatus: status, ...(log !== null && { lastLog: log, lastStatusUpdateTimestamp: new Date().toISOString() }) } : acc) }));
  }, []);
  const handleAuthenticationStart = useCallback((accountId) => { setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.map(acc => acc.id === accountId ? { ...acc, busyAuthentication: true, botStatus: BOT_STATUS.AUTHENTICATING, lastStatusUpdateTimestamp: new Date().toISOString() } : acc) })); }, []);
  const handleAuthenticationEnd = useCallback((accountId) => { setDashboardData(prevData => ({ ...prevData, tw_accounts: prevData.tw_accounts.map(acc => acc.id === accountId ? { ...acc, busyAuthentication: false } : acc) })); }, []);

  // --- Efeito para Escutar Atualizações de Status GERAIS via IPC ---
  useEffect(() => {
    if (!window.api?.onAutomationStatusUpdate) return;
    const handleStatusUpdateIPC = (statusData) => {
      if (!statusData?.accountId || !statusData?.status) return;
      setDashboardData(prevData => {
        const accountExists = prevData.tw_accounts.some(acc => acc.id === statusData.accountId);
        if (!accountExists) return prevData;
        return {
          ...prevData,
          tw_accounts: prevData.tw_accounts.map(account =>
            account.id === statusData.accountId
              ? {
                ...account,
                botStatus: statusData.status,
                lastLog: statusData.log !== undefined ? statusData.log : account.lastLog,
                lastStatusUpdateTimestamp: statusData.timestamp
              }
              : account
          )
        };
      });
    };
    const cleanupIPC = window.api.onAutomationStatusUpdate(handleStatusUpdateIPC);
    return () => { if (cleanupIPC && typeof cleanupIPC === 'function') cleanupIPC(); };
  }, []);

  // --- Efeito para Escutar Atualizações de Status do PROXY via IPC ---
  useEffect(() => {
    if (!window.api?.onProxyStatusUpdate) {
      console.warn('[App.jsx] window.api.onProxyStatusUpdate não está disponível no preload.');
      return;
    }
    const handleProxyStatusUpdateIPC = (proxyData) => {
      if (!proxyData?.accountId || !proxyData?.proxyStatus) {
        console.warn('[App.jsx] Recebido proxyStatusUpdate inválido:', proxyData);
        return;
      }
      console.log(`[App.jsx] Recebido proxyStatusUpdate via IPC: ${proxyData.accountId} -> ${proxyData.proxyStatus}`);
      setDashboardData(prevData => {
        const accountExists = prevData.tw_accounts.some(acc => acc.id === proxyData.accountId);
        if (!accountExists) {
          console.warn(`[App.jsx] Recebido proxyStatusUpdate para conta ${proxyData.accountId}, mas ela não foi encontrada no estado.`);
          return prevData; // Não faz nada se a conta não existe mais
        }
        return {
          ...prevData,
          tw_accounts: prevData.tw_accounts.map(account =>
            account.id === proxyData.accountId
              ? { ...account, proxyStatus: proxyData.proxyStatus }
              : account
          ),
        };
      });
    };
    const cleanupIPC = window.api.onProxyStatusUpdate(handleProxyStatusUpdateIPC);
    return () => {
      if (cleanupIPC && typeof cleanupIPC === 'function') {
        console.log('[App.jsx] Limpando listener onProxyStatusUpdate.');
        cleanupIPC();
      }
    };
  }, []);

  // --- Efeito para Escutar Atualizações de RECURSOS via IPC (MODIFICADO para salvar o ESTADO COMPLETO) ---
  useEffect(() => {
    if (!window.api?.onDashboardUpdate) {
      console.warn('[App.jsx] window.api.onDashboardUpdate não está disponível no preload.');
      return;
    }
    const handleDashboardUpdateIPC = (data) => {
      if (!data?.accountId || !data?.state) {
        console.warn('[App.jsx] Recebido dashboardUpdate inválido:', data);
        return;
      }
      const { accountId, state } = data;
      setDashboardData(prevData => {
        const accountExists = prevData.tw_accounts.some(acc => acc.id === accountId);
        if (!accountExists) {
          console.warn(`[App.jsx] Recebido dashboardUpdate para conta ${accountId}, mas ela não foi encontrada.`);
          return prevData; // Não faz nada
        }
        return {
          ...prevData,
          tw_accounts: prevData.tw_accounts.map(account =>
            account.id === accountId
              ? { ...account, ...state } // Funde o objeto 'state' (playerPoints e resources)
              : account
          ),
        };
      });
      try {
        localStorage.setItem(`${DASHBOARD_STATE_PREFIX}${accountId}`, JSON.stringify(state));
      } catch (e) {
        console.error(`[App.jsx] Falha ao salvar estado do dashboard no localStorage para ${accountId}:`, e);
      }
    };
    console.log('[App.jsx] Registrando listener onDashboardUpdate...');
    const cleanupIPC = window.api.onDashboardUpdate(handleDashboardUpdateIPC);
    return () => {
      if (cleanupIPC && typeof cleanupIPC === 'function') {
        console.log('[App.jsx] Limpando listener onDashboardUpdate.');
        cleanupIPC();
      }
    };
  }, []);

  // **** NOVO: Efeito para escutar atualizações de token vindas do worker ****
  useEffect(() => {
    if (!window.api?.onTokenWasUpdated) {
      console.warn('[App.jsx] window.api.onTokenWasUpdated não está disponível no preload.');
      return;
    }

    // O worker (via main process) nos disse que o token foi atualizado
    const handleTokenUpdateIPC = (data) => {
      if (data?.newAccessToken) {
        console.log("[App.jsx] Recebido 'onTokenWasUpdated' via IPC. Atualizando localStorage.");
        localStorage.setItem(TOKEN_KEY, data.newAccessToken);
      } else {
        console.warn("[App.jsx] Recebido 'onTokenWasUpdated' mas sem newAccessToken.");
      }
    };

    console.log('[App.jsx] Registrando listener onTokenWasUpdated...');
    const cleanupIPC = window.api.onTokenWasUpdated(handleTokenUpdateIPC);

    return () => {
      if (cleanupIPC && typeof cleanupIPC === 'function') {
        console.log('[App.jsx] Limpando listener onTokenWasUpdated.');
        cleanupIPC();
      }
    };
  }, []); // Roda apenas uma vez


  // --- Renderização ---
  if (isLoading) { return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-yellow-400 font-sans">Carregando...</div>; }
  if (!isLoggedIn) { return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} initialError={fetchError} />; }

  return (
    <Dashboard
      user={user}
      dashboardData={dashboardData}
      onLogout={handleLogout}
      onAddAccount={handleAddAccount}
      onDeleteAccount={handleDeleteAccount}
      onAddProxies={handleAddProxies}
      onDeleteProxy={handleDeleteProxy}
      onRefreshData={fetchAndSetDashboardData}
      fetchError={fetchError}
      clearFetchError={() => setFetchError(null)}
      onSetAccountStatus={handleSetAccountStatus}
      onAuthenticationStart={handleAuthenticationStart}
      onAuthenticationEnd={handleAuthenticationEnd}
      token={localStorage.getItem(TOKEN_KEY)}
      onUpdateAccount={handleUpdateAccount}
    />
  );
}

export default App;
