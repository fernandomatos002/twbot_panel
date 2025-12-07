// src/LoginScreen.jsx

import React, { useState, useEffect } from 'react';

// O componente agora aceita as funções onLogin e onRegister,
// e a mensagem de feedback que será passada do App.jsx.
const LoginScreen = ({ onLogin, onRegister }) => { // Renomeado para LoginScreen
  // CORREÇÃO: Desestruturação de useState usa colchetes []
  const [activeTab, setActiveTab] = useState('login');
  const [message, setMessage] = useState({ text: '', type: '' }); // Estado local para mensagens
  const [particles, setParticles] = useState([]); // CORREÇÃO: Usar array vazio []
  
  // O email aqui deve ser o 'identifier' (email ou username) que o backend espera.
  const [loginData, setLoginData] = useState({ identifier: '', password: '', remember: false });
  
  const [registerData, setRegisterData] = useState({ username: '', email: '', password: '', confirm: '', terms: false });

  // --- Lógica de Partículas (Mantida) ---
  useEffect(() => {
    const generatedParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 20,
      duration: 15 + Math.random() * 15,
    }));
    setParticles(generatedParticles);
  }, []); // CORREÇÃO: Lista de dependências usa colchetes []

  // --- Handlers de Mudança (Adaptados para 'identifier' no login) ---
  const handleLoginChange = (e) => {
    const { name, value, type, checked } = e.target;
    // O campo de email/usuário agora se chama 'identifier' no estado de login
    setLoginData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // --- Handler de Login (Reintegrando a lógica do App.jsx) ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Conectando ao servidor...', type: 'info' });
    try {
      await onLogin(loginData); // Passa { identifier, password } para o App.jsx
      // O App.jsx trata de setar o isLoggedIn para true, então não precisamos de sucesso aqui
    } catch (error) {
      // O App.jsx deve tratar o erro e lançar uma exceção com a mensagem de erro da API.
      setMessage({ text: `Erro ao fazer login: ${error.message}`, type: 'error' });
    }
  };

  // --- Handler de Registro (Reintegrando a lógica do App.jsx) ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: 'Processando registro...', type: 'info' });

    if (registerData.password !== registerData.confirm) {
      setMessage({ text: 'Erro: As senhas não coincidem!', type: 'error' });
      return;
    }
    if (registerData.password.length < 8) {
      setMessage({ text: 'Erro: A senha deve ter no mínimo 8 caracteres.', type: 'error' });
      return;
    }
    if (!registerData.terms) {
      setMessage({ text: 'Erro: Você deve concordar com os Termos de Serviço.', type: 'error' });
      return;
    }

    try {
      // Cria um objeto de dados sem o campo 'confirm' e 'terms' para enviar à API
      const apiData = { 
        username: registerData.username, 
        email: registerData.email, 
        password: registerData.password 
      };
      
      await onRegister(apiData); 
      setMessage({ text: 'Registro realizado com sucesso! Use o Login para entrar.', type: 'success' });
      // Limpa os campos e muda para a aba de login
      setRegisterData({ username: '', email: '', password: '', confirm: '', terms: false });
      setActiveTab('login');
    } catch (error) {
      setMessage({ text: `Erro ao registrar: ${error.message}`, type: 'error' });
    }
  };
    
    // Funções auxiliares para classes de mensagem (usando o estilo que você definiu)
    const getMessageClass = (type) => {
      if (type === 'success') return 'bg-green-900 text-green-300 border border-green-700';
      if (type === 'error') return 'bg-red-900 text-red-300 border border-red-700';
      return 'bg-blue-900 text-blue-300 border border-blue-700'; // info
    }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
      {/* Partículas (usando keyframe 'float' de index.css) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute w-0.5 h-0.5 bg-yellow-500 rounded-full"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              opacity: 0.3,
              animation: `float ${particle.duration}s infinite linear`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Container Principal */}
      <div className="relative z-10 flex w-11/12 max-w-4xl bg-slate-900/50 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-2xl border border-yellow-500/10 animate-in fade-in slide-in-from-bottom-8 duration-600">
        
        {/* Seção de Branding */}
        <div className="hidden md:flex flex-1 bg-gradient-to-br from-yellow-500/5 to-yellow-500/0 p-16 flex-col justify-center items-center relative border-r border-yellow-500/10">
          {/* Usando a classe de CSS pura 'bg-gradient-radial' de index.css */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-radial from-yellow-500/10 to-transparent rounded-full blur-3xl opacity-50"></div>
          
          <div className="text-8xl mb-8 drop-shadow-lg animate-pulse" style={{ animation: 'float-logo 3s ease-in-out infinite' }}> 
                {/* Usando o keyframe 'float-logo' de index.css */}
            ⚔️
          </div>
          
          <h1 className="text-5xl font-black text-yellow-400 mb-4 tracking-wider drop-shadow-lg">
            TRIBAL WARS
          </h1>
          
          <div className="w-16 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent mb-8"></div>
          
          <p className="text-center text-blue-300 text-sm max-w-xs leading-relaxed">
            Construa seu império e conquiste a glória. Domine o mapa e torne-se uma lenda!
          </p>
        </div>

        {/* Seção de Formulário */}
        <div className="flex-1 p-12 md:p-16 flex flex-col justify-center">
          {/* Tabs */}
          <div className="flex gap-10 mb-10 border-b border-yellow-500/10 pb-6">
            <button
              onClick={() => { setActiveTab('login'); setMessage({ text: '', type: '' }); }}
              className={`text-sm font-bold tracking-widest uppercase transition-all duration-300 pb-2 relative ${
                activeTab === 'login'
                  ? 'text-yellow-400'
                  : 'text-slate-400 hover:text-yellow-400'
              }`}
            >
              Login
              {activeTab === 'login' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-transparent"></div>
              )}
            </button>
            
            <button
              onClick={() => { setActiveTab('register'); setMessage({ text: '', type: '' }); }}
              className={`text-sm font-bold tracking-widest uppercase transition-all duration-300 pb-2 relative ${
                activeTab === 'register'
                  ? 'text-yellow-400'
                  : 'text-slate-400 hover:text-yellow-400'
              }`}
            >
              Registrar
              {activeTab === 'register' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-transparent"></div>
              )}
            </button>
          </div>
          
          {/* Caixa de Mensagem */}
          {message.text && (
            <div 
                className={`p-4 rounded-lg mb-6 text-sm font-semibold ${getMessageClass(message.type)} animate-in fade-in duration-300`}>
              {message.text}
            </div>
          )}

          {/* Formulário de Login */}
          <form onSubmit={handleLoginSubmit}>
            {activeTab === 'login' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <label htmlFor="login-identifier" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  E-mail ou Usuário
                </label>
                <input
                  type="text"
                  id="login-identifier"
                  name="identifier"
                  value={loginData.identifier}
                  onChange={handleLoginChange}
                  placeholder="Seu e-mail ou nome de usuário"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  Senha
                </label>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  placeholder="Digite sua senha"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="remember"
                  name="remember"
                  checked={loginData.remember}
                  onChange={handleLoginChange}
                  className="w-5 h-5 accent-yellow-400 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-slate-400 cursor-pointer">
                  Lembrar-me neste dispositivo
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 font-bold py-3 px-4 rounded-lg uppercase tracking-wider transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/50 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-yellow-500/30"
              >
                ⚡ Entrar na Batalha
              </button>

              <div className="flex justify-between items-center text-xs mt-6 pt-4 border-t border-slate-700">
                <button type="button" onClick={() => setActiveTab('register')} className="text-yellow-400 hover:drop-shadow-lg transition-all">
                  Novo guerreiro?
                </button>
                <a href="#" className="text-yellow-400 hover:drop-shadow-lg transition-all">
                  Esqueceu sua senha?
                </a>
              </div>
            </div>
            )}
          </form>

          {/* Formulário de Registro */}
          <form onSubmit={handleRegisterSubmit}>
            {activeTab === 'register' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <label htmlFor="register-username" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  Usuário
                </label>
                <input
                  type="text"
                  id="register-username"
                  name="username"
                  value={registerData.username}
                  onChange={handleRegisterChange}
                  placeholder="Escolha seu nome na história"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="register-email" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  E-mail
                </label>
                <input
                  type="email"
                  id="register-email"
                  name="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  placeholder="seu@email.com"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="register-password" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  Senha
                </label>
                <input
                  type="password"
                  id="register-password"
                  name="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="register-confirm" className="text-xs font-bold text-yellow-400 tracking-widest uppercase">
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  id="register-confirm"
                  name="confirm"
                  value={registerData.confirm}
                  onChange={handleRegisterChange}
                  placeholder="Confirme sua senha"
                  className="w-full mt-2 bg-yellow-500/5 border border-yellow-500/20 text-slate-200 px-4 py-3 rounded-lg focus:outline-none focus:bg-yellow-500/10 focus:border-yellow-400 transition-all duration-300 placeholder-slate-600"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  name="terms"
                  checked={registerData.terms}
                  onChange={handleRegisterChange}
                  className="w-5 h-5 accent-yellow-400 cursor-pointer"
                  required
                />
                <label htmlFor="terms" className="text-xs text-slate-400 cursor-pointer">
                  Concordo com os Termos de Serviço
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-slate-900 font-bold py-3 px-4 rounded-lg uppercase tracking-wider transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/50 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-yellow-500/30"
              >
                🛡️ Criar Minha Conta
              </button>
            </div>
            )}
          </form>
        </div>
      </div>

    </div>
  );
}; // <--- CHAVE DE FECHAMENTO FINAL

export default LoginScreen;