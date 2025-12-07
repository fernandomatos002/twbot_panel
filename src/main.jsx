import React from 'react'
import ReactDOM from 'react-dom/client'
// Corrigindo os caminhos para garantir que encontram os ficheiros dentro da pasta 'src'
import App from './App.jsx'
import './index.css' // Carrega o Tailwind

// Inicializa o React
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


