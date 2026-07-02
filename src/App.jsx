import { useState, useEffect } from 'react'

// ---------- Categorias ----------

const CATEGORIAS_DESPESA = [
  { id: 'mercado', label: 'Mercado', icone: '🛒' },
  { id: 'transporte', label: 'Transporte', icone: '🚗' },
  { id: 'lazer', label: 'Lazer', icone: '🎉' },
  { id: 'saude', label: 'Saúde', icone: '💊' },
  { id: 'educacao', label: 'Educação', icone: '📚' },
  { id: 'casa', label: 'Casa', icone: '🏠' },
  { id: 'assinaturas', label: 'Assinaturas', icone: '📺' },
  { id: 'filhos', label: 'Filhos', icone: '🧸' },
  { id: 'outros', label: 'Outros', icone: '📦' },
]

const CATEGORIAS_RECEITA = [
  { id: 'salario', label: 'Salário', icone: '💼' },
  { id: 'freela', label: 'Freelance', icone: '💻' },
  { id: 'pix', label: 'Pix recebido', icone: '📲' },
  { id: 'rendimento', label: 'Rendimento', icone: '📈' },
  { id: 'outros', label: 'Outros', icone: '📦' },
]

function categoriasPara(tipo) {
  return tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
}

function infoCategoria(tipo, categoriaId) {
  const lista = categoriasPara(tipo)
  return lista.find((c) => c.id === categoriaId) || lista[lista.length - 1]
}

// ---------- Funções auxiliares ----------

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function formatarDataCurta(dataStr) {
  const [ano, mes, dia] = dataStr.split('-')
  return `${dia}/${mes}`
}

// ---------- Persistência (localStorage) ----------

function carregarTransacoes() {
  try {
    const dados = localStorage.getItem('transacoes')
    if (!dados) return []
    const lista = JSON.parse(dados)
    return lista.map((t) => ({
      categoria: 'outros',
      fixa: false,
      ...t,
    }))
  } catch {
    return []
  }
}

function salvarTransacoes(transacoes) {
  localStorage.setItem('transacoes', JSON.stringify(transacoes))
}

// ---------- Projeção de despesas fixas para o calendário ----------

function obterDespesasFixasUnicas(transacoes) {
  const fixas = transacoes.filter((t) => t.tipo === 'despesa' && t.fixa)
  const mapa = {}
  fixas.forEach((t) => {
    const chave = `${t.descricao.trim().toLowerCase()}|${t.categoria}`
    if (!mapa[chave] || new Date(t.data) > new Date(mapa[chave].data)) {
      mapa[chave] = t
    }
  })
  return Object.values(mapa)
}

function projetarParaMes(despesasFixasUnicas, ano, mes) {
  const ultimoDiaMes = new Date(ano, mes, 0).getDate()
  return despesasFixasUnicas.map((t) => {
    const diaOriginal = Number(t.data.split('-')[2])
    const diaAjustado = Math.min(diaOriginal, ultimoDiaMes)
    const dataProjetada = `${ano}-${String(mes).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`
    return {
      ...t,
      data: dataProjetada,
      projetada: true,
      id: `proj-${t.categoria}-${t.descricao}-${dataProjetada}`,
    }
  })
}

function itensDoMesComProjecao(transacoes, ano, mes) {
  const chaveMes = `${ano}-${String(mes).padStart(2, '0')}`
  const reais = transacoes.filter((t) => t.data.startsWith(chaveMes))

  const fixasUnicas = obterDespesasFixasUnicas(transacoes)
  const projecoes = projetarParaMes(fixasUnicas, ano, mes).filter((p) => {
    const jaExiste = reais.some(
      (t) =>
        t.tipo === 'despesa' &&
        t.fixa &&
        t.descricao.trim().toLowerCase() === p.descricao.trim().toLowerCase() &&
        t.categoria === p.categoria
    )
    return !jaExiste
  })

  return [...reais, ...projecoes]
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

  const despesasFixas = doMes
    .filter((t) => t.tipo === 'despesa' && t.fixa)
    .reduce((soma, t) => soma + t.valor, 0)

  const saldo = receitas - despesas

  const porCategoria = {}
  doMes
    .filter((t) => t.tipo === 'despesa')
    .forEach((t) => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor
    })
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 20, color: '#fff' }}>Olá! 👋</h1>

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

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 14, padding: 16 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Receitas</p>
          <p style={{ color: '#22C55E', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(receitas)}
          </p>
        </div>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 14, padding: 16 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Despesas</p>
          <p style={{ color: '#EF4444', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(despesas)}
          </p>
        </div>
      </div>

      {despesasFixas > 0 && (
        <div
          style={{
            background: '#1E293B',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p style={{ color: '#94A3B8', fontSize: 12 }}>📌 Despesas fixas do mês</p>
            <p style={{ color: '#F59E0B', fontSize: 16, fontWeight: 600 }}>
              {formatarMoeda(despesasFixas)}
            </p>
          </div>
          <p style={{ color: '#64748B', fontSize: 12 }}>
            {Math.round((despesasFixas / (despesas || 1)) * 100)}% dos gastos
          </p>
        </div>
      )}

      {categoriasOrdenadas.length > 0 && (
        <>
          <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
            Gastos por categoria
          </p>
          <div style={{ marginBottom: 16 }}>
            {categoriasOrdenadas.map(([catId, valor]) => {
              const cat = infoCategoria('despesa', catId)
              const percentual = despesas > 0 ? (valor / despesas) * 100 : 0
              return (
                <div key={catId} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontSize: 13 }}>
                      {cat.icone} {cat.label}
                    </span>
                    <span style={{ color: '#94A3B8', fontSize: 13 }}>
                      {formatarMoeda(valor)}
                    </span>
                  </div>
                  <div style={{ background: '#1E293B', borderRadius: 6, height: 6 }}>
                    <div
                      style={{
                        width: `${percentual}%`,
                        background: '#6366F1',
                        height: 6,
                        borderRadius: 6,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

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
        .map((t) => {
          const cat = infoCategoria(t.tipo, t.categoria)
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1E293B',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{cat.icone}</span>
                <div>
                  <p style={{ color: '#fff', fontSize: 14 }}>
                    {t.descricao} {t.fixa && <span style={{ color: '#F59E0B' }}>📌</span>}
                  </p>
                  <p style={{ color: '#64748B', fontSize: 12 }}>
                    {cat.label} · {t.data}
                  </p>
                </div>
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
          )
        })}
    </div>
  )
}

// ---------- Componente: Adicionar ----------

function Adicionar({ onAdicionar }) {
  const [tipo, setTipo] = useState('despesa')
  const [categoria, setCategoria] = useState(CATEGORIAS_DESPESA[0].id)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [fixa, setFixa] = useState(false)

  function handleMudarTipo(novoTipo) {
    setTipo(novoTipo)
    setCategoria(categoriasPara(novoTipo)[0].id)
    if (novoTipo === 'receita') setFixa(false)
  }

  function handleSalvar() {
    if (!descricao.trim() || !valor || Number(valor) <= 0) {
      alert('Preencha a descrição e um valor válido.')
      return
    }
    onAdicionar({
      id: Date.now(),
      tipo,
      categoria,
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
      fixa: tipo === 'despesa' ? fixa : false,
    })
    setDescricao('')
    setValor('')
    setFixa(false)
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
      <h1 style={{ fontSize: 20, marginBottom: 20, color: '#fff' }}>Nova transação</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => handleMudarTipo('despesa')}
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
          onClick={() => handleMudarTipo('receita')}
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

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Categoria</label>
      <select style={inputStyle} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {categoriasPara(tipo).map((c) => (
          <option key={c.id} value={c.id}>
            {c.icone} {c.label}
          </option>
        ))}
      </select>

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
      <input style={inputStyle} type="date" value={data} onChange={(e) => setData(e.target.value)} />

      {tipo === 'despesa' && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#fff',
            fontSize: 14,
            marginBottom: 16,
            background: '#1E293B',
            padding: '12px 14px',
            borderRadius: 10,
          }}
        >
          <input
            type="checkbox"
            checked={fixa}
            onChange={(e) => setFixa(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          📌 Essa despesa se repete todo mês (fixa)
        </label>
      )}

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

// ---------- Componente: Calendário ----------

function Calendario({ transacoes }) {
  const hoje = new Date()
  const [visualizado, setVisualizado] = useState({
    ano: hoje.getFullYear(),
    mes: hoje.getMonth() + 1,
  })
  const [diaSelecionado, setDiaSelecionado] = useState(null)

  const hojeStr = hoje.toISOString().slice(0, 10)
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  const diasSemana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  const itens = itensDoMesComProjecao(transacoes, visualizado.ano, visualizado.mes)

  const porDia = {}
  itens.forEach((t) => {
    porDia[t.data] = porDia[t.data] || []
    porDia[t.data].push(t)
  })

  const diasNoMes = new Date(visualizado.ano, visualizado.mes, 0).getDate()
  const primeiroDiaSemana = new Date(visualizado.ano, visualizado.mes - 1, 1).getDay()

  function mudarMes(delta) {
    let novoMes = visualizado.mes + delta
    let novoAno = visualizado.ano
    if (novoMes > 12) { novoMes = 1; novoAno += 1 }
    if (novoMes < 1) { novoMes = 12; novoAno -= 1 }
    setVisualizado({ ano: novoAno, mes: novoMes })
    setDiaSelecionado(null)
  }

  const itensProximoMes = itensDoMesComProjecao(
    transacoes,
    visualizado.mes === 12 ? visualizado.ano + 1 : visualizado.ano,
    visualizado.mes === 12 ? 1 : visualizado.mes + 1
  )
  const proximosVencimentos = [...itens, ...itensProximoMes]
    .filter((t) => t.tipo === 'despesa' && t.data >= hojeStr)
    .sort((a, b) => new Date(a.data) - new Date(b.data))
    .slice(0, 5)

  const celulas = []
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null)
  for (let dia = 1; dia <= diasNoMes; dia++) celulas.push(dia)

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 20, marginBottom: 20, color: '#fff' }}>Calendário</h1>

      {proximosVencimentos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
            Próximos vencimentos
          </p>
          {proximosVencimentos.map((t) => {
            const cat = infoCategoria('despesa', t.categoria)
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1E293B',
                  borderRadius: 12,
                  padding: '10px 14px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{cat.icone}</span>
                  <div>
                    <p style={{ color: '#fff', fontSize: 13 }}>
                      {t.descricao} {t.projetada && <span style={{ color: '#64748B' }}>(previsto)</span>}
                    </p>
                    <p style={{ color: '#64748B', fontSize: 11 }}>{formatarDataCurta(t.data)}</p>
                  </div>
                </div>
                <p style={{ color: '#F59E0B', fontSize: 13, fontWeight: 600 }}>
                  {formatarMoeda(t.valor)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={() => mudarMes(-1)}
          style={{ background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 16 }}
        >
          ‹
        </button>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
          {nomesMeses[visualizado.mes - 1]} {visualizado.ano}
        </p>
        <button
          onClick={() => mudarMes(1)}
          style={{ background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 16 }}
        >
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
        {diasSemana.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', color: '#64748B', fontSize: 11 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const dataStr = `${visualizado.ano}-${String(visualizado.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const itensDoDia = porDia[dataStr] || []
          const temReceita = itensDoDia.some((t) => t.tipo === 'receita')
          const temDespesaReal = itensDoDia.some((t) => t.tipo === 'despesa' && !t.projetada)
          const temDespesaPrevista = itensDoDia.some((t) => t.tipo === 'despesa' && t.projetada)
          const ehHoje = dataStr === hojeStr
          const selecionado = dataStr === diaSelecionado

          return (
            <button
              key={i}
              onClick={() => setDiaSelecionado(selecionado ? null : dataStr)}
              style={{
                aspectRatio: '1',
                background: selecionado ? '#6366F1' : '#1E293B',
                border: ehHoje ? '1px solid #6366F1' : 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                position: 'relative',
                padding: 0,
              }}
            >
              {dia}
              <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 2 }}>
                {temReceita && <span style={{ width: 4, height: 4, borderRadius: 4, background: '#22C55E' }} />}
                {temDespesaReal && <span style={{ width: 4, height: 4, borderRadius: 4, background: '#EF4444' }} />}
                {temDespesaPrevista && <span style={{ width: 4, height: 4, borderRadius: 4, border: '1px solid #F59E0B' }} />}
              </div>
            </button>
          )
        })}
      </div>

      {diaSelecionado && (
        <div>
          <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
            {formatarDataCurta(diaSelecionado)}
          </p>
          {(porDia[diaSelecionado] || []).length === 0 && (
            <p style={{ color: '#64748B', fontSize: 14 }}>Nada nesse dia.</p>
          )}
          {(porDia[diaSelecionado] || []).map((t) => {
            const cat = infoCategoria(t.tipo, t.categoria)
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1E293B',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{cat.icone}</span>
                  <p style={{ color: '#fff', fontSize: 14 }}>
                    {t.descricao} {t.projetada && <span style={{ color: '#64748B', fontSize: 12 }}>(previsto)</span>}
                  </p>
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
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Componente: Navegação inferior ----------

function BottomNav({ abaAtiva, onMudarAba }) {
  const abas = [
    { id: 'dashboard', label: 'Início', icone: '🏠' },
    { id: 'calendario', label: 'Calendário', icone: '📅' },
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
      {abaAtiva === 'calendario' && <Calendario transacoes={transacoes} />}
      {abaAtiva === 'adicionar' && <Adicionar onAdicionar={handleAdicionar} />}

      <BottomNav abaAtiva={abaAtiva} onMudarAba={setAbaAtiva} />
    </div>
  )
}
