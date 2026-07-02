import { useState, useEffect } from 'react'

// ---------- Funções auxiliares ----------

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

// ---------- Persistência (localStorage) ----------

function carregarTransacoes() {
  try {
    const dados = localStorage.getItem('transacoes')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarTransacoes(transacoes) {
  localStorage.setItem('transacoes', JSON.stringify(transacoes))
}

// ---------- Componente: Dashboard ----------

function Dashboard({ transacoes }) {
  const doMes = transacoes.filter((t) => t.data.startsWith(mesAtual()))

  const receitas = doMes
    .filter((t) => t.tipo === 'receita')
    .reduce((soma, t) => soma + t.valor, 0)

  const despesas = doMes
    .filter((t) => t.tipo === 'despesa')
    .reduce((soma, t) => soma + t.valor, 0)

  const saldo = receitas - despesas

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 20, color: '#fff' }}>
        Olá! 👋
      </h1>

      {/* Card de saldo */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <p style={{ color: '#E0E7FF', fontSize: 13, marginBottom: 4 }}>
          Saldo disponível este mês
        </p>
        <p style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>
          {formatarMoeda(saldo)}
        </p>
      </div>

      {/* Cards de receitas e despesas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            background: '#1E293B',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>
            Receitas
          </p>
          <p style={{ color: '#22C55E', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(receitas)}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            background: '#1E293B',
            borderRadius: 14,
            padding: 16,
          }}
        >
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>
            Despesas
          </p>
          <p style={{ color: '#EF4444', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(despesas)}
          </p>
        </div>
      </div>

      {/* Últimas transações */}
      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
        Últimas transações
      </p>
      {doMes.length === 0 && (
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Nenhuma transação este mês ainda.
        </p>
      )}
      {[...doMes]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10)
        .map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: '#1E293B',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 8,
            }}
          >
            <div>
              <p style={{ color: '#fff', fontSize: 14 }}>{t.descricao}</p>
              <p style={{ color: '#64748B', fontSize: 12 }}>{t.data}</p>
            </div>
            <p
              style={{
                color: t.tipo === 'receita' ? '#22C55E' : '#EF4444',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t.tipo === 'receita' ? '+' : '-'} {formatarMoeda(t.valor)}
            </p>
          </div>
        ))}
    </div>
  )
}

// ---------- Componente: Adicionar ----------

function Adicionar({ onAdicionar }) {
  const [tipo, setTipo] = useState('despesa')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  function handleSalvar() {
    if (!descricao.trim() || !valor || Number(valor) <= 0) {
      alert('Preencha a descrição e um valor válido.')
      return
    }
    onAdicionar({
      id: Date.now(),
      tipo,
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
    })
    setDescricao('')
    setValor('')
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0F172A',
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 20, color: '#fff' }}>
        Nova transação
      </h1>

      {/* Alternador Receita / Despesa */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTipo('despesa')}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: tipo === 'despesa' ? '#EF4444' : '#1E293B',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Despesa
        </button>
        <button
          onClick={() => setTipo('receita')}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: tipo === 'receita' ? '#22C55E' : '#1E293B',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Receita
        </button>
      </div>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Descrição</label>
      <input
        style={inputStyle}
        placeholder="Ex: Mercado, Salário..."
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Valor (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Data</label>
      <input
        style={inputStyle}
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <button
        onClick={handleSalvar}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 10,
          border: 'none',
          background: '#6366F1',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          marginTop: 8,
        }}
      >
        Salvar
      </button>
    </div>
  )
}

// ---------- Componente: Navegação inferior ----------

function BottomNav({ abaAtiva, onMudarAba }) {
  const abas = [
    { id: 'dashboard', label: 'Início', icone: '🏠' },
    { id: 'adicionar', label: 'Adicionar', icone: '➕' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        background: '#1E293B',
        borderTop: '1px solid #334155',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
    >
      {abas.map((aba) => (
        <button
          key={aba.id}
          onClick={() => onMudarAba(aba.id)}
          style={{
            flex: 1,
            padding: '12px 0',
            border: 'none',
            background: 'transparent',
            color: abaAtiva === aba.id ? '#6366F1' : '#94A3B8',
          }}
        >
          <div style={{ fontSize: 20 }}>{aba.icone}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{aba.label}</div>
        </button>
      ))}
    </div>
  )
}

// ---------- App principal ----------

export default function App() {
  const [transacoes, setTransacoes] = useState(carregarTransacoes)
  const [abaAtiva, setAbaAtiva] = useState('dashboard')

  // Salva automaticamente sempre que as transações mudarem
  useEffect(() => {
    salvarTransacoes(transacoes)
  }, [transacoes])

  function handleAdicionar(novaTransacao) {
    setTransacoes((atual) => [...atual, novaTransacao])
    setAbaAtiva('dashboard')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: 70,
      }}
    >
      {abaAtiva === 'dashboard' && <Dashboard transacoes={transacoes} />}
      {abaAtiva === 'adicionar' && <Adicionar onAdicionar={handleAdicionar} />}

      <BottomNav abaAtiva={abaAtiva} onMudarAba={setAbaAtiva} />
    </div>
  )
}

