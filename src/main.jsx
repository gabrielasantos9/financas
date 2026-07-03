import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Tela de erro amigável: se algo quebrar em produção, o app mostra essa
// mensagem em vez de uma tela branca, e os dados no localStorage não são
// perdidos (só a tela trava, os dados continuam salvos no navegador).
class LimiteDeErro extends React.Component {
  constructor(props) {
    super(props)
    this.state = { comErro: false }
  }

  static getDerivedStateFromError() {
    return { comErro: true }
  }

  componentDidCatch(erro, info) {
    console.error('Erro capturado pelo LimiteDeErro:', erro, info)
  }

  render() {
    if (this.state.comErro) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0F172A',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 32, marginBottom: 12 }}>😕</p>
          <p style={{ fontSize: 16, marginBottom: 8 }}>Algo deu errado.</p>
          <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>
            Seus dados não foram perdidos. Tente recarregar o app.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#6366F1',
              border: 'none',
              color: '#fff',
              borderRadius: 10,
              padding: '12px 24px',
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LimiteDeErro>
      <App />
    </LimiteDeErro>
  </React.StrictMode>
)

// Registra o service worker (necessário pra instalar o app na tela inicial)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
