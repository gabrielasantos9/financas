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

// Cores de gradiente por banco (reconhece o nome digitado no cadastro do cartão,
// ignorando maiúsculas/minúsculas, acentos e texto extra como "Cartão Nubank")
function corDoBanco(banco) {
  const nome = (banco || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
    .toLowerCase()

  const regras = [
    ['nubank', ['#8A05BE', '#A020D0']],
    ['inter', ['#FF7A00', '#FFA940']],
    ['itau', ['#EC7000', '#FF9900']],
    ['bradesco', ['#CC092F', '#E4002B']],
    ['santander', ['#EC0000', '#FF3333']],
    ['caixa', ['#0066B3', '#0086D6']],
    ['banco do brasil', ['#F8D117', '#FBE84D']],
    ['bb', ['#F8D117', '#FBE84D']],
    ['c6', ['#1A1A1A', '#3D3D3D']],
    ['picpay', ['#21C25E', '#00A868']],
    ['next', ['#00FF5F', '#00CC4C']],
    ['original', ['#1DB67B', '#00A15D']],
    ['will', ['#FF5A00', '#FF8800']],
    ['xp', ['#000000', '#333333']],
    ['neon', ['#00E3A5', '#00BD8A']],
  ]

  for (const [chave, cores] of regras) {
    if (nome.includes(chave)) return cores
  }
  return ['#4F46E5', '#6366F1']
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

// Pega, de cada despesa fixa (por descrição+categoria), o registro mais recente
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

// Projeta as despesas fixas para um mês específico (ano, mes 1-indexado)
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

// Combina transações reais de um mês com as projeções (sem duplicar)
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

// ---------- Persistência: Cartões e Compras ----------

function carregarCartoes() {
  try {
    const dados = localStorage.getItem('cartoes')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarCartoes(cartoes) {
  localStorage.setItem('cartoes', JSON.stringify(cartoes))
}

function carregarCompras() {
  try {
    const dados = localStorage.getItem('compras')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarCompras(compras) {
  localStorage.setItem('compras', JSON.stringify(compras))
}

// Calcula em qual fatura (mês) cada parcela de uma compra cai
function calcularParcelas(compra, cartao) {
  const [ano, mes, dia] = compra.data.split('-').map(Number)
  let anoFatura = ano
  let mesFatura = mes
  if (dia > cartao.diaFechamento) {
    mesFatura += 1
    if (mesFatura > 12) {
      mesFatura = 1
      anoFatura += 1
    }
  }
  const valorParcela = Math.round((compra.valorTotal / compra.parcelas) * 100) / 100
  const parcelas = []
  for (let i = 0; i < compra.parcelas; i++) {
    let m = mesFatura + i
    let a = anoFatura
    while (m > 12) {
      m -= 12
      a += 1
    }
    parcelas.push({
      chaveMes: `${a}-${String(m).padStart(2, '0')}`,
      numero: i + 1,
      total: compra.parcelas,
      valor: valorParcela,
      compraId: compra.id,
      descricao: compra.descricao,
      categoria: compra.categoria,
    })
  }
  return parcelas
}

// Retorna todas as parcelas de todas as compras de um cartão específico
function parcelasDoCartao(compras, cartao) {
  return compras
    .filter((c) => c.cartaoId === cartao.id)
    .flatMap((c) => calcularParcelas(c, cartao))
}

// ---------- Persistência: Metas ----------

function carregarMetas() {
  try {
    const dados = localStorage.getItem('metas')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarMetas(metas) {
  localStorage.setItem('metas', JSON.stringify(metas))
}

// ---------- Persistência: Reserva de emergência ----------

function carregarReserva() {
  try {
    const dados = localStorage.getItem('reserva')
    return dados ? JSON.parse(dados) : null
  } catch {
    return null
  }
}

function salvarReserva(reserva) {
  if (reserva === null) {
    localStorage.removeItem('reserva')
  } else {
    localStorage.setItem('reserva', JSON.stringify(reserva))
  }
}

// Média de despesas dos últimos meses com dados (até 3 meses), usada pra sugerir a meta da reserva
function calcularMediaDespesasMensais(transacoes) {
  const despesas = transacoes.filter((t) => t.tipo === 'despesa')
  const porMes = {}
  despesas.forEach((t) => {
    const chave = t.data.slice(0, 7)
    porMes[chave] = (porMes[chave] || 0) + t.valor
  })
  const chaves = Object.keys(porMes).sort()
  const ultimasChaves = chaves.slice(-3)
  if (ultimasChaves.length === 0) return 0
  const soma = ultimasChaves.reduce((s, k) => s + porMes[k], 0)
  return soma / ultimasChaves.length
}

// ---------- Persistência: Planejamento ----------

function carregarPlanejamentos() {
  try {
    const dados = localStorage.getItem('planejamentos')
    return dados ? JSON.parse(dados) : {}
  } catch {
    return {}
  }
}

function salvarPlanejamentos(planejamentos) {
  localStorage.setItem('planejamentos', JSON.stringify(planejamentos))
}

function carregarItensAnuais() {
  try {
    const dados = localStorage.getItem('itensAnuais')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarItensAnuais(itens) {
  localStorage.setItem('itensAnuais', JSON.stringify(itens))
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Gera o resumo dos últimos N meses (receitas, despesas, saldo do mês e saldo acumulado)
function calcularResumoMensal(transacoes, quantidadeMeses) {
  const hoje = new Date()
  const chaves = []
  for (let i = quantidadeMeses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    chaves.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const hojeStr = hoje.toISOString().slice(0, 10)
  let acumulado = transacoes
    .filter((t) => t.data < `${chaves[0]}-01`)
    .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0)

  return chaves.map((chave) => {
    const doMes = transacoes.filter((t) => t.data.startsWith(chave))
    const receitas = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
    const despesas = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)
    acumulado += receitas - despesas
    return { chave, receitas, despesas, saldo: receitas - despesas, acumulado }
  })
}

// ---------- Persistência: Filhos ----------

function carregarFilhos() {
  try {
    const dados = localStorage.getItem('filhos')
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarFilhos(filhos) {
  localStorage.setItem('filhos', JSON.stringify(filhos))
}

// Monta um resumo financeiro compacto pra enviar à IA (não envia a lista completa de transações)
function construirContextoIA(transacoes, metas, reserva, cartoes) {
  const hojeStr = new Date().toISOString().slice(0, 10)
  const chaveMes = mesAtual()
  const doMes = transacoes.filter((t) => t.data.startsWith(chaveMes))

  const receitasMes = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const despesasMes = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)
  const saldoTotal = transacoes
    .filter((t) => t.data <= hojeStr)
    .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0)

  const porCategoria = {}
  doMes
    .filter((t) => t.tipo === 'despesa')
    .forEach((t) => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor
    })

  return {
    saldoTotalHoje: Number(saldoTotal.toFixed(2)),
    receitasEsteMes: Number(receitasMes.toFixed(2)),
    despesasEsteMes: Number(despesasMes.toFixed(2)),
    gastosPorCategoriaEsteMes: porCategoria,
    metas: metas.map((m) => ({ nome: m.nome, jaGuardado: m.valorAtual, alvo: m.valorAlvo })),
    reservaDeEmergencia: reserva
      ? { jaGuardado: reserva.valorAtual, mesesDesejados: reserva.mesesDesejados }
      : null,
    quantidadeDeCartoes: cartoes.length,
  }
}

// ---------- Componente: Dashboard ----------

function Dashboard({ transacoes, onEditar, onExcluir, onAbrirPlanejamento, onAbrirRelatorios, onAbrirFilhos, onAbrirAssistente }) {
  const hojeStr = new Date().toISOString().slice(0, 10)
  const doMes = transacoes.filter((t) => t.data.startsWith(mesAtual()))

  const receitasMes = doMes
    .filter((t) => t.tipo === 'receita')
    .reduce((soma, t) => soma + t.valor, 0)

  const despesasMes = doMes
    .filter((t) => t.tipo === 'despesa')
    .reduce((soma, t) => soma + t.valor, 0)

  const despesasFixas = doMes
    .filter((t) => t.tipo === 'despesa' && t.fixa)
    .reduce((soma, t) => soma + t.valor, 0)

  const saldoMes = receitasMes - despesasMes

  // Saldo total: soma de tudo que já aconteceu até hoje, não só o mês atual.
  // Isso evita que o salário recebido no fim do mês passado "suma" da conta.
  const saldoAcumulado = transacoes
    .filter((t) => t.data <= hojeStr)
    .reduce((soma, t) => soma + (t.tipo === 'receita' ? t.valor : -t.valor), 0)

  const porCategoria = {}
  doMes
    .filter((t) => t.tipo === 'despesa')
    .forEach((t) => {
      porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor
    })
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, color: '#fff', marginBottom: 10 }}>Olá! 👋</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={onAbrirPlanejamento}
            style={{ flex: 1, background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          >
            📋 Planejamento
          </button>
          <button
            onClick={onAbrirRelatorios}
            style={{ flex: 1, background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          >
            📊 Relatórios
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onAbrirFilhos}
            style={{ flex: 1, background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          >
            👶 Filhos
          </button>
          <button
            onClick={onAbrirAssistente}
            style={{ flex: 1, background: '#1E293B', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          >
            🤖 Assistente IA
          </button>
        </div>
      </div>

      <div
        style={{
          background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <p style={{ color: '#E0E7FF', fontSize: 13, marginBottom: 4 }}>
          Saldo total
        </p>
        <p style={{ color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          {formatarMoeda(saldoAcumulado)}
        </p>
        <p style={{ color: '#E0E7FF', fontSize: 12 }}>
          Este mês: {saldoMes >= 0 ? '+' : ''}
          {formatarMoeda(saldoMes)}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 14, padding: 16 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Receitas do mês</p>
          <p style={{ color: '#22C55E', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(receitasMes)}
          </p>
        </div>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 14, padding: 16 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Despesas do mês</p>
          <p style={{ color: '#EF4444', fontSize: 18, fontWeight: 600 }}>
            {formatarMoeda(despesasMes)}
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
            {Math.round((despesasFixas / (despesasMes || 1)) * 100)}% dos gastos
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
              const percentual = despesasMes > 0 ? (valor / despesasMes) * 100 : 0
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <p
                  style={{
                    color: t.tipo === 'receita' ? '#22C55E' : '#EF4444',
                    fontSize: 14,
                    fontWeight: 600,
                    marginRight: 4,
                  }}
                >
                  {t.tipo === 'receita' ? '+' : '-'} {formatarMoeda(t.valor)}
                </p>
                <button
                  onClick={() => onEditar(t)}
                  aria-label="Editar"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 15,
                    padding: 6,
                    cursor: 'pointer',
                  }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => onExcluir(t.id)}
                  aria-label="Excluir"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 15,
                    padding: 6,
                    cursor: 'pointer',
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}
    </div>
  )
}

// ---------- Componente: Adicionar ----------

function Adicionar({ onAdicionar, onEditar, onCancelarEdicao, transacaoInicial, filhos }) {
  const [tipo, setTipo] = useState(transacaoInicial?.tipo || 'despesa')
  const [categoria, setCategoria] = useState(transacaoInicial?.categoria || CATEGORIAS_DESPESA[0].id)
  const [descricao, setDescricao] = useState(transacaoInicial?.descricao || '')
  const [valor, setValor] = useState(transacaoInicial ? String(transacaoInicial.valor) : '')
  const [data, setData] = useState(transacaoInicial?.data || new Date().toISOString().slice(0, 10))
  const [fixa, setFixa] = useState(transacaoInicial?.fixa || false)
  const [filhoId, setFilhoId] = useState(transacaoInicial?.filhoId || '')

  const emEdicao = Boolean(transacaoInicial)

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
    const dadosTransacao = {
      id: emEdicao ? transacaoInicial.id : Date.now(),
      tipo,
      categoria,
      descricao: descricao.trim(),
      valor: Number(valor),
      data,
      fixa: tipo === 'despesa' ? fixa : false,
      filhoId: tipo === 'despesa' && categoria === 'filhos' && filhoId ? filhoId : null,
    }
    if (emEdicao) {
      onEditar(dadosTransacao)
    } else {
      onAdicionar(dadosTransacao)
      setDescricao('')
      setValor('')
      setFixa(false)
      setFilhoId('')
    }
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
        {emEdicao ? 'Editar transação' : 'Nova transação'}
      </h1>

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

      {tipo === 'despesa' && categoria === 'filhos' && filhos && filhos.length > 0 && (
        <>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>Qual filho?</label>
          <select style={inputStyle} value={filhoId} onChange={(e) => setFilhoId(e.target.value)}>
            <option value="">Não especificar</option>
            {filhos.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icone} {f.nome}
              </option>
            ))}
          </select>
        </>
      )}

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
        {emEdicao ? 'Salvar alterações' : 'Salvar'}
      </button>

      {emEdicao && (
        <button
          onClick={onCancelarEdicao}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#94A3B8',
            fontSize: 14,
            marginTop: 8,
          }}
        >
          Cancelar edição
        </button>
      )}
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

  // Próximos vencimentos: junta mês atual + próximo, filtra a partir de hoje
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

// ---------- Componente: Formulário Novo Cartão ----------

function FormNovoCartao({ onSalvar, onCancelar, cartaoInicial }) {
  const [nome, setNome] = useState(cartaoInicial?.nome || '')
  const [banco, setBanco] = useState(cartaoInicial?.banco || '')
  const [limite, setLimite] = useState(cartaoInicial ? String(cartaoInicial.limite) : '')
  const [diaFechamento, setDiaFechamento] = useState(cartaoInicial ? String(cartaoInicial.diaFechamento) : '')
  const [diaVencimento, setDiaVencimento] = useState(cartaoInicial ? String(cartaoInicial.diaVencimento) : '')

  const emEdicao = Boolean(cartaoInicial)

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

  function handleSalvar() {
    if (!nome.trim() || !limite || !diaFechamento || !diaVencimento) {
      alert('Preencha nome, limite, dia de fechamento e vencimento.')
      return
    }
    const fechamento = Number(diaFechamento)
    const vencimento = Number(diaVencimento)
    if (fechamento < 1 || fechamento > 31 || vencimento < 1 || vencimento > 31) {
      alert('Os dias devem estar entre 1 e 31.')
      return
    }
    onSalvar({
      id: emEdicao ? cartaoInicial.id : Date.now(),
      nome: nome.trim(),
      banco: banco.trim(),
      limite: Number(limite),
      diaFechamento: fechamento,
      diaVencimento: vencimento,
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar cartão' : 'Novo cartão'}
      </p>
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Nome do cartão</label>
      <input
        style={inputStyle}
        placeholder="Ex: Nubank, Inter..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Banco (opcional)</label>
      <input
        style={inputStyle}
        placeholder="Ex: Nubank"
        value={banco}
        onChange={(e) => setBanco(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Limite total (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={limite}
        onChange={(e) => setLimite(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>Dia fechamento</label>
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            placeholder="Ex: 20"
            value={diaFechamento}
            onChange={(e) => setDiaFechamento(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>Dia vencimento</label>
          <input
            style={inputStyle}
            type="number"
            inputMode="numeric"
            placeholder="Ex: 27"
            value={diaVencimento}
            onChange={(e) => setDiaVencimento(e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          {emEdicao ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Formulário Nova Compra no Cartão ----------

function FormNovaCompra({ onSalvar, onCancelar, compraInicial }) {
  const [descricao, setDescricao] = useState(compraInicial?.descricao || '')
  const [categoria, setCategoria] = useState(compraInicial?.categoria || CATEGORIAS_DESPESA[0].id)
  const [valorTotal, setValorTotal] = useState(compraInicial ? String(compraInicial.valorTotal) : '')
  const [parcelas, setParcelas] = useState(compraInicial ? String(compraInicial.parcelas) : '1')
  const [data, setData] = useState(compraInicial?.data || new Date().toISOString().slice(0, 10))

  const emEdicao = Boolean(compraInicial)

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

  function handleSalvar() {
    if (!descricao.trim() || !valorTotal || Number(valorTotal) <= 0 || !parcelas || Number(parcelas) < 1) {
      alert('Preencha a descrição, o valor total e o número de parcelas.')
      return
    }
    onSalvar({
      id: emEdicao ? compraInicial.id : Date.now(),
      descricao: descricao.trim(),
      categoria,
      valorTotal: Number(valorTotal),
      parcelas: Number(parcelas),
      data,
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar compra' : 'Nova compra'}
      </p>
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Descrição</label>
      <input
        style={inputStyle}
        placeholder="Ex: Tênis, Presente..."
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Categoria</label>
      <select style={inputStyle} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {CATEGORIAS_DESPESA.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icone} {c.label}
          </option>
        ))}
      </select>
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Valor total (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valorTotal}
        onChange={(e) => setValorTotal(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Número de parcelas</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="numeric"
        min="1"
        value={parcelas}
        onChange={(e) => setParcelas(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Data da compra</label>
      <input style={inputStyle} type="date" value={data} onChange={(e) => setData(e.target.value)} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          {emEdicao ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Cartões ----------

function Cartoes({ cartoes, compras, onAdicionarCartao, onEditarCartao, onExcluirCartao, onAdicionarCompra, onEditarCompra, onExcluirCompra }) {
  const [modoFormCartao, setModoFormCartao] = useState(null) // null | 'novo' | cartaoObjeto
  const [cartaoExpandido, setCartaoExpandido] = useState(null)
  const [modoFormCompra, setModoFormCompra] = useState(null) // null | { cartaoId, compra? }

  const chaveMesAtual = mesAtual()

  function chaveProximoMes(chave) {
    const [ano, mes] = chave.split('-').map(Number)
    const proximoMes = mes === 12 ? 1 : mes + 1
    const proximoAno = mes === 12 ? ano + 1 : ano
    return `${proximoAno}-${String(proximoMes).padStart(2, '0')}`
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, color: '#fff' }}>Cartões</h1>
        {!modoFormCartao && (
          <button
            onClick={() => setModoFormCartao('novo')}
            style={{ background: '#6366F1', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            + Cartão
          </button>
        )}
      </div>

      {modoFormCartao === 'novo' && (
        <FormNovoCartao
          onSalvar={(cartao) => {
            onAdicionarCartao(cartao)
            setModoFormCartao(null)
          }}
          onCancelar={() => setModoFormCartao(null)}
        />
      )}

      {modoFormCartao && modoFormCartao !== 'novo' && (
        <FormNovoCartao
          cartaoInicial={modoFormCartao}
          onSalvar={(cartao) => {
            onEditarCartao(cartao)
            setModoFormCartao(null)
          }}
          onCancelar={() => setModoFormCartao(null)}
        />
      )}

      {cartoes.length === 0 && !modoFormCartao && (
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Nenhum cartão cadastrado ainda. Toque em "+ Cartão" pra começar.
        </p>
      )}

      {cartoes.map((cartao) => {
        const comprasDoCartao = compras.filter((c) => c.cartaoId === cartao.id)
        const todasParcelas = parcelasDoCartao(compras, cartao)
        const faturaAtual = todasParcelas
          .filter((p) => p.chaveMes === chaveMesAtual)
          .reduce((soma, p) => soma + p.valor, 0)
        const proximaFatura = todasParcelas
          .filter((p) => p.chaveMes === chaveProximoMes(chaveMesAtual))
          .reduce((soma, p) => soma + p.valor, 0)
        const emAberto = todasParcelas
          .filter((p) => p.chaveMes >= chaveMesAtual)
          .reduce((soma, p) => soma + p.valor, 0)
        const disponivel = cartao.limite - emAberto
        const expandido = cartaoExpandido === cartao.id
        const formCompraAberto = modoFormCompra && modoFormCompra.cartaoId === cartao.id

        return (
          <div key={cartao.id} style={{ marginBottom: 16 }}>
            <div
              style={{
                background: `linear-gradient(135deg, ${corDoBanco(cartao.banco)[0]}, ${corDoBanco(cartao.banco)[1]})`,
                borderRadius: 16,
                padding: 18,
              }}
            >
              <button
                onClick={() => setCartaoExpandido(expandido ? null : cartao.id)}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{cartao.nome}</p>
                  <p style={{ color: '#E0E7FF', fontSize: 12 }}>vence dia {cartao.diaVencimento}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: '#E0E7FF', fontSize: 11 }}>Fatura atual</p>
                    <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{formatarMoeda(faturaAtual)}</p>
                  </div>
                  <div>
                    <p style={{ color: '#E0E7FF', fontSize: 11 }}>Disponível</p>
                    <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{formatarMoeda(disponivel)}</p>
                  </div>
                </div>
              </button>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                <button
                  onClick={() => setModoFormCartao(cartao)}
                  aria-label="Editar cartão"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir o cartão "${cartao.nome}" e todas as suas compras?`)) {
                      onExcluirCartao(cartao.id)
                    }
                  }}
                  aria-label="Excluir cartão"
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                >
                  🗑️
                </button>
              </div>
            </div>

            {expandido && (
              <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>
                    Próxima fatura: <span style={{ color: '#fff' }}>{formatarMoeda(proximaFatura)}</span>
                  </p>
                  <p style={{ color: '#94A3B8', fontSize: 13 }}>Fecha dia {cartao.diaFechamento}</p>
                </div>

                {formCompraAberto ? (
                  <FormNovaCompra
                    compraInicial={modoFormCompra.compra}
                    onSalvar={(compra) => {
                      if (modoFormCompra.compra) {
                        onEditarCompra({ ...compra, cartaoId: cartao.id })
                      } else {
                        onAdicionarCompra({ ...compra, cartaoId: cartao.id })
                      }
                      setModoFormCompra(null)
                    }}
                    onCancelar={() => setModoFormCompra(null)}
                  />
                ) : (
                  <button
                    onClick={() => setModoFormCompra({ cartaoId: cartao.id })}
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 10,
                      border: '1px dashed #6366F1',
                      background: 'transparent',
                      color: '#6366F1',
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    + Nova compra
                  </button>
                )}

                <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>Compras cadastradas</p>
                {comprasDoCartao.length === 0 && (
                  <p style={{ color: '#64748B', fontSize: 13, marginBottom: 8 }}>Nenhuma compra cadastrada.</p>
                )}
                {comprasDoCartao.map((c) => {
                  const cat = infoCategoria('despesa', c.categoria)
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: '1px solid #334155',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{cat.icone}</span>
                        <div>
                          <p style={{ color: '#fff', fontSize: 13 }}>{c.descricao}</p>
                          <p style={{ color: '#64748B', fontSize: 11 }}>
                            {formatarMoeda(c.valorTotal)} em {c.parcelas}x
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <button
                          onClick={() => setModoFormCompra({ cartaoId: cartao.id, compra: c })}
                          aria-label="Editar compra"
                          style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Excluir esta compra e todas as suas parcelas?')) {
                              onExcluirCompra(c.id)
                            }
                          }}
                          aria-label="Excluir compra"
                          style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Formulário Nova Meta ----------

function FormNovaMeta({ onSalvar, onCancelar, metaInicial }) {
  const [nome, setNome] = useState(metaInicial?.nome || '')
  const [valorAlvo, setValorAlvo] = useState(metaInicial ? String(metaInicial.valorAlvo) : '')
  const [valorAtual, setValorAtual] = useState(metaInicial ? String(metaInicial.valorAtual) : '0')
  const [icone, setIcone] = useState(metaInicial?.icone || '🎯')

  const emEdicao = Boolean(metaInicial)
  const iconesDisponiveis = ['🎯', '✈️', '🚗', '🏠', '🎓', '💍', '🎂', '🚨', '🛡️']

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

  function handleSalvar() {
    if (!nome.trim() || !valorAlvo || Number(valorAlvo) <= 0) {
      alert('Preencha o nome da meta e um valor alvo válido.')
      return
    }
    onSalvar({
      id: emEdicao ? metaInicial.id : Date.now(),
      nome: nome.trim(),
      valorAlvo: Number(valorAlvo),
      valorAtual: Number(valorAtual) || 0,
      icone,
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar meta' : 'Nova meta'}
      </p>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Ícone</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {iconesDisponiveis.map((ic) => (
          <button
            key={ic}
            onClick={() => setIcone(ic)}
            style={{
              fontSize: 18,
              padding: 8,
              borderRadius: 8,
              border: icone === ic ? '2px solid #6366F1' : '2px solid transparent',
              background: '#0F172A',
            }}
          >
            {ic}
          </button>
        ))}
      </div>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Nome da meta</label>
      <input
        style={inputStyle}
        placeholder="Ex: Viagem, Carro, Reserva..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Valor alvo (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valorAlvo}
        onChange={(e) => setValorAlvo(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Já guardado até agora (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valorAtual}
        onChange={(e) => setValorAtual(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          {emEdicao ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Metas ----------

function Metas({ metas, onAdicionarMeta, onEditarMeta, onExcluirMeta, onContribuir, reserva, transacoes, onSalvarConfigReserva, onContribuirReserva }) {
  const [modoForm, setModoForm] = useState(null) // null | 'novo' | metaObjeto
  const [depositoAberto, setDepositoAberto] = useState(null) // id da meta com input de depósito aberto
  const [valorDeposito, setValorDeposito] = useState('')

  function confirmarDeposito(meta) {
    const valor = Number(valorDeposito)
    if (!valor || valor <= 0) {
      alert('Digite um valor válido pra depositar.')
      return
    }
    onContribuir(meta.id, valor)
    setDepositoAberto(null)
    setValorDeposito('')
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, color: '#fff' }}>Metas</h1>
        {!modoForm && (
          <button
            onClick={() => setModoForm('novo')}
            style={{ background: '#6366F1', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            + Meta
          </button>
        )}
      </div>

      <ReservaEmergencia
        reserva={reserva}
        transacoes={transacoes}
        onSalvarConfig={onSalvarConfigReserva}
        onContribuir={onContribuirReserva}
      />

      {modoForm === 'novo' && (
        <FormNovaMeta
          onSalvar={(meta) => {
            onAdicionarMeta(meta)
            setModoForm(null)
          }}
          onCancelar={() => setModoForm(null)}
        />
      )}

      {modoForm && modoForm !== 'novo' && (
        <FormNovaMeta
          metaInicial={modoForm}
          onSalvar={(meta) => {
            onEditarMeta(meta)
            setModoForm(null)
          }}
          onCancelar={() => setModoForm(null)}
        />
      )}

      {metas.length === 0 && !modoForm && (
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Nenhuma meta cadastrada ainda. Toque em "+ Meta" pra começar a guardar dinheiro pra algo importante.
        </p>
      )}

      {metas.map((meta) => {
        const percentual = meta.valorAlvo > 0 ? Math.min((meta.valorAtual / meta.valorAlvo) * 100, 100) : 0
        const completa = meta.valorAtual >= meta.valorAlvo
        const faltam = Math.max(meta.valorAlvo - meta.valorAtual, 0)

        return (
          <div key={meta.id} style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
                {meta.icone} {meta.nome} {completa && '✅'}
              </p>
              <div style={{ display: 'flex', gap: 2 }}>
                <button
                  onClick={() => setModoForm(meta)}
                  aria-label="Editar meta"
                  style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                >
                  ✏️
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir a meta "${meta.nome}"?`)) onExcluirMeta(meta.id)
                  }}
                  aria-label="Excluir meta"
                  style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                >
                  🗑️
                </button>
              </div>
            </div>

            <div style={{ background: '#0F172A', borderRadius: 8, height: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: `${percentual}%`,
                  background: completa ? '#22C55E' : '#6366F1',
                  height: 10,
                  borderRadius: 8,
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ color: '#94A3B8', fontSize: 12 }}>
                {formatarMoeda(meta.valorAtual)} de {formatarMoeda(meta.valorAlvo)}
              </p>
              <p style={{ color: '#94A3B8', fontSize: 12 }}>{Math.round(percentual)}%</p>
            </div>

            {!completa && faltam > 0 && (
              <p style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>
                Faltam {formatarMoeda(faltam)}
              </p>
            )}

            {depositoAberto === meta.id ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  placeholder="Valor a depositar"
                  value={valorDeposito}
                  onChange={(e) => setValorDeposito(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #334155',
                    background: '#0F172A',
                    color: '#fff',
                    fontSize: 14,
                  }}
                />
                <button
                  onClick={() => confirmarDeposito(meta)}
                  style={{ background: '#22C55E', border: 'none', color: '#fff', borderRadius: 10, padding: '0 16px', fontWeight: 600 }}
                >
                  OK
                </button>
                <button
                  onClick={() => {
                    setDepositoAberto(null)
                    setValorDeposito('')
                  }}
                  style={{ background: '#334155', border: 'none', color: '#fff', borderRadius: 10, padding: '0 12px' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              !completa && (
                <button
                  onClick={() => setDepositoAberto(meta.id)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '1px dashed #22C55E',
                    background: 'transparent',
                    color: '#22C55E',
                    fontWeight: 600,
                  }}
                >
                  💰 Depositar
                </button>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Formulário Reserva de Emergência ----------

function FormReserva({ onSalvar, onCancelar, reservaInicial, despesaMediaMensal }) {
  const [valorAtual, setValorAtual] = useState(reservaInicial ? String(reservaInicial.valorAtual) : '0')
  const [mesesDesejados, setMesesDesejados] = useState(reservaInicial ? String(reservaInicial.mesesDesejados) : '6')
  const [aporteMensalPlanejado, setAporteMensalPlanejado] = useState(
    reservaInicial ? String(reservaInicial.aporteMensalPlanejado) : ''
  )

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

  function handleSalvar() {
    if (!mesesDesejados || Number(mesesDesejados) <= 0) {
      alert('Diga quantos meses de despesas você quer ter guardado.')
      return
    }
    onSalvar({
      valorAtual: Number(valorAtual) || 0,
      mesesDesejados: Number(mesesDesejados),
      aporteMensalPlanejado: Number(aporteMensalPlanejado) || 0,
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        🛡️ Configurar reserva de emergência
      </p>
      <p style={{ color: '#64748B', fontSize: 12, marginBottom: 12 }}>
        Sua média de despesas nos últimos meses é {formatarMoeda(despesaMediaMensal)}.
      </p>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Quantos meses de despesas você quer guardar?</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="numeric"
        placeholder="Ex: 6"
        value={mesesDesejados}
        onChange={(e) => setMesesDesejados(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Já guardado até agora (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valorAtual}
        onChange={(e) => setValorAtual(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Quanto pretende guardar por mês? (opcional)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={aporteMensalPlanejado}
        onChange={(e) => setAporteMensalPlanejado(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Reserva de Emergência ----------

function ReservaEmergencia({ reserva, transacoes, onSalvarConfig, onContribuir }) {
  const [editando, setEditando] = useState(false)
  const [depositoAberto, setDepositoAberto] = useState(false)
  const [valorDeposito, setValorDeposito] = useState('')

  const despesaMediaMensal = calcularMediaDespesasMensais(transacoes)

  if (!reserva || editando) {
    return (
      <div style={{ marginBottom: 20 }}>
        <FormReserva
          reservaInicial={reserva}
          despesaMediaMensal={despesaMediaMensal}
          onSalvar={(config) => {
            onSalvarConfig(config)
            setEditando(false)
          }}
          onCancelar={() => setEditando(false)}
        />
      </div>
    )
  }

  const valorAlvo = despesaMediaMensal * reserva.mesesDesejados
  const percentual = valorAlvo > 0 ? Math.min((reserva.valorAtual / valorAlvo) * 100, 100) : 0
  const completa = reserva.valorAtual >= valorAlvo
  const faltam = Math.max(valorAlvo - reserva.valorAtual, 0)
  const tempoEstimadoMeses =
    reserva.aporteMensalPlanejado > 0 ? Math.ceil(faltam / reserva.aporteMensalPlanejado) : null

  function confirmarDeposito() {
    const valor = Number(valorDeposito)
    if (!valor || valor <= 0) {
      alert('Digite um valor válido pra depositar.')
      return
    }
    onContribuir(valor)
    setDepositoAberto(false)
    setValorDeposito('')
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0F766E, #0D9488)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
          🛡️ Reserva de emergência {completa && '✅'}
        </p>
        <button
          onClick={() => setEditando(true)}
          aria-label="Configurar reserva"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
        >
          ⚙️
        </button>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, height: 10, marginBottom: 8 }}>
        <div
          style={{
            width: `${percentual}%`,
            background: completa ? '#22C55E' : '#fff',
            height: 10,
            borderRadius: 8,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <p style={{ color: '#CCFBF1', fontSize: 12 }}>
          {formatarMoeda(reserva.valorAtual)} de {formatarMoeda(valorAlvo)}
        </p>
        <p style={{ color: '#CCFBF1', fontSize: 12 }}>{Math.round(percentual)}%</p>
      </div>

      <p style={{ color: '#CCFBF1', fontSize: 12, marginBottom: 4 }}>
        Meta: {reserva.mesesDesejados} meses de despesas ({formatarMoeda(despesaMediaMensal)}/mês)
      </p>

      {!completa && (
        <p style={{ color: '#CCFBF1', fontSize: 12, marginBottom: 10 }}>
          Faltam {formatarMoeda(faltam)}
          {tempoEstimadoMeses !== null &&
            ` · no ritmo atual, ~${tempoEstimadoMeses} ${tempoEstimadoMeses === 1 ? 'mês' : 'meses'}`}
        </p>
      )}

      {depositoAberto ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            placeholder="Valor a depositar"
            value={valorDeposito}
            onChange={(e) => setValorDeposito(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: 14,
            }}
          />
          <button
            onClick={confirmarDeposito}
            style={{ background: '#fff', border: 'none', color: '#0D9488', borderRadius: 10, padding: '0 16px', fontWeight: 700 }}
          >
            OK
          </button>
          <button
            onClick={() => {
              setDepositoAberto(false)
              setValorDeposito('')
            }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 10, padding: '0 12px' }}
          >
            ✕
          </button>
        </div>
      ) : (
        !completa && (
          <button
            onClick={() => setDepositoAberto(true)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 10,
              border: '1px dashed rgba(255,255,255,0.5)',
              background: 'transparent',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            💰 Depositar
          </button>
        )
      )}
    </div>
  )
}

// ---------- Componente: Formulário Item Anual ----------

function FormItemAnual({ onSalvar, onCancelar, itemInicial }) {
  const [nome, setNome] = useState(itemInicial?.nome || '')
  const [valorEstimado, setValorEstimado] = useState(itemInicial ? String(itemInicial.valorEstimado) : '')
  const [mes, setMes] = useState(itemInicial ? String(itemInicial.mes) : '1')

  const emEdicao = Boolean(itemInicial)

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

  function handleSalvar() {
    if (!nome.trim() || !valorEstimado || Number(valorEstimado) <= 0) {
      alert('Preencha o nome e o valor estimado.')
      return
    }
    onSalvar({
      id: emEdicao ? itemInicial.id : Date.now(),
      nome: nome.trim(),
      valorEstimado: Number(valorEstimado),
      mes: Number(mes),
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar item anual' : 'Novo item anual'}
      </p>
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Nome</label>
      <input
        style={inputStyle}
        placeholder="Ex: IPTU, 13º salário, Material escolar..."
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Valor estimado (R$)</label>
      <input
        style={inputStyle}
        type="number"
        inputMode="decimal"
        placeholder="0,00"
        value={valorEstimado}
        onChange={(e) => setValorEstimado(e.target.value)}
      />
      <label style={{ color: '#94A3B8', fontSize: 13 }}>Mês previsto</label>
      <select style={inputStyle} value={mes} onChange={(e) => setMes(e.target.value)}>
        {NOMES_MESES.map((nomeMes, i) => (
          <option key={i} value={i + 1}>
            {nomeMes}
          </option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          {emEdicao ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Planejamento (mensal e anual) ----------

function Planejamento({
  transacoes,
  planejamentos,
  itensAnuais,
  onSalvarPlanejamentoMes,
  onAdicionarItemAnual,
  onEditarItemAnual,
  onExcluirItemAnual,
  onVoltar,
}) {
  const chave = mesAtual()
  const planoAtual = planejamentos[chave] || { receitaPrevista: 0, despesaPrevista: 0 }
  const [receitaPrevista, setReceitaPrevista] = useState(
    planoAtual.receitaPrevista ? String(planoAtual.receitaPrevista) : ''
  )
  const [despesaPrevista, setDespesaPrevista] = useState(
    planoAtual.despesaPrevista ? String(planoAtual.despesaPrevista) : ''
  )
  const [modoFormItem, setModoFormItem] = useState(null) // null | 'novo' | item

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

  const doMes = transacoes.filter((t) => t.data.startsWith(chave))
  const receitaReal = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const despesaReal = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)

  const receitaPrevNum = Number(receitaPrevista) || 0
  const despesaPrevNum = Number(despesaPrevista) || 0
  const saldoEsperado = receitaPrevNum - despesaPrevNum

  function handleSalvarPlano() {
    onSalvarPlanejamentoMes(chave, { receitaPrevista: receitaPrevNum, despesaPrevista: despesaPrevNum })
  }

  const hoje = new Date()
  const mesAtualNum = hoje.getMonth() + 1
  const itensOrdenados = [...itensAnuais].sort((a, b) => a.mes - b.mes)

  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={onVoltar}
        style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, marginBottom: 12, padding: 0 }}
      >
        ‹ Voltar
      </button>
      <h1 style={{ fontSize: 20, color: '#fff', marginBottom: 20 }}>Planejamento</h1>

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>
        Planejamento de {NOMES_MESES[mesAtualNum - 1]}
      </p>
      <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 24 }}>
        <label style={{ color: '#94A3B8', fontSize: 13 }}>Receita prevista</label>
        <input
          style={inputStyle}
          type="number"
          inputMode="decimal"
          placeholder="0,00"
          value={receitaPrevista}
          onChange={(e) => setReceitaPrevista(e.target.value)}
        />
        <label style={{ color: '#94A3B8', fontSize: 13 }}>Despesa prevista</label>
        <input
          style={inputStyle}
          type="number"
          inputMode="decimal"
          placeholder="0,00"
          value={despesaPrevista}
          onChange={(e) => setDespesaPrevista(e.target.value)}
        />
        <button
          onClick={handleSalvarPlano}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700, marginBottom: 16 }}
        >
          Salvar plano do mês
        </button>

        <div style={{ borderTop: '1px solid #334155', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Saldo esperado</p>
            <p style={{ color: saldoEsperado >= 0 ? '#22C55E' : '#EF4444', fontSize: 13, fontWeight: 600 }}>
              {formatarMoeda(saldoEsperado)}
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Receita real até agora</p>
            <p style={{ color: '#22C55E', fontSize: 13 }}>{formatarMoeda(receitaReal)}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ color: '#94A3B8', fontSize: 13 }}>Despesa real até agora</p>
            <p style={{ color: '#EF4444', fontSize: 13 }}>{formatarMoeda(despesaReal)}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ color: '#94A3B8', fontSize: 13 }}>Visão anual (13º, IPTU, férias...)</p>
        {!modoFormItem && (
          <button
            onClick={() => setModoFormItem('novo')}
            style={{ background: '#6366F1', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600 }}
          >
            + Item
          </button>
        )}
      </div>

      {modoFormItem === 'novo' && (
        <FormItemAnual
          onSalvar={(item) => {
            onAdicionarItemAnual(item)
            setModoFormItem(null)
          }}
          onCancelar={() => setModoFormItem(null)}
        />
      )}
      {modoFormItem && modoFormItem !== 'novo' && (
        <FormItemAnual
          itemInicial={modoFormItem}
          onSalvar={(item) => {
            onEditarItemAnual(item)
            setModoFormItem(null)
          }}
          onCancelar={() => setModoFormItem(null)}
        />
      )}

      {itensOrdenados.length === 0 && !modoFormItem && (
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Nenhum item anual cadastrado. Adicione coisas como IPTU, IPVA, 13º ou material escolar.
        </p>
      )}

      {itensOrdenados.map((item) => {
        const proximo = item.mes === mesAtualNum || item.mes === (mesAtualNum % 12) + 1
        return (
          <div
            key={item.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: proximo ? '#1E293B' : 'transparent',
              border: proximo ? '1px solid #6366F1' : '1px solid #1E293B',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 8,
            }}
          >
            <div>
              <p style={{ color: '#fff', fontSize: 14 }}>
                {item.nome} {proximo && <span style={{ color: '#6366F1', fontSize: 11 }}>chegando</span>}
              </p>
              <p style={{ color: '#64748B', fontSize: 12 }}>{NOMES_MESES[item.mes - 1]}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ color: '#F59E0B', fontSize: 14, fontWeight: 600 }}>{formatarMoeda(item.valorEstimado)}</p>
              <button
                onClick={() => setModoFormItem(item)}
                aria-label="Editar item"
                style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
              >
                ✏️
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Excluir "${item.nome}"?`)) onExcluirItemAnual(item.id)
                }}
                aria-label="Excluir item"
                style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
              >
                🗑️
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Relatórios ----------

function Relatorios({ transacoes, onVoltar }) {
  const resumo = calcularResumoMensal(transacoes, 6)
  const maxValor = Math.max(...resumo.flatMap((m) => [m.receitas, m.despesas]), 1)

  const chaveMesAtual = mesAtual()
  const doMesAtual = transacoes.filter((t) => t.data.startsWith(chaveMesAtual) && t.tipo === 'despesa')
  const porCategoria = {}
  doMesAtual.forEach((t) => {
    porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor
  })
  const totalDespesasMes = Object.values(porCategoria).reduce((s, v) => s + v, 0)
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])
  const maiorCategoria = categoriasOrdenadas[0]

  const mesesComDados = resumo.filter((m) => m.receitas > 0 || m.despesas > 0)
  const economiaMedia =
    mesesComDados.length > 0
      ? mesesComDados.reduce((s, m) => s + m.saldo, 0) / mesesComDados.length
      : 0

  function nomeMesAbreviado(chave) {
    const [, mes] = chave.split('-')
    return NOMES_MESES[Number(mes) - 1].slice(0, 3)
  }

  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={onVoltar}
        style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, marginBottom: 12, padding: 0 }}
      >
        ‹ Voltar
      </button>
      <h1 style={{ fontSize: 20, color: '#fff', marginBottom: 20 }}>Relatórios</h1>

      <div
        style={{
          background: economiaMedia >= 0 ? '#1E293B' : '#1E293B',
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>
          Você economiza em média, por mês
        </p>
        <p style={{ color: economiaMedia >= 0 ? '#22C55E' : '#EF4444', fontSize: 22, fontWeight: 700 }}>
          {formatarMoeda(economiaMedia)}
        </p>
      </div>

      {maiorCategoria && (
        <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Onde você mais gasta este mês</p>
          <p style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
            {infoCategoria('despesa', maiorCategoria[0]).icone} {infoCategoria('despesa', maiorCategoria[0]).label}
          </p>
          <p style={{ color: '#F59E0B', fontSize: 13 }}>
            {formatarMoeda(maiorCategoria[1])} ·{' '}
            {totalDespesasMes > 0 ? Math.round((maiorCategoria[1] / totalDespesasMes) * 100) : 0}% dos gastos
          </p>
        </div>
      )}

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
        Receitas x Despesas — últimos 6 meses
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          height: 140,
          marginBottom: 8,
          background: '#1E293B',
          borderRadius: 14,
          padding: '16px 12px 8px',
        }}
      >
        {resumo.map((m) => (
          <div key={m.chave} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              <div
                title="Receitas"
                style={{
                  width: 10,
                  height: `${(m.receitas / maxValor) * 100}%`,
                  minHeight: m.receitas > 0 ? 2 : 0,
                  background: '#22C55E',
                  borderRadius: 3,
                }}
              />
              <div
                title="Despesas"
                style={{
                  width: 10,
                  height: `${(m.despesas / maxValor) * 100}%`,
                  minHeight: m.despesas > 0 ? 2 : 0,
                  background: '#EF4444',
                  borderRadius: 3,
                }}
              />
            </div>
            <p style={{ color: '#64748B', fontSize: 10, marginTop: 6 }}>{nomeMesAbreviado(m.chave)}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: '#22C55E' }} />
          <span style={{ color: '#64748B', fontSize: 11 }}>Receitas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 8, background: '#EF4444' }} />
          <span style={{ color: '#64748B', fontSize: 11 }}>Despesas</span>
        </div>
      </div>

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
        Evolução do saldo total — últimos 6 meses
      </p>
      <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        {resumo.map((m) => (
          <div key={m.chave} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ color: '#94A3B8', fontSize: 12 }}>{nomeMesAbreviado(m.chave)}</p>
            <p style={{ color: m.acumulado >= 0 ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
              {formatarMoeda(m.acumulado)}
            </p>
          </div>
        ))}
      </div>

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
        Gastos por categoria — este mês
      </p>
      {categoriasOrdenadas.length === 0 && (
        <p style={{ color: '#64748B', fontSize: 14 }}>Nenhuma despesa registrada este mês ainda.</p>
      )}
      {categoriasOrdenadas.map(([catId, valor]) => {
        const cat = infoCategoria('despesa', catId)
        const percentual = totalDespesasMes > 0 ? (valor / totalDespesasMes) * 100 : 0
        return (
          <div key={catId} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: '#fff', fontSize: 13 }}>
                {cat.icone} {cat.label}
              </span>
              <span style={{ color: '#94A3B8', fontSize: 13 }}>
                {formatarMoeda(valor)} · {Math.round(percentual)}%
              </span>
            </div>
            <div style={{ background: '#1E293B', borderRadius: 6, height: 6 }}>
              <div style={{ width: `${percentual}%`, background: '#6366F1', height: 6, borderRadius: 6 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Formulário Novo Filho ----------

function FormNovoFilho({ onSalvar, onCancelar, filhoInicial }) {
  const [nome, setNome] = useState(filhoInicial?.nome || '')
  const [icone, setIcone] = useState(filhoInicial?.icone || '🧒')

  const emEdicao = Boolean(filhoInicial)
  const iconesDisponiveis = ['🧒', '👦', '👧', '👶']

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

  function handleSalvar() {
    if (!nome.trim()) {
      alert('Preencha o nome.')
      return
    }
    onSalvar({
      id: emEdicao ? filhoInicial.id : Date.now(),
      nome: nome.trim(),
      icone,
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar filho(a)' : 'Novo filho(a)'}
      </p>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Ícone</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {iconesDisponiveis.map((ic) => (
          <button
            key={ic}
            onClick={() => setIcone(ic)}
            style={{
              fontSize: 18,
              padding: 8,
              borderRadius: 8,
              border: icone === ic ? '2px solid #6366F1' : '2px solid transparent',
              background: '#0F172A',
            }}
          >
            {ic}
          </button>
        ))}
      </div>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Nome</label>
      <input style={inputStyle} placeholder="Ex: Sofia" value={nome} onChange={(e) => setNome(e.target.value)} />

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onCancelar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSalvar}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          {emEdicao ? 'Salvar alterações' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Filhos ----------

function Filhos({ filhos, transacoes, onAdicionarFilho, onEditarFilho, onExcluirFilho, onVoltar }) {
  const [modoForm, setModoForm] = useState(null) // null | 'novo' | filhoObjeto
  const [filhoExpandido, setFilhoExpandido] = useState(null)

  return (
    <div style={{ padding: 20 }}>
      <button
        onClick={onVoltar}
        style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, marginBottom: 12, padding: 0 }}
      >
        ‹ Voltar
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, color: '#fff' }}>Filhos</h1>
        {!modoForm && (
          <button
            onClick={() => setModoForm('novo')}
            style={{ background: '#6366F1', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600 }}
          >
            + Filho(a)
          </button>
        )}
      </div>

      {modoForm === 'novo' && (
        <FormNovoFilho
          onSalvar={(filho) => {
            onAdicionarFilho(filho)
            setModoForm(null)
          }}
          onCancelar={() => setModoForm(null)}
        />
      )}
      {modoForm && modoForm !== 'novo' && (
        <FormNovoFilho
          filhoInicial={modoForm}
          onSalvar={(filho) => {
            onEditarFilho(filho)
            setModoForm(null)
          }}
          onCancelar={() => setModoForm(null)}
        />
      )}

      {filhos.length === 0 && !modoForm && (
        <p style={{ color: '#64748B', fontSize: 14 }}>
          Nenhum filho cadastrado ainda. Cadastre pra começar a acompanhar gastos específicos, como escola, remédios e fraldas.
        </p>
      )}

      {filhos.map((filho) => {
        const gastosDoFilho = transacoes.filter((t) => t.filhoId === filho.id && t.tipo === 'despesa')
        const totalGasto = gastosDoFilho.reduce((s, t) => s + t.valor, 0)
        const chaveMesAtual = mesAtual()
        const totalMesAtual = gastosDoFilho
          .filter((t) => t.data.startsWith(chaveMesAtual))
          .reduce((s, t) => s + t.valor, 0)
        const expandido = filhoExpandido === filho.id

        return (
          <div key={filho.id} style={{ marginBottom: 12 }}>
            <div style={{ background: '#1E293B', borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <button
                  onClick={() => setFilhoExpandido(expandido ? null : filho.id)}
                  style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{ fontSize: 20 }}>{filho.icone}</span>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>{filho.nome}</p>
                </button>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    onClick={() => setModoForm(filho)}
                    aria-label="Editar filho"
                    style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o perfil de "${filho.nome}"? As transações já lançadas não serão apagadas.`)) {
                        onExcluirFilho(filho.id)
                      }
                    }}
                    aria-label="Excluir filho"
                    style={{ background: 'transparent', border: 'none', fontSize: 14, padding: 6, cursor: 'pointer' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#94A3B8', fontSize: 11 }}>Este mês</p>
                  <p style={{ color: '#F59E0B', fontSize: 15, fontWeight: 600 }}>{formatarMoeda(totalMesAtual)}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#94A3B8', fontSize: 11 }}>Total gasto</p>
                  <p style={{ color: '#F59E0B', fontSize: 15, fontWeight: 600 }}>{formatarMoeda(totalGasto)}</p>
                </div>
              </div>

              {expandido && (
                <div style={{ marginTop: 12, borderTop: '1px solid #334155', paddingTop: 12 }}>
                  {gastosDoFilho.length === 0 && (
                    <p style={{ color: '#64748B', fontSize: 13 }}>Nenhum gasto registrado ainda.</p>
                  )}
                  {[...gastosDoFilho]
                    .sort((a, b) => new Date(b.data) - new Date(a.data))
                    .slice(0, 10)
                    .map((t) => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <p style={{ color: '#fff', fontSize: 13 }}>{t.descricao}</p>
                        <p style={{ color: '#EF4444', fontSize: 13 }}>{formatarMoeda(t.valor)}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Assistente IA ----------

function Assistente({ transacoes, metas, reserva, cartoes, onVoltar }) {
  const [pergunta, setPergunta] = useState('')
  const [historico, setHistorico] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const perguntasSugeridas = [
    'Posso gastar R$100 com lazer essa semana?',
    'Onde estou gastando mais esse mês?',
    'Quanto preciso guardar por mês pra bater minhas metas?',
  ]

  async function enviarPergunta(texto) {
    const perguntaFinal = (texto ?? pergunta).trim()
    if (!perguntaFinal) return

    setCarregando(true)
    setErro(null)

    try {
      const contexto = construirContextoIA(transacoes, metas, reserva, cartoes)
      const resposta = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: perguntaFinal, contexto }),
      })
      const dados = await resposta.json()

      if (!resposta.ok || dados.erro) {
        setErro(dados.erro || 'Não consegui falar com a IA agora. Tente de novo.')
      } else {
        setHistorico((atual) => [...atual, { pergunta: perguntaFinal, resposta: dados.resposta }])
        setPergunta('')
      }
    } catch {
      setErro('Não consegui conectar com a IA. Verifique sua internet e tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
      <button
        onClick={onVoltar}
        style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, marginBottom: 12, padding: 0 }}
      >
        ‹ Voltar
      </button>
      <h1 style={{ fontSize: 20, color: '#fff', marginBottom: 16 }}>🤖 Assistente</h1>

      {historico.length === 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 10 }}>Perguntas rápidas:</p>
          {perguntasSugeridas.map((p) => (
            <button
              key={p}
              onClick={() => enviarPergunta(p)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: '#1E293B',
                border: 'none',
                color: '#fff',
                borderRadius: 10,
                padding: 12,
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, marginBottom: 16 }}>
        {historico.map((item, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div
              style={{
                background: '#6366F1',
                borderRadius: '14px 14px 4px 14px',
                padding: '10px 14px',
                marginBottom: 8,
                marginLeft: 40,
              }}
            >
              <p style={{ color: '#fff', fontSize: 14 }}>{item.pergunta}</p>
            </div>
            <div
              style={{
                background: '#1E293B',
                borderRadius: '14px 14px 14px 4px',
                padding: '10px 14px',
                marginRight: 20,
              }}
            >
              <p style={{ color: '#fff', fontSize: 14 }}>{item.resposta}</p>
            </div>
          </div>
        ))}
        {carregando && <p style={{ color: '#64748B', fontSize: 13 }}>Pensando...</p>}
        {erro && <p style={{ color: '#EF4444', fontSize: 13 }}>{erro}</p>}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviarPergunta()}
          placeholder="Pergunte algo sobre suas finanças..."
          style={{
            flex: 1,
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #334155',
            background: '#1E293B',
            color: '#fff',
            fontSize: 14,
          }}
        />
        <button
          onClick={() => enviarPergunta()}
          disabled={carregando}
          style={{
            background: '#6366F1',
            border: 'none',
            color: '#fff',
            borderRadius: 10,
            padding: '0 18px',
            fontWeight: 700,
            opacity: carregando ? 0.6 : 1,
          }}
        >
          ➤
        </button>
      </div>
    </div>
  )
}

// ---------- Componente: Navegação inferior ----------

function BottomNav({ abaAtiva, onMudarAba }) {
  const abas = [
    { id: 'dashboard', label: 'Início', icone: '🏠' },
    { id: 'calendario', label: 'Calendário', icone: '📅' },
    { id: 'cartoes', label: 'Cartões', icone: '💳' },
    { id: 'metas', label: 'Metas', icone: '🎯' },
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
  const [cartoes, setCartoes] = useState(carregarCartoes)
  const [compras, setCompras] = useState(carregarCompras)
  const [metas, setMetas] = useState(carregarMetas)
  const [reserva, setReserva] = useState(carregarReserva)
  const [planejamentos, setPlanejamentos] = useState(carregarPlanejamentos)
  const [itensAnuais, setItensAnuais] = useState(carregarItensAnuais)
  const [filhos, setFilhos] = useState(carregarFilhos)
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [transacaoEditando, setTransacaoEditando] = useState(null)

  useEffect(() => {
    salvarTransacoes(transacoes)
  }, [transacoes])

  useEffect(() => {
    salvarCartoes(cartoes)
  }, [cartoes])

  useEffect(() => {
    salvarCompras(compras)
  }, [compras])

  useEffect(() => {
    salvarMetas(metas)
  }, [metas])

  useEffect(() => {
    salvarReserva(reserva)
  }, [reserva])

  useEffect(() => {
    salvarPlanejamentos(planejamentos)
  }, [planejamentos])

  useEffect(() => {
    salvarItensAnuais(itensAnuais)
  }, [itensAnuais])

  useEffect(() => {
    salvarFilhos(filhos)
  }, [filhos])

  function handleMudarAba(novaAba) {
    setTransacaoEditando(null)
    setAbaAtiva(novaAba)
  }

  function handleAdicionar(novaTransacao) {
    setTransacoes((atual) => [...atual, novaTransacao])
    setAbaAtiva('dashboard')
  }

  function handleIniciarEdicao(transacao) {
    setTransacaoEditando(transacao)
    setAbaAtiva('adicionar')
  }

  function handleSalvarEdicao(transacaoAtualizada) {
    setTransacoes((atual) =>
      atual.map((t) => (t.id === transacaoAtualizada.id ? transacaoAtualizada : t))
    )
    setTransacaoEditando(null)
    setAbaAtiva('dashboard')
  }

  function handleExcluir(id) {
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      setTransacoes((atual) => atual.filter((t) => t.id !== id))
    }
  }

  function handleAdicionarCartao(novoCartao) {
    setCartoes((atual) => [...atual, novoCartao])
  }

  function handleEditarCartao(cartaoAtualizado) {
    setCartoes((atual) => atual.map((c) => (c.id === cartaoAtualizado.id ? cartaoAtualizado : c)))
  }

  function handleExcluirCartao(id) {
    setCartoes((atual) => atual.filter((c) => c.id !== id))
    setCompras((atual) => atual.filter((c) => c.cartaoId !== id))
  }

  function handleAdicionarCompra(novaCompra) {
    setCompras((atual) => [...atual, novaCompra])
  }

  function handleEditarCompra(compraAtualizada) {
    setCompras((atual) => atual.map((c) => (c.id === compraAtualizada.id ? compraAtualizada : c)))
  }

  function handleExcluirCompra(id) {
    setCompras((atual) => atual.filter((c) => c.id !== id))
  }

  function handleAdicionarMeta(novaMeta) {
    setMetas((atual) => [...atual, novaMeta])
  }

  function handleEditarMeta(metaAtualizada) {
    setMetas((atual) => atual.map((m) => (m.id === metaAtualizada.id ? metaAtualizada : m)))
  }

  function handleExcluirMeta(id) {
    setMetas((atual) => atual.filter((m) => m.id !== id))
  }

  function handleContribuirMeta(id, valor) {
    setMetas((atual) =>
      atual.map((m) => (m.id === id ? { ...m, valorAtual: m.valorAtual + valor } : m))
    )
  }

  function handleSalvarConfigReserva(config) {
    setReserva(config)
  }

  function handleContribuirReserva(valor) {
    setReserva((atual) => (atual ? { ...atual, valorAtual: atual.valorAtual + valor } : atual))
  }

  function handleSalvarPlanejamentoMes(chave, plano) {
    setPlanejamentos((atual) => ({ ...atual, [chave]: plano }))
  }

  function handleAdicionarItemAnual(item) {
    setItensAnuais((atual) => [...atual, item])
  }

  function handleEditarItemAnual(itemAtualizado) {
    setItensAnuais((atual) => atual.map((i) => (i.id === itemAtualizado.id ? itemAtualizado : i)))
  }

  function handleExcluirItemAnual(id) {
    setItensAnuais((atual) => atual.filter((i) => i.id !== id))
  }

  function handleAdicionarFilho(novoFilho) {
    setFilhos((atual) => [...atual, novoFilho])
  }

  function handleEditarFilho(filhoAtualizado) {
    setFilhos((atual) => atual.map((f) => (f.id === filhoAtualizado.id ? filhoAtualizado : f)))
  }

  function handleExcluirFilho(id) {
    setFilhos((atual) => atual.filter((f) => f.id !== id))
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
      {abaAtiva === 'dashboard' && (
        <Dashboard
          transacoes={transacoes}
          onEditar={handleIniciarEdicao}
          onExcluir={handleExcluir}
          onAbrirPlanejamento={() => setAbaAtiva('planejamento')}
          onAbrirRelatorios={() => setAbaAtiva('relatorios')}
          onAbrirFilhos={() => setAbaAtiva('filhos')}
          onAbrirAssistente={() => setAbaAtiva('assistente')}
        />
      )}
      {abaAtiva === 'relatorios' && (
        <Relatorios transacoes={transacoes} onVoltar={() => setAbaAtiva('dashboard')} />
      )}
      {abaAtiva === 'filhos' && (
        <Filhos
          filhos={filhos}
          transacoes={transacoes}
          onAdicionarFilho={handleAdicionarFilho}
          onEditarFilho={handleEditarFilho}
          onExcluirFilho={handleExcluirFilho}
          onVoltar={() => setAbaAtiva('dashboard')}
        />
      )}
      {abaAtiva === 'assistente' && (
        <Assistente
          transacoes={transacoes}
          metas={metas}
          reserva={reserva}
          cartoes={cartoes}
          onVoltar={() => setAbaAtiva('dashboard')}
        />
      )}
      {abaAtiva === 'planejamento' && (
        <Planejamento
          transacoes={transacoes}
          planejamentos={planejamentos}
          itensAnuais={itensAnuais}
          onSalvarPlanejamentoMes={handleSalvarPlanejamentoMes}
          onAdicionarItemAnual={handleAdicionarItemAnual}
          onEditarItemAnual={handleEditarItemAnual}
          onExcluirItemAnual={handleExcluirItemAnual}
          onVoltar={() => setAbaAtiva('dashboard')}
        />
      )}
      {abaAtiva === 'calendario' && <Calendario transacoes={transacoes} />}
      {abaAtiva === 'cartoes' && (
        <Cartoes
          cartoes={cartoes}
          compras={compras}
          onAdicionarCartao={handleAdicionarCartao}
          onEditarCartao={handleEditarCartao}
          onExcluirCartao={handleExcluirCartao}
          onAdicionarCompra={handleAdicionarCompra}
          onEditarCompra={handleEditarCompra}
          onExcluirCompra={handleExcluirCompra}
        />
      )}
      {abaAtiva === 'metas' && (
        <Metas
          metas={metas}
          onAdicionarMeta={handleAdicionarMeta}
          onEditarMeta={handleEditarMeta}
          onExcluirMeta={handleExcluirMeta}
          onContribuir={handleContribuirMeta}
          reserva={reserva}
          transacoes={transacoes}
          onSalvarConfigReserva={handleSalvarConfigReserva}
          onContribuirReserva={handleContribuirReserva}
        />
      )}
      {abaAtiva === 'adicionar' && (
        <Adicionar
          onAdicionar={handleAdicionar}
          onEditar={handleSalvarEdicao}
          onCancelarEdicao={() => {
            setTransacaoEditando(null)
            setAbaAtiva('dashboard')
          }}
          transacaoInicial={transacaoEditando}
          filhos={filhos}
        />
      )}

      <BottomNav abaAtiva={abaAtiva} onMudarAba={handleMudarAba} />
    </div>
  )
}
