import { useState, useEffect } from 'react'

// ---------- Categorias ----------

const CATEGORIAS_DESPESA = [
  { id: 'mercado',      label: 'Mercado',      icone: '🛒' },
  { id: 'alimentacao',  label: 'Alimentação',  icone: '🍽️' },
  { id: 'transporte',   label: 'Transporte',   icone: '🚗' },
  { id: 'lazer',        label: 'Lazer',        icone: '🎉' },
  { id: 'saude',        label: 'Saúde',        icone: '💊' },
  { id: 'educacao',     label: 'Educação',     icone: '📚' },
  { id: 'casa',         label: 'Casa',         icone: '🏠' },
  { id: 'assinaturas',  label: 'Assinaturas',  icone: '📺' },
  { id: 'filhos',       label: 'Filhos',       icone: '🧸' },
  { id: 'outros',       label: 'Outros',       icone: '📦' },
]

const CATEGORIAS_RECEITA = [
  { id: 'salario', label: 'Salário', icone: '💼' },
  { id: 'pensao', label: 'Pensão', icone: '👶' },
  { id: 'freela', label: 'Freelance', icone: '💻' },
  { id: 'pix', label: 'Pix recebido', icone: '📲' },
  { id: 'rendimento', label: 'Rendimento', icone: '📈' },
  { id: 'investimento', label: 'Rendimento de investimento', icone: '📈' },
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

// ---------- Tipos de Conta ----------

const TIPOS_CONTA = [
  { id: 'corrente',     label: 'Conta Corrente',        icone: '🏦', excluirDoSaldo: false },
  { id: 'poupanca',     label: 'Poupança',               icone: '💰', excluirDoSaldo: false },
  { id: 'debito',       label: 'Cartão de Débito',       icone: '💳', excluirDoSaldo: false },
  { id: 'alimentacao',  label: 'Alimentação / Refeição', icone: '🍽️', excluirDoSaldo: false },
  { id: 'credito',      label: 'Cartão de Crédito',      icone: '💜', excluirDoSaldo: true  },
  { id: 'dinheiro',     label: 'Dinheiro',               icone: '💵', excluirDoSaldo: false },
  { id: 'pensao',       label: 'Pensão',                 icone: '👶', excluirDoSaldo: true  },
  { id: 'investimento', label: 'Investimento',           icone: '📈', excluirDoSaldo: true  },
]

function infoTipoConta(tipoId) {
  return TIPOS_CONTA.find((t) => t.id === tipoId) || TIPOS_CONTA[0]
}

// ---------- Persistência: Contas ----------

function carregarContas() {
  try {
    const dados = localStorage.getItem('contas')
    // migração: cartões antigos viram contas de crédito
    const cartõesAntigos = localStorage.getItem('cartoes')
    if (!dados && cartõesAntigos) {
      const cartoes = JSON.parse(cartõesAntigos)
      return cartoes.map((c) => ({ ...c, tipo: 'credito' }))
    }
    return dados ? JSON.parse(dados) : []
  } catch {
    return []
  }
}

function salvarContas(contas) {
  localStorage.setItem('contas', JSON.stringify(contas))
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
function construirContextoIA(transacoes, metas, reserva, contas) {
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
    quantidadeDeContas: contas.length,
  }
}

// ---------- Persistência: Segurança (PIN) ----------

function carregarSeguranca() {
  try {
    const dados = localStorage.getItem('seguranca')
    return dados ? JSON.parse(dados) : null
  } catch {
    return null
  }
}

function salvarSeguranca(config) {
  if (config === null) {
    localStorage.removeItem('seguranca')
  } else {
    localStorage.setItem('seguranca', JSON.stringify(config))
  }
}

// Transforma o PIN num hash (não reversível) usando a Web Crypto API do navegador.
// O PIN em si nunca fica salvo, só o hash — assim ninguém lê o PIN direto do localStorage.
async function gerarHashPin(pin) {
  const codificado = new TextEncoder().encode(pin)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', codificado)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ---------- Persistência: Perfil do usuário (onboarding) ----------

function carregarPerfil() {
  try {
    const dados = localStorage.getItem('perfilUsuario')
    return dados ? JSON.parse(dados) : null
  } catch {
    return null
  }
}

function salvarPerfil(perfil) {
  localStorage.setItem('perfilUsuario', JSON.stringify(perfil))
}

// ---------- Persistência: Preferências (notificações, limite de gastos) ----------

function carregarPreferencias() {
  try {
    const dados = localStorage.getItem('preferencias')
    return dados ? JSON.parse(dados) : { notificarVencimentos: true, limiteGastosMensal: 0 }
  } catch {
    return { notificarVencimentos: true, limiteGastosMensal: 0 }
  }
}

function salvarPreferencias(preferencias) {
  localStorage.setItem('preferencias', JSON.stringify(preferencias))
}

// Calcula o saldo atual de uma conta:
// saldoBase (valor inicial configurado pelo usuário) + todas as transações vinculadas
function calcularSaldoConta(conta, transacoes) {
  const base = conta.saldoBase ?? conta.saldo ?? 0
  const efeito = transacoes
    .filter((t) => t.contaId === conta.id)
    .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0)
  return base + efeito
}

// ---------- Componente: Dashboard ----------

function Dashboard({ transacoes, onEditar, onExcluir, limiteGastosMensal, contas }) {
  const doMes = transacoes.filter((t) => t.data.startsWith(mesAtual()))

  const receitasMes = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
  const despesasMes = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)
  const saldoMes = receitasMes - despesasMes

  // Saldo total = soma dos saldos calculados das contas principais
  // Pensão e Investimento ficam separados
  const contasPrincipais = (contas || []).filter((c) => !['pensao','investimento','credito'].includes(c.tipo))
  const contasPensao = (contas || []).filter((c) => c.tipo === 'pensao')
  const contasInvest = (contas || []).filter((c) => c.tipo === 'investimento')

  const saldoTotal = contasPrincipais
    .reduce((s, c) => s + calcularSaldoConta(c, transacoes), 0)

  const passouDoLimite = limiteGastosMensal > 0 && despesasMes > limiteGastosMensal

  // Mostra as últimas 8 transações dos últimos 30 dias (não só mês atual)
  const hoje = new Date()
  const ha30Dias = new Date(hoje)
  ha30Dias.setDate(hoje.getDate() - 30)
  const ha30DiasStr = ha30Dias.toISOString().slice(0, 10)
  const ultimasTransacoes = [...transacoes]
    .filter((t) => t.data >= ha30DiasStr)
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 8)

  return (
    <div style={{ padding: '8px 14px 8px', background: '#0F172A' }}>

      {passouDoLimite && (
        <div style={{ background: '#7F1D1D', border: '1px solid #EF4444', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
          <p style={{ color: '#fff', fontSize: 12 }}>⚠️ Limite de {formatarMoeda(limiteGastosMensal)} ultrapassado este mês.</p>
        </div>
      )}

      {/* Card principal */}
      <div style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
        <p style={{ color: '#E0E7FF', fontSize: 11, marginBottom: 2 }}>Saldo disponível</p>
        <p style={{ color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 4 }}>{formatarMoeda(saldoTotal)}</p>
        <p style={{ color: '#E0E7FF', fontSize: 11 }}>Este mês: receitas {formatarMoeda(receitasMes)} · despesas {formatarMoeda(despesasMes)}</p>
      </div>

      {/* Receitas e Despesas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 12, padding: '10px 12px' }}>
          <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2 }}>Receitas</p>
          <p style={{ color: '#22C55E', fontSize: 15, fontWeight: 600 }}>{formatarMoeda(receitasMes)}</p>
        </div>
        <div style={{ flex: 1, background: '#1E293B', borderRadius: 12, padding: '10px 12px' }}>
          <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 2 }}>Despesas</p>
          <p style={{ color: '#EF4444', fontSize: 15, fontWeight: 600 }}>{formatarMoeda(despesasMes)}</p>
        </div>
      </div>

      {/* Saldo por conta */}
      {(contas || []).length > 0 && (() => {
        const renderLinha = (conta) => {
          const tipo = infoTipoConta(conta.tipo)
          const saldoCalculado = calcularSaldoConta(conta, transacoes)
          return (
            <div key={conta.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <p style={{ color: '#fff', fontSize: 12 }}>{tipo.icone} {conta.nome}</p>
              <p style={{ color: saldoCalculado >= 0 ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>{formatarMoeda(saldoCalculado)}</p>
            </div>
          )
        }
        return (
          <>
            {contasPrincipais.length > 0 && (
              <div style={{ background: '#1E293B', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 8 }}>Minhas contas</p>
                {contasPrincipais.map(renderLinha)}
              </div>
            )}
            {contasPensao.length > 0 && (
              <div style={{ background: '#1E293B', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 8 }}>👶 Pensão dos filhos <span style={{ fontSize: 10, color: '#64748B' }}>(separado)</span></p>
                {contasPensao.map(renderLinha)}
              </div>
            )}
            {contasInvest.length > 0 && (
              <div style={{ background: '#1E293B', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
                <p style={{ color: '#94A3B8', fontSize: 11, marginBottom: 8 }}>📈 Investimentos <span style={{ fontSize: 10, color: '#64748B' }}>(separado)</span></p>
                {contasInvest.map(renderLinha)}
              </div>
            )}
          </>
        )
      })()}

      {/* Últimas transações */}
      <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 6 }}>Últimas transações</p>
      {ultimasTransacoes.length === 0 && (
        <p style={{ color: '#64748B', fontSize: 13 }}>Nenhuma transação este mês ainda.</p>
      )}
      {ultimasTransacoes.map((t) => {
        const cat = infoCategoria(t.tipo, t.categoria)
        const contaTransacao = (contas || []).find((c) => c.id === t.contaId)
        return (
          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1E293B', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15 }}>{cat.icone}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: '#fff', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.descricao} {t.fixa && '📌'}
                </p>
                <p style={{ color: '#64748B', fontSize: 10 }}>
                  {cat.label}{contaTransacao ? ` · ${contaTransacao.nome}` : ''} · {t.data}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <p style={{ color: t.tipo === 'receita' ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
                {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
              </p>
              <button onClick={() => onEditar(t)} style={{ background: 'transparent', border: 'none', fontSize: 13, padding: 4 }}>✏️</button>
              <button onClick={() => onExcluir(t.id)} style={{ background: 'transparent', border: 'none', fontSize: 13, padding: 4 }}>🗑️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Adicionar ----------

function Adicionar({ onAdicionar, onEditar, onCancelarEdicao, transacaoInicial, filhos, contas }) {
  const [tipo, setTipo] = useState(transacaoInicial?.tipo || 'despesa')
  const [categoria, setCategoria] = useState(transacaoInicial?.categoria || CATEGORIAS_DESPESA[0].id)
  const [descricao, setDescricao] = useState(transacaoInicial?.descricao || '')
  const [valor, setValor] = useState(transacaoInicial ? String(transacaoInicial.valor) : '')
  const [data, setData] = useState(transacaoInicial?.data || new Date().toISOString().slice(0, 10))
  const [fixa, setFixa] = useState(transacaoInicial?.fixa || false)
  const [filhoId, setFilhoId] = useState(transacaoInicial?.filhoId || '')
  const [contaId, setContaId] = useState(transacaoInicial?.contaId || '')

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
      contaId: contaId || null,
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
    <div style={{ padding: 16, background: '#0F172A', minHeight: '100vh', paddingTop: 'max(env(safe-area-inset-top,0px),52px)' }}>
      <h1 style={{ fontSize: 18, marginBottom: 16, color: '#fff' }}>
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

      {contas && contas.length > 0 && (
        <>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>
            {tipo === 'receita' ? 'Entrou em qual conta?' : 'Saiu de qual conta?'}
          </label>
          <select style={inputStyle} value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Não especificar</option>
            {contas.map((c) => {
              const info = infoTipoConta(c.tipo)
              return (
                <option key={c.id} value={c.id}>
                  {info.icone} {c.nome}
                </option>
              )
            })}
          </select>
        </>
      )}

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
    <div style={{ padding: 16, background: '#0F172A', minHeight: '100vh' }}>
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

// ---------- Componente: Formulário Nova Conta ----------

function FormNovaConta({ onSalvar, onCancelar, contaInicial, filhos }) {
  const [nome, setNome] = useState(contaInicial?.nome || '')
  const [tipo, setTipo] = useState(contaInicial?.tipo || 'corrente')
  const [banco, setBanco] = useState(contaInicial?.banco || '')
  const [saldo, setSaldo] = useState(contaInicial?.saldo != null ? String(contaInicial.saldo) : '')
  const [filhoId, setFilhoId] = useState(contaInicial?.filhoId || '')
  const [diaFechamento, setDiaFechamento] = useState(contaInicial?.diaFechamento ? String(contaInicial.diaFechamento) : '')
  const [diaVencimento, setDiaVencimento] = useState(contaInicial?.diaVencimento ? String(contaInicial.diaVencimento) : '')

  const emEdicao = Boolean(contaInicial)
  const ehCredito = tipo === 'credito'

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #334155', background: '#0F172A',
    color: '#fff', fontSize: 15, marginBottom: 14, boxSizing: 'border-box',
  }

  function handleSalvar() {
    if (!nome.trim()) { alert('Preencha o nome da conta.'); return }
    if (ehCredito && (!diaFechamento || !diaVencimento)) {
      alert('Preencha o dia de fechamento e vencimento.'); return
    }
    onSalvar({
      id: emEdicao ? contaInicial.id : Date.now(),
      nome: nome.trim(),
      tipo,
      banco: banco.trim(),
      saldoBase: saldo !== '' ? Number(saldo) : 0,
      saldo: saldo !== '' ? Number(saldo) : 0,
      filhoId: tipo === 'pensao' ? filhoId : null,
      diaFechamento: diaFechamento ? Number(diaFechamento) : null,
      diaVencimento: diaVencimento ? Number(diaVencimento) : null,
      faturas: contaInicial?.faturas || {},
    })
  }

  return (
    <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 16 }}>
      <p style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        {emEdicao ? 'Editar conta' : 'Nova conta'}
      </p>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Tipo</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {TIPOS_CONTA.map((t) => (
          <button
            key={t.id}
            onClick={() => setTipo(t.id)}
            style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 12,
              background: tipo === t.id ? '#6366F1' : '#0F172A',
              color: '#fff', fontWeight: tipo === t.id ? 700 : 400,
            }}
          >
            {t.icone} {t.label}
          </button>
        ))}
      </div>

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Nome</label>
      <input style={inputStyle} placeholder="Ex: Pensão Sofia, Nubank..." value={nome} onChange={(e) => setNome(e.target.value)} />

      {tipo === 'pensao' && filhos && filhos.length > 0 && (
        <>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>Referente a qual filho(a)?</label>
          <select style={inputStyle} value={filhoId} onChange={(e) => setFilhoId(e.target.value)}>
            <option value="">Não especificar</option>
            {filhos.map((f) => (
              <option key={f.id} value={f.id}>{f.icone} {f.nome}</option>
            ))}
          </select>
        </>
      )}

      <label style={{ color: '#94A3B8', fontSize: 13 }}>Banco / Operadora (opcional)</label>
      <input style={inputStyle} placeholder="Ex: Nubank, Sodexo..." value={banco} onChange={(e) => setBanco(e.target.value)} />

      {tipo !== 'credito' && (
        <>
          <label style={{ color: '#94A3B8', fontSize: 13 }}>
            {tipo === 'pensao' ? 'Saldo atual da pensão (R$)' : tipo === 'investimento' ? 'Valor investido (R$)' : 'Saldo atual (R$)'}
          </label>
          <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
        </>
      )}

      {ehCredito && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#94A3B8', fontSize: 13 }}>Dia fechamento</label>
            <input style={inputStyle} type="number" inputMode="numeric" placeholder="Ex: 20" value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#94A3B8', fontSize: 13 }}>Dia vencimento</label>
            <input style={inputStyle} type="number" inputMode="numeric" placeholder="Ex: 27" value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancelar} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}>Cancelar</button>
        <button onClick={handleSalvar} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}>{emEdicao ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  )
}

// ---------- Componente: Contas e Cartões ----------

function Contas({ contas, transacoes, onAdicionarConta, onEditarConta, onExcluirConta, filhos }) {
  const [modoForm, setModoForm] = useState(null)
  const [contaExpandida, setContaExpandida] = useState(null)
  const [editandoFatura, setEditandoFatura] = useState(null)
  const [valorFaturaInput, setValorFaturaInput] = useState('')

  const hoje = new Date()
  const chaveMesAtual = mesAtual()

  function diasAte(dia) {
    if (!dia) return 99
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), dia)
    if (alvo < hoje) alvo.setMonth(alvo.getMonth() + 1)
    return Math.ceil((alvo - hoje) / (1000 * 60 * 60 * 24))
  }

  function handleSalvarFatura(conta) {
    const valor = Number(valorFaturaInput)
    if (valorFaturaInput === '' || valor < 0) { alert('Digite um valor válido.'); return }
    if (conta.tipo === 'credito') {
      onEditarConta({ ...conta, faturas: { ...conta.faturas, [chaveMesAtual]: valor } })
    } else {
      // O usuário digita o saldo ATUAL que quer ver.
      // Calculamos o saldoBase necessário para que: saldoBase + transações = valorDesejado
      const efeitoTransacoes = transacoes
        .filter((t) => t.contaId === conta.id)
        .reduce((s, t) => s + (t.tipo === 'receita' ? t.valor : -t.valor), 0)
      const novoSaldoBase = valor - efeitoTransacoes
      onEditarConta({ ...conta, saldoBase: novoSaldoBase, saldo: valor })
    }
    setEditandoFatura(null)
    setValorFaturaInput('')
  }

  return (
    <div style={{ padding: '8px 14px', background: '#0F172A', minHeight: '100vh', paddingTop: 'max(env(safe-area-inset-top,0px),52px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, color: '#fff' }}>Contas e Cartões</h1>
        {!modoForm && (
          <button onClick={() => setModoForm('novo')} style={{ background: '#6366F1', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>+ Conta</button>
        )}
      </div>

      {modoForm === 'novo' && (
        <FormNovaConta filhos={filhos} onSalvar={(c) => { onAdicionarConta(c); setModoForm(null) }} onCancelar={() => setModoForm(null)} />
      )}
      {modoForm && modoForm !== 'novo' && (
        <FormNovaConta filhos={filhos} contaInicial={modoForm} onSalvar={(c) => { onEditarConta(c); setModoForm(null) }} onCancelar={() => setModoForm(null)} />
      )}

      {contas.length === 0 && !modoForm && (
        <p style={{ color: '#64748B', fontSize: 13 }}>Nenhuma conta cadastrada. Toque em "+ Conta" pra começar.</p>
      )}

      {contas.map((conta) => {
        const info = infoTipoConta(conta.tipo)
        const ehCredito = conta.tipo === 'credito'
        const faturaMes = ehCredito ? (conta.faturas?.[chaveMesAtual] ?? null) : null
        const expandida = contaExpandida === conta.id
        const cores = corDoBanco(conta.banco || conta.nome)
        const diasFech = ehCredito ? diasAte(conta.diaFechamento) : null
        const diasVenc = ehCredito ? diasAte(conta.diaVencimento) : null

        return (
          <div key={conta.id} style={{ marginBottom: 12 }}>
            <div style={{
              background: ehCredito
                ? `linear-gradient(135deg, ${cores[0]}, ${cores[1]})`
                : '#1E293B',
              borderRadius: 14,
              padding: 14,
            }}>
              <button
                onClick={() => setContaExpandida(expandida ? null : conta.id)}
                style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
                    {info.icone} {conta.nome}
                  </p>
                  {ehCredito && conta.diaVencimento && (
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Vence dia {conta.diaVencimento}</p>
                  )}
                </div>
                {ehCredito ? (
                  <>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Fatura deste mês</p>
                    <p style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
                      {faturaMes !== null ? formatarMoeda(faturaMes) : '—'}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ color: '#94A3B8', fontSize: 11 }}>Saldo atual</p>
                    <p style={{ color: calcularSaldoConta(conta, transacoes) >= 0 ? '#22C55E' : '#EF4444', fontSize: 20, fontWeight: 700 }}>
                      {formatarMoeda(calcularSaldoConta(conta, transacoes))}
                    </p>
                    {(conta.saldoBase ?? conta.saldo ?? 0) !== 0 && (
                      <p style={{ color: '#64748B', fontSize: 10 }}>base: {formatarMoeda(conta.saldoBase ?? conta.saldo ?? 0)}</p>
                    )}
                  </>
                )}
              </button>

              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button
                    onClick={() => {
                      setEditandoFatura(conta.id)
                      setValorFaturaInput(ehCredito ? (faturaMes !== null ? String(faturaMes) : '') : String(calcularSaldoConta(conta, transacoes)))
                    }}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: ehCredito ? 'rgba(255,255,255,0.2)' : '#0F172A', color: '#fff', fontWeight: 600, fontSize: 12 }}
                  >
                    {ehCredito ? '💳 Atualizar fatura' : '✏️ Atualizar saldo'}
                  </button>
                <button onClick={() => setModoForm(conta)} style={{ padding: 8, borderRadius: 8, border: 'none', background: ehCredito ? 'rgba(255,255,255,0.15)' : '#0F172A', color: '#fff', fontSize: 13 }}>✏️</button>
                <button
                  onClick={() => { if (window.confirm(`Excluir "${conta.nome}"?`)) onExcluirConta(conta.id) }}
                  style={{ padding: 8, borderRadius: 8, border: 'none', background: ehCredito ? 'rgba(255,255,255,0.15)' : '#0F172A', color: '#fff', fontSize: 13 }}
                >
                  🗑️
                </button>
              </div>

              {editandoFatura === conta.id && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    type="number"
                    inputMode="decimal"
                    placeholder="Valor total da fatura (R$)"
                    value={valorFaturaInput}
                    onChange={(e) => setValorFaturaInput(e.target.value)}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14 }}
                  />
                  <button onClick={() => handleSalvarFatura(conta)} style={{ background: '#fff', border: 'none', color: cores[0], borderRadius: 10, padding: '0 14px', fontWeight: 700 }}>OK</button>
                  <button onClick={() => setEditandoFatura(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 10, padding: '0 10px' }}>✕</button>
                </div>
              )}
            </div>

            {expandida && ehCredito && (
              <div style={{ background: '#1E293B', borderRadius: 12, padding: 14, marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ flex: 1, background: '#0F172A', borderRadius: 10, padding: 10 }}>
                    <p style={{ color: '#94A3B8', fontSize: 10 }}>Fechamento</p>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Dia {conta.diaFechamento}</p>
                    <p style={{ color: diasFech <= 3 ? '#EF4444' : '#64748B', fontSize: 11 }}>em {diasFech} {diasFech === 1 ? 'dia' : 'dias'}</p>
                  </div>
                  <div style={{ flex: 1, background: '#0F172A', borderRadius: 10, padding: 10 }}>
                    <p style={{ color: '#94A3B8', fontSize: 10 }}>Vencimento</p>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>Dia {conta.diaVencimento}</p>
                    <p style={{ color: diasVenc <= 5 ? '#F59E0B' : '#64748B', fontSize: 11 }}>em {diasVenc} {diasVenc === 1 ? 'dia' : 'dias'}</p>
                  </div>
                </div>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>Histórico</p>
                {Object.entries(conta.faturas || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([chave, valor]) => {
                  const [ano, mes] = chave.split('-')
                  return (
                    <div key={chave} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155' }}>
                      <p style={{ color: '#94A3B8', fontSize: 12 }}>{NOMES_MESES[Number(mes) - 1]} {ano}{chave === chaveMesAtual ? ' • atual' : ''}</p>
                      <p style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{formatarMoeda(valor)}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {expandida && !ehCredito && (
              <div style={{ background: '#1E293B', borderRadius: 12, padding: 14, marginTop: 6 }}>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>Últimas movimentações</p>
                {transacoes.filter((t) => t.contaId === conta.id).length === 0 && (
                  <p style={{ color: '#64748B', fontSize: 12 }}>Nenhuma transação vinculada ainda.</p>
                )}
                {[...transacoes.filter((t) => t.contaId === conta.id)]
                  .sort((a, b) => new Date(b.data) - new Date(a.data))
                  .slice(0, 8)
                  .map((t) => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155' }}>
                      <p style={{ color: '#fff', fontSize: 12 }}>{t.descricao}</p>
                      <p style={{ color: t.tipo === 'receita' ? '#22C55E' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
                        {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
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
    <div style={{ padding: 16, background: '#0F172A', minHeight: '100vh', paddingTop: 'max(env(safe-area-inset-top,0px),52px)' }}>
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

function Assistente({ transacoes, metas, reserva, contas, onVoltar }) {
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
      const contexto = construirContextoIA(transacoes, metas, reserva, contas)
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
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box', background: '#0F172A', paddingTop: 'max(env(safe-area-inset-top,0px),52px)' }}>
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

// ---------- Componente: Tela de Bloqueio ----------

function TelaBloqueio({ segurancaConfig, frase, onDesbloquear }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)

  async function handleConfirmar(pinDigitado) {
    const hash = await gerarHashPin(pinDigitado)
    if (hash === segurancaConfig.pinHash) {
      onDesbloquear()
    } else {
      setErro(true)
      setPin('')
      setTimeout(() => setErro(false), 1000)
    }
  }

  function handleTocarNumero(digito) {
    if (pin.length >= 4) return
    const novoPin = pin + digito
    setPin(novoPin)
    if (novoPin.length === 4) {
      handleConfirmar(novoPin)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ fontSize: 32, marginBottom: 12 }}>🌿</p>
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Mali</p>
      <p style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>Digite seu PIN</p>
      {frase && (
        <p style={{ color: '#6366F1', fontSize: 13, marginBottom: 20, fontStyle: 'italic', textAlign: 'center', maxWidth: 260 }}>
          "{frase}"
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 16,
              background: pin.length > i ? (erro ? '#EF4444' : '#6366F1') : '#1E293B',
              border: '1px solid #334155',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: 240 }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((tecla, i) =>
          tecla === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (tecla === '⌫' ? setPin(pin.slice(0, -1)) : handleTocarNumero(tecla))}
              style={{
                width: 68,
                height: 68,
                borderRadius: 68,
                border: 'none',
                background: '#1E293B',
                color: '#fff',
                fontSize: 20,
              }}
            >
              {tecla}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ---------- Componente: Configurações ----------

function Configuracoes({ segurancaConfig, onSalvarSeguranca, onRemoverSeguranca, preferencias, onSalvarPreferencias, onVoltar }) {
  const [senhaAberta, setSenhaAberta] = useState(false)
  const [etapa, setEtapa] = useState(segurancaConfig ? 'ativo' : 'inativo') // inativo | definirNovo | ativo | remover
  const [novoPin, setNovoPin] = useState('')
  const [confirmarPin, setConfirmarPin] = useState('')
  const [pinAtualParaRemover, setPinAtualParaRemover] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [notificarVencimentos, setNotificarVencimentos] = useState(preferencias?.notificarVencimentos ?? true)
  const [limiteGastosMensal, setLimiteGastosMensal] = useState(
    preferencias?.limiteGastosMensal ? String(preferencias.limiteGastosMensal) : ''
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
    letterSpacing: 4,
  }

  async function handleDefinirPin() {
    if (novoPin.length !== 4 || !/^\d{4}$/.test(novoPin)) {
      setMensagem('O PIN precisa ter exatamente 4 números.')
      return
    }
    if (novoPin !== confirmarPin) {
      setMensagem('Os PINs não coincidem.')
      return
    }
    const hash = await gerarHashPin(novoPin)
    onSalvarSeguranca({ pinHash: hash })
    setEtapa('ativo')
    setMensagem('')
    setNovoPin('')
    setConfirmarPin('')
  }

  async function handleRemoverPin() {
    const hash = await gerarHashPin(pinAtualParaRemover)
    if (hash !== segurancaConfig.pinHash) {
      setMensagem('PIN incorreto.')
      return
    }
    onRemoverSeguranca()
    setEtapa('inativo')
    setPinAtualParaRemover('')
    setMensagem('')
  }

  function handleSalvarNotificacoes(valor) {
    setNotificarVencimentos(valor)
    onSalvarPreferencias({ notificarVencimentos: valor, limiteGastosMensal: Number(limiteGastosMensal) || 0 })
  }

  function handleSalvarLimite() {
    onSalvarPreferencias({ notificarVencimentos, limiteGastosMensal: Number(limiteGastosMensal) || 0 })
  }

  return (
    <div style={{ padding: 16, background: '#0F172A', minHeight: '100vh', paddingTop: 'max(env(safe-area-inset-top,0px),52px)' }}>
      <button
        onClick={onVoltar}
        style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: 14, marginBottom: 12, padding: 0 }}
      >
        ‹ Voltar
      </button>
      <h1 style={{ fontSize: 20, color: '#fff', marginBottom: 20 }}>⚙️ Configurações</h1>

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>🔔 Notificações</p>
      <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontSize: 14 }}>Avisar sobre contas próximas do vencimento</span>
          <input
            type="checkbox"
            checked={notificarVencimentos}
            onChange={(e) => handleSalvarNotificacoes(e.target.checked)}
            style={{ width: 20, height: 20 }}
          />
        </label>
        <p style={{ color: '#64748B', fontSize: 11, marginTop: 8 }}>
          Quando ativado, mostra um aviso na tela inicial se houver contas fixas vencendo nos próximos dias.
        </p>
      </div>

      <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 8 }}>💸 Limite de gastos mensal</p>
      <div style={{ background: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <label style={{ color: '#94A3B8', fontSize: 13 }}>Avisar quando os gastos do mês passarem de (R$)</label>
        <input
          style={inputStyle}
          type="number"
          inputMode="decimal"
          placeholder="Ex: 2000 (deixe vazio pra desativar)"
          value={limiteGastosMensal}
          onChange={(e) => setLimiteGastosMensal(e.target.value)}
        />
        <button
          onClick={handleSalvarLimite}
          style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
        >
          Salvar limite
        </button>
      </div>

      <button
        onClick={() => setSenhaAberta(!senhaAberta)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          color: '#64748B',
          fontSize: 12,
          padding: '8px 0',
          marginBottom: senhaAberta ? 8 : 0,
        }}
      >
        {senhaAberta ? '▾' : '▸'} Adicionar senha ao abrir o app {segurancaConfig ? '(ativada)' : ''}
      </button>

      {senhaAberta && (
        <>
          {etapa === 'inativo' && (
            <div style={{ background: '#1E293B', borderRadius: 14, padding: 16 }}>
              <p style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>
                Nenhum PIN configurado. Quem abrir o app no seu celular vê suas finanças direto.
              </p>
              <button
                onClick={() => setEtapa('definirNovo')}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
              >
                Criar PIN de 4 dígitos
              </button>
            </div>
          )}

          {etapa === 'definirNovo' && (
            <div style={{ background: '#1E293B', borderRadius: 14, padding: 16 }}>
              <label style={{ color: '#94A3B8', fontSize: 13 }}>Novo PIN (4 números)</label>
              <input
                style={inputStyle}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={novoPin}
                onChange={(e) => setNovoPin(e.target.value.replace(/\D/g, ''))}
              />
              <label style={{ color: '#94A3B8', fontSize: 13 }}>Confirme o PIN</label>
              <input
                style={inputStyle}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmarPin}
                onChange={(e) => setConfirmarPin(e.target.value.replace(/\D/g, ''))}
              />
              {mensagem && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{mensagem}</p>}
              <button
                onClick={handleDefinirPin}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
              >
                Salvar PIN
              </button>
            </div>
          )}

          {etapa === 'ativo' && (
            <div style={{ background: '#1E293B', borderRadius: 14, padding: 16 }}>
              <p style={{ color: '#22C55E', fontSize: 13, marginBottom: 12 }}>✅ PIN ativado — o app pede o PIN toda vez que abrir.</p>
              <button
                onClick={() => setEtapa('remover')}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #EF4444', background: 'transparent', color: '#EF4444', fontWeight: 600 }}
              >
                Remover PIN
              </button>
            </div>
          )}

          {etapa === 'remover' && (
            <div style={{ background: '#1E293B', borderRadius: 14, padding: 16 }}>
              <label style={{ color: '#94A3B8', fontSize: 13 }}>Digite o PIN atual pra confirmar</label>
              <input
                style={inputStyle}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinAtualParaRemover}
                onChange={(e) => setPinAtualParaRemover(e.target.value.replace(/\D/g, ''))}
              />
              {mensagem && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{mensagem}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setEtapa('ativo')}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#334155', color: '#fff', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRemoverPin}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#EF4444', color: '#fff', fontWeight: 700 }}
                >
                  Remover
                </button>
              </div>
            </div>
          )}

          <p style={{ color: '#64748B', fontSize: 12, marginTop: 16 }}>
            Nota: o PIN protege contra quem pega seu celular casualmente, mas os dados continuam
            guardados no navegador sem criptografia forte. Biometria fica pra uma fase futura.
          </p>
        </>
      )}
    </div>
  )
}

// ---------- Componente: Aviso de Privacidade (LGPD) ----------

function AvisoPrivacidade({ onAceitar }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#1E293B',
        borderTop: '1px solid #334155',
        padding: 20,
        zIndex: 1000,
      }}
    >
      <p style={{ color: '#fff', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
        🔒 Seus dados ficam só no seu celular
      </p>
      <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
        O Mali guarda suas informações apenas no navegador deste aparelho — não enviamos nada
        pra nenhum servidor. A única exceção é o Assistente com IA: nesse caso, um resumo
        financeiro (sem lista de transações) é enviado só no momento da pergunta.
      </p>
      <button
        onClick={onAceitar}
        style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700 }}
      >
        Entendi
      </button>
    </div>
  )
}

// ---------- Componente: Boas-vindas (onboarding) ----------

function TelaBoasVindas({ onConcluir }) {
  const [nome, setNome] = useState('')
  const [frase, setFrase] = useState('')

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#1E293B',
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    boxSizing: 'border-box',
  }

  function handleContinuar() {
    if (!nome.trim()) {
      alert('Como você gostaria de ser chamada?')
      return
    }
    onConcluir({
      nome: nome.trim(),
      frase: frase.trim() || 'Seu dinheiro, suas regras',
    })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 28,
        fontFamily: 'system-ui, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <p style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}>🌿</p>
      <p style={{ color: '#fff', fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
        Mali
      </p>
      <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginBottom: 32 }}>
        o controle descomplicado das suas finanças
      </p>

      <label style={{ color: '#94A3B8', fontSize: 13, marginBottom: 6, display: 'block' }}>
        Como você gostaria de ser chamada?
      </label>
      <input
        style={inputStyle}
        placeholder="Seu nome ou apelido"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <label style={{ color: '#94A3B8', fontSize: 13, marginBottom: 6, display: 'block' }}>
        Crie uma frase pessoal (opcional)
      </label>
      <input
        style={inputStyle}
        placeholder="Ex: Minha reserva, meu orgulho"
        value={frase}
        onChange={(e) => setFrase(e.target.value)}
      />
      <p style={{ color: '#64748B', fontSize: 12, marginBottom: 24 }}>
        Essa frase vai aparecer na tela de PIN, se você ativar uma. Serve pra você reconhecer na hora
        que é realmente o seu app, e não uma tela falsa tentando copiar ele.
      </p>

      <button
        onClick={handleContinuar}
        style={{ width: '100%', padding: 16, borderRadius: 10, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 700, fontSize: 16 }}
      >
        Começar
      </button>
    </div>
  )
}

// ---------- Componente: Início (Dashboard + Calendário + Relatórios) ----------

function Inicio({
  transacoes,
  onEditar,
  onExcluir,
  nome,
  preferencias,
  contas,
  onAbrirFilhos,
  onAbrirPlanejamento,
  onAbrirConfiguracoes,
  onAbrirAssistente,
}) {
  const [subAba, setSubAba] = useState('geral')

  const hoje = new Date()
  const chaveMesAtual = mesAtual()
  const hojeStr = new Date().toISOString().slice(0, 10)
  const emSeteDias = new Date()
  emSeteDias.setDate(emSeteDias.getDate() + 7)
  const emSeteDiasStr = emSeteDias.toISOString().slice(0, 10)

  // Contas fixas vencendo nos próximos 7 dias
  const vencimentosProximos = itensDoMesComProjecao(
    transacoes,
    Number(chaveMesAtual.split('-')[0]),
    Number(chaveMesAtual.split('-')[1])
  ).filter((t) => t.tipo === 'despesa' && t.data >= hojeStr && t.data <= emSeteDiasStr)

  // Cartões com fechamento OU vencimento nos próximos 5 dias
  const cartoesFechandoEm5Dias = (contas || []).filter((c) => {
    const diaHoje = hoje.getDate()
    const diffFechamento = c.diaFechamento >= diaHoje
      ? c.diaFechamento - diaHoje
      : new Date(hoje.getFullYear(), hoje.getMonth() + 1, c.diaFechamento).getDate() + (30 - diaHoje)
    const diffVencimento = c.diaVencimento >= diaHoje
      ? c.diaVencimento - diaHoje
      : 99
    return diffFechamento <= 5 || diffVencimento <= 5
  })

  const subAbas = [
    { id: 'geral', label: 'Visão geral' },
    { id: 'calendario', label: 'Calendário' },
    { id: 'relatorios', label: 'Relatórios' },
  ]

  return (
    <div>
      <div style={{
        padding: '0 14px 0',
        paddingTop: 'max(env(safe-area-inset-top, 0px), 52px)',
        background: '#0F172A',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Olá, {nome}! 👋</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={onAbrirFilhos}
              aria-label="Filhos"
              style={{ background: '#1E293B', border: 'none', fontSize: 16, padding: '6px 8px', borderRadius: 8 }}
            >
              👶
            </button>
            <button
              onClick={onAbrirPlanejamento}
              aria-label="Planejamento"
              style={{ background: '#1E293B', border: 'none', fontSize: 16, padding: '6px 8px', borderRadius: 8 }}
            >
              📋
            </button>
            <button
              onClick={onAbrirAssistente}
              aria-label="Assistente IA"
              style={{ background: '#1E293B', border: 'none', fontSize: 16, padding: '6px 8px', borderRadius: 8 }}
            >
              🤖
            </button>
            <button
              onClick={onAbrirConfiguracoes}
              aria-label="Configurações"
              style={{ background: '#1E293B', border: 'none', fontSize: 16, padding: '6px 8px', borderRadius: 8 }}
            >
              ⚙️
            </button>
          </div>
        </div>

        {preferencias?.notificarVencimentos && vencimentosProximos.length > 0 && (
          <div style={{ background: '#1E293B', border: '1px solid #F59E0B', borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <p style={{ color: '#F59E0B', fontSize: 12 }}>
              🔔 {vencimentosProximos.length === 1 ? '1 conta vence' : `${vencimentosProximos.length} contas vencem`} nos próximos 7 dias
            </p>
          </div>
        )}

        {cartoesFechandoEm5Dias.length > 0 && (
          <div style={{ background: '#1E293B', border: '1px solid #6366F1', borderRadius: 12, padding: 12, marginBottom: 8 }}>
            {cartoesFechandoEm5Dias.map((c) => {
              const diaHoje = hoje.getDate()
              const fechandoEm = c.diaFechamento >= diaHoje ? c.diaFechamento - diaHoje : null
              const vencendoEm = c.diaVencimento >= diaHoje ? c.diaVencimento - diaHoje : null
              return (
                <p key={c.id} style={{ color: '#A5B4FC', fontSize: 12, marginBottom: 4 }}>
                  💳 {c.nome}:
                  {fechandoEm !== null && fechandoEm <= 5 && ` fecha em ${fechandoEm === 0 ? 'hoje' : `${fechandoEm} dia${fechandoEm > 1 ? 's' : ''}`} — atualize a fatura!`}
                  {vencendoEm !== null && vencendoEm <= 5 && ` vence em ${vencendoEm === 0 ? 'hoje' : `${vencendoEm} dia${vencendoEm > 1 ? 's' : ''}`}!`}
                </p>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 4, marginBottom: 6, background: '#1E293B', borderRadius: 10, padding: 3 }}>
          {subAbas.map((s) => (
            <button
              key={s.id}
              onClick={() => setSubAba(s.id)}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: 8,
                border: 'none',
                background: subAba === s.id ? '#6366F1' : 'transparent',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {subAba === 'geral' && (
        <Dashboard
          transacoes={transacoes}
          onEditar={onEditar}
          onExcluir={onExcluir}
          limiteGastosMensal={preferencias?.limiteGastosMensal || 0}
          contas={contas}
        />
      )}
      {subAba === 'calendario' && <Calendario transacoes={transacoes} />}
      {subAba === 'relatorios' && <Relatorios transacoes={transacoes} />}
    </div>
  )
}

// ---------- Componente: Botão Flutuante ----------

function BotaoFlutuante({ icone, onClick, cor, posicaoInferior }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        right: 20,
        bottom: posicaoInferior,
        width: 56,
        height: 56,
        borderRadius: 56,
        border: 'none',
        background: cor,
        color: '#fff',
        fontSize: 22,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 900,
      }}
    >
      {icone}
    </button>
  )
}

// ---------- Componente: FormNovaMeta ----------

function FormNovaMeta({ onSalvar, onCancelar, metaInicial }) {
  const [nome, setNome] = useState(metaInicial?.nome || '')
  const [valorAlvo, setValorAlvo] = useState(metaInicial ? String(metaInicial.valorAlvo) : '')
  const [valorAtual, setValorAtual] = useState(metaInicial ? String(metaInicial.valorAtual) : '0')
  const [icone, setIcone] = useState(metaInicial?.icone || '🎯')
  const emEdicao = Boolean(metaInicial)
  const iconesDisponiveis = ['🎯','✈️','🚗','🏠','🎓','💍','🎂','🚨','🛡️']
  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #334155', background:'#0F172A', color:'#fff', fontSize:15, marginBottom:14, boxSizing:'border-box' }

  function handleSalvar() {
    if (!nome.trim() || !valorAlvo || Number(valorAlvo) <= 0) { alert('Preencha o nome e valor alvo.'); return }
    onSalvar({ id: emEdicao ? metaInicial.id : Date.now(), nome: nome.trim(), valorAlvo: Number(valorAlvo), valorAtual: Number(valorAtual) || 0, icone })
  }

  return (
    <div style={{ background:'#1E293B', borderRadius:14, padding:16, marginBottom:16 }}>
      <p style={{ color:'#fff', fontSize:15, fontWeight:600, marginBottom:12 }}>{emEdicao ? 'Editar meta' : 'Nova meta'}</p>
      <label style={{ color:'#94A3B8', fontSize:13 }}>Ícone</label>
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        {iconesDisponiveis.map((ic) => (
          <button key={ic} onClick={() => setIcone(ic)} style={{ fontSize:18, padding:8, borderRadius:8, border: icone === ic ? '2px solid #6366F1' : '2px solid transparent', background:'#0F172A' }}>{ic}</button>
        ))}
      </div>
      <label style={{ color:'#94A3B8', fontSize:13 }}>Nome da meta</label>
      <input style={inputStyle} placeholder="Ex: Viagem, Carro..." value={nome} onChange={(e) => setNome(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Valor alvo (R$)</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Já guardado (R$)</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancelar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#334155', color:'#fff', fontWeight:600 }}>Cancelar</button>
        <button onClick={handleSalvar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#6366F1', color:'#fff', fontWeight:700 }}>{emEdicao ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  )
}

// ---------- Componente: Reserva de emergência ----------

function FormReserva({ onSalvar, onCancelar, reservaInicial, despesaMediaMensal }) {
  const [valorAtual, setValorAtual] = useState(reservaInicial ? String(reservaInicial.valorAtual) : '0')
  const [mesesDesejados, setMesesDesejados] = useState(reservaInicial ? String(reservaInicial.mesesDesejados) : '6')
  const [aporteMensalPlanejado, setAporteMensalPlanejado] = useState(reservaInicial ? String(reservaInicial.aporteMensalPlanejado) : '')
  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #334155', background:'#0F172A', color:'#fff', fontSize:15, marginBottom:14, boxSizing:'border-box' }

  function handleSalvar() {
    if (!mesesDesejados || Number(mesesDesejados) <= 0) { alert('Informe quantos meses.'); return }
    onSalvar({ valorAtual: Number(valorAtual) || 0, mesesDesejados: Number(mesesDesejados), aporteMensalPlanejado: Number(aporteMensalPlanejado) || 0 })
  }

  return (
    <div style={{ background:'#1E293B', borderRadius:14, padding:16, marginBottom:16 }}>
      <p style={{ color:'#fff', fontSize:14, fontWeight:600, marginBottom:4 }}>🛡️ Configurar reserva</p>
      <p style={{ color:'#64748B', fontSize:12, marginBottom:12 }}>Média mensal: {formatarMoeda(despesaMediaMensal)}</p>
      <label style={{ color:'#94A3B8', fontSize:13 }}>Quantos meses de despesas guardar?</label>
      <input style={inputStyle} type="number" inputMode="numeric" placeholder="6" value={mesesDesejados} onChange={(e) => setMesesDesejados(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Já guardado (R$)</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Quanto guardar por mês? (opcional)</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={aporteMensalPlanejado} onChange={(e) => setAporteMensalPlanejado(e.target.value)} />
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancelar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#334155', color:'#fff', fontWeight:600 }}>Cancelar</button>
        <button onClick={handleSalvar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#6366F1', color:'#fff', fontWeight:700 }}>Salvar</button>
      </div>
    </div>
  )
}

function ReservaEmergencia({ reserva, transacoes, onSalvarConfig, onContribuir }) {
  const [editando, setEditando] = useState(false)
  const [depositoAberto, setDepositoAberto] = useState(false)
  const [valorDeposito, setValorDeposito] = useState('')
  const despesaMediaMensal = calcularMediaDespesasMensais(transacoes)

  if (!reserva || editando) {
    return <div style={{ marginBottom:16 }}>
      <FormReserva reservaInicial={reserva} despesaMediaMensal={despesaMediaMensal} onSalvar={(c) => { onSalvarConfig(c); setEditando(false) }} onCancelar={() => setEditando(false)} />
    </div>
  }

  const valorAlvo = despesaMediaMensal * reserva.mesesDesejados
  const percentual = valorAlvo > 0 ? Math.min((reserva.valorAtual / valorAlvo) * 100, 100) : 0
  const completa = reserva.valorAtual >= valorAlvo
  const faltam = Math.max(valorAlvo - reserva.valorAtual, 0)
  const tempoEstimado = reserva.aporteMensalPlanejado > 0 ? Math.ceil(faltam / reserva.aporteMensalPlanejado) : null

  function confirmarDeposito() {
    const v = Number(valorDeposito)
    if (!v || v <= 0) { alert('Valor inválido.'); return }
    onContribuir(v)
    setDepositoAberto(false)
    setValorDeposito('')
  }

  return (
    <div style={{ background:'linear-gradient(135deg, #0F766E, #0D9488)', borderRadius:14, padding:14, marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <p style={{ color:'#fff', fontSize:14, fontWeight:700 }}>🛡️ Reserva de emergência {completa && '✅'}</p>
        <button onClick={() => setEditando(true)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:6, padding:'4px 8px', fontSize:12 }}>⚙️</button>
      </div>
      <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:6, height:8, marginBottom:6 }}>
        <div style={{ width:`${percentual}%`, background: completa ? '#22C55E' : '#fff', height:8, borderRadius:6 }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <p style={{ color:'#CCFBF1', fontSize:11 }}>{formatarMoeda(reserva.valorAtual)} de {formatarMoeda(valorAlvo)}</p>
        <p style={{ color:'#CCFBF1', fontSize:11 }}>{Math.round(percentual)}%</p>
      </div>
      {!completa && <p style={{ color:'#CCFBF1', fontSize:11, marginBottom:8 }}>Faltam {formatarMoeda(faltam)}{tempoEstimado ? ` · ~${tempoEstimado} meses` : ''}</p>}
      {depositoAberto ? (
        <div style={{ display:'flex', gap:8 }}>
          <input autoFocus type="number" inputMode="decimal" placeholder="Valor" value={valorDeposito} onChange={(e) => setValorDeposito(e.target.value)}
            style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'none', background:'rgba(255,255,255,0.15)', color:'#fff', fontSize:13 }} />
          <button onClick={confirmarDeposito} style={{ background:'#fff', border:'none', color:'#0D9488', borderRadius:8, padding:'0 12px', fontWeight:700 }}>OK</button>
          <button onClick={() => setDepositoAberto(false)} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:8, padding:'0 10px' }}>✕</button>
        </div>
      ) : !completa && (
        <button onClick={() => setDepositoAberto(true)} style={{ width:'100%', padding:8, borderRadius:8, border:'1px dashed rgba(255,255,255,0.5)', background:'transparent', color:'#fff', fontWeight:600, fontSize:13 }}>💰 Depositar</button>
      )}
    </div>
  )
}

// ---------- Componente: Metas ----------

function Metas({ metas, onAdicionarMeta, onEditarMeta, onExcluirMeta, onContribuir, reserva, transacoes, onSalvarConfigReserva, onContribuirReserva }) {
  const [modoForm, setModoForm] = useState(null)
  const [depositoAberto, setDepositoAberto] = useState(null)
  const [valorDeposito, setValorDeposito] = useState('')

  function confirmarDeposito(meta) {
    const v = Number(valorDeposito)
    if (!v || v <= 0) { alert('Valor inválido.'); return }
    onContribuir(meta.id, v)
    setDepositoAberto(null)
    setValorDeposito('')
  }

  return (
    <div style={{ padding:'8px 14px', background:'#0F172A', minHeight:'100vh', paddingTop:'max(env(safe-area-inset-top,0px),52px)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h1 style={{ fontSize:18, color:'#fff' }}>Metas</h1>
        {!modoForm && <button onClick={() => setModoForm('novo')} style={{ background:'#6366F1', border:'none', color:'#fff', borderRadius:8, padding:'7px 12px', fontSize:13, fontWeight:600 }}>+ Meta</button>}
      </div>

      <ReservaEmergencia reserva={reserva} transacoes={transacoes} onSalvarConfig={onSalvarConfigReserva} onContribuir={onContribuirReserva} />

      {modoForm === 'novo' && <FormNovaMeta onSalvar={(m) => { onAdicionarMeta(m); setModoForm(null) }} onCancelar={() => setModoForm(null)} />}
      {modoForm && modoForm !== 'novo' && <FormNovaMeta metaInicial={modoForm} onSalvar={(m) => { onEditarMeta(m); setModoForm(null) }} onCancelar={() => setModoForm(null)} />}

      {metas.length === 0 && !modoForm && <p style={{ color:'#64748B', fontSize:13 }}>Nenhuma meta ainda. Toque em "+ Meta" pra começar.</p>}

      {metas.map((meta) => {
        const percentual = meta.valorAlvo > 0 ? Math.min((meta.valorAtual / meta.valorAlvo) * 100, 100) : 0
        const completa = meta.valorAtual >= meta.valorAlvo
        const faltam = Math.max(meta.valorAlvo - meta.valorAtual, 0)
        return (
          <div key={meta.id} style={{ background:'#1E293B', borderRadius:12, padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <p style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{meta.icone} {meta.nome} {completa && '✅'}</p>
              <div style={{ display:'flex', gap:2 }}>
                <button onClick={() => setModoForm(meta)} style={{ background:'transparent', border:'none', fontSize:13, padding:5 }}>✏️</button>
                <button onClick={() => { if(window.confirm(`Excluir "${meta.nome}"?`)) onExcluirMeta(meta.id) }} style={{ background:'transparent', border:'none', fontSize:13, padding:5 }}>🗑️</button>
              </div>
            </div>
            <div style={{ background:'#0F172A', borderRadius:6, height:8, marginBottom:6 }}>
              <div style={{ width:`${percentual}%`, background: completa ? '#22C55E' : '#6366F1', height:8, borderRadius:6 }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <p style={{ color:'#94A3B8', fontSize:11 }}>{formatarMoeda(meta.valorAtual)} de {formatarMoeda(meta.valorAlvo)}</p>
              <p style={{ color:'#94A3B8', fontSize:11 }}>{Math.round(percentual)}%</p>
            </div>
            {!completa && <p style={{ color:'#64748B', fontSize:11, marginBottom:8 }}>Faltam {formatarMoeda(faltam)}</p>}
            {depositoAberto === meta.id ? (
              <div style={{ display:'flex', gap:8 }}>
                <input autoFocus type="number" inputMode="decimal" placeholder="Valor" value={valorDeposito} onChange={(e) => setValorDeposito(e.target.value)}
                  style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #334155', background:'#0F172A', color:'#fff', fontSize:13 }} />
                <button onClick={() => confirmarDeposito(meta)} style={{ background:'#22C55E', border:'none', color:'#fff', borderRadius:8, padding:'0 12px', fontWeight:700 }}>OK</button>
                <button onClick={() => { setDepositoAberto(null); setValorDeposito('') }} style={{ background:'#334155', border:'none', color:'#fff', borderRadius:8, padding:'0 10px' }}>✕</button>
              </div>
            ) : !completa && (
              <button onClick={() => setDepositoAberto(meta.id)} style={{ width:'100%', padding:8, borderRadius:8, border:'1px dashed #22C55E', background:'transparent', color:'#22C55E', fontWeight:600, fontSize:13 }}>💰 Depositar</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Relatórios ----------

function Relatorios({ transacoes }) {
  const resumo = calcularResumoMensal(transacoes, 6)
  const maxValor = Math.max(...resumo.flatMap((m) => [m.receitas, m.despesas]), 1)
  const chaveMesAtual = mesAtual()
  const doMesAtual = transacoes.filter((t) => t.data.startsWith(chaveMesAtual) && t.tipo === 'despesa')
  const porCategoria = {}
  doMesAtual.forEach((t) => { porCategoria[t.categoria] = (porCategoria[t.categoria] || 0) + t.valor })
  const totalDespesasMes = Object.values(porCategoria).reduce((s, v) => s + v, 0)
  const categoriasOrdenadas = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])
  const maiorCategoria = categoriasOrdenadas[0]
  const mesesComDados = resumo.filter((m) => m.receitas > 0 || m.despesas > 0)
  const economiaMedia = mesesComDados.length > 0 ? mesesComDados.reduce((s, m) => s + m.saldo, 0) / mesesComDados.length : 0

  function nomeMesAbrev(chave) { return NOMES_MESES[Number(chave.split('-')[1]) - 1].slice(0, 3) }

  return (
    <div style={{ padding:'8px 14px 8px', background:'#0F172A' }}>
      <div style={{ background:'#1E293B', borderRadius:12, padding:14, marginBottom:12 }}>
        <p style={{ color:'#94A3B8', fontSize:11, marginBottom:2 }}>Economia média mensal</p>
        <p style={{ color: economiaMedia >= 0 ? '#22C55E' : '#EF4444', fontSize:20, fontWeight:700 }}>{formatarMoeda(economiaMedia)}</p>
      </div>
      {maiorCategoria && (
        <div style={{ background:'#1E293B', borderRadius:12, padding:14, marginBottom:12 }}>
          <p style={{ color:'#94A3B8', fontSize:11, marginBottom:2 }}>Maior gasto este mês</p>
          <p style={{ color:'#fff', fontSize:14, fontWeight:600 }}>{infoCategoria('despesa', maiorCategoria[0]).icone} {infoCategoria('despesa', maiorCategoria[0]).label}</p>
          <p style={{ color:'#F59E0B', fontSize:12 }}>{formatarMoeda(maiorCategoria[1])} · {totalDespesasMes > 0 ? Math.round((maiorCategoria[1] / totalDespesasMes) * 100) : 0}%</p>
        </div>
      )}
      <p style={{ color:'#94A3B8', fontSize:12, marginBottom:8 }}>Receitas x Despesas — 6 meses</p>
      <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:100, background:'#1E293B', borderRadius:12, padding:'12px 10px 6px', marginBottom:12 }}>
        {resumo.map((m) => (
          <div key={m.chave} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%' }}>
            <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:2 }}>
              <div style={{ width:8, height:`${(m.receitas/maxValor)*100}%`, minHeight: m.receitas>0?2:0, background:'#22C55E', borderRadius:3 }} />
              <div style={{ width:8, height:`${(m.despesas/maxValor)*100}%`, minHeight: m.despesas>0?2:0, background:'#EF4444', borderRadius:3 }} />
            </div>
            <p style={{ color:'#64748B', fontSize:9, marginTop:4 }}>{nomeMesAbrev(m.chave)}</p>
          </div>
        ))}
      </div>
      {categoriasOrdenadas.length > 0 && (
        <>
          <p style={{ color:'#94A3B8', fontSize:12, marginBottom:8 }}>Categorias este mês</p>
          {categoriasOrdenadas.map(([catId, valor]) => {
            const cat = infoCategoria('despesa', catId)
            const pct = totalDespesasMes > 0 ? (valor/totalDespesasMes)*100 : 0
            return (
              <div key={catId} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ color:'#fff', fontSize:12 }}>{cat.icone} {cat.label}</span>
                  <span style={{ color:'#94A3B8', fontSize:12 }}>{formatarMoeda(valor)}</span>
                </div>
                <div style={{ background:'#1E293B', borderRadius:4, height:5 }}>
                  <div style={{ width:`${pct}%`, background:'#6366F1', height:5, borderRadius:4 }} />
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ---------- Componente: Planejamento ----------

function FormItemAnual({ onSalvar, onCancelar, itemInicial }) {
  const [nome, setNome] = useState(itemInicial?.nome || '')
  const [valorEstimado, setValorEstimado] = useState(itemInicial ? String(itemInicial.valorEstimado) : '')
  const [mes, setMes] = useState(itemInicial ? String(itemInicial.mes) : '1')
  const emEdicao = Boolean(itemInicial)
  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #334155', background:'#0F172A', color:'#fff', fontSize:15, marginBottom:14, boxSizing:'border-box' }

  function handleSalvar() {
    if (!nome.trim() || !valorEstimado || Number(valorEstimado) <= 0) { alert('Preencha nome e valor.'); return }
    onSalvar({ id: emEdicao ? itemInicial.id : Date.now(), nome: nome.trim(), valorEstimado: Number(valorEstimado), mes: Number(mes) })
  }

  return (
    <div style={{ background:'#1E293B', borderRadius:14, padding:16, marginBottom:16 }}>
      <p style={{ color:'#fff', fontSize:14, fontWeight:600, marginBottom:12 }}>{emEdicao ? 'Editar item' : 'Novo item anual'}</p>
      <label style={{ color:'#94A3B8', fontSize:13 }}>Nome</label>
      <input style={inputStyle} placeholder="Ex: IPTU, 13º salário..." value={nome} onChange={(e) => setNome(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Valor estimado (R$)</label>
      <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} />
      <label style={{ color:'#94A3B8', fontSize:13 }}>Mês previsto</label>
      <select style={inputStyle} value={mes} onChange={(e) => setMes(e.target.value)}>
        {NOMES_MESES.map((nomeMes, i) => <option key={i} value={i+1}>{nomeMes}</option>)}
      </select>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onCancelar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#334155', color:'#fff', fontWeight:600 }}>Cancelar</button>
        <button onClick={handleSalvar} style={{ flex:1, padding:12, borderRadius:10, border:'none', background:'#6366F1', color:'#fff', fontWeight:700 }}>{emEdicao ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </div>
  )
}

function Planejamento({ transacoes, planejamentos, itensAnuais, onSalvarPlanejamentoMes, onAdicionarItemAnual, onEditarItemAnual, onExcluirItemAnual, onVoltar }) {
  const chave = mesAtual()
  const planoAtual = planejamentos[chave] || { receitaPrevista:0, despesaPrevista:0 }
  const [receitaPrevista, setReceitaPrevista] = useState(planoAtual.receitaPrevista ? String(planoAtual.receitaPrevista) : '')
  const [despesaPrevista, setDespesaPrevista] = useState(planoAtual.despesaPrevista ? String(planoAtual.despesaPrevista) : '')
  const [modoFormItem, setModoFormItem] = useState(null)
  const inputStyle = { width:'100%', padding:'12px 14px', borderRadius:10, border:'1px solid #334155', background:'#0F172A', color:'#fff', fontSize:15, marginBottom:14, boxSizing:'border-box' }

  const doMes = transacoes.filter((t) => t.data.startsWith(chave))
  const receitaReal = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s+t.valor, 0)
  const despesaReal = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s+t.valor, 0)
  const receitaPrevNum = Number(receitaPrevista) || 0
  const despesaPrevNum = Number(despesaPrevista) || 0
  const saldoEsperado = receitaPrevNum - despesaPrevNum
  const mesAtualNum = new Date().getMonth() + 1

  return (
    <div style={{ padding:'8px 14px', background:'#0F172A', minHeight:'100vh', paddingTop:'max(env(safe-area-inset-top,0px),52px)' }}>
      <button onClick={onVoltar} style={{ background:'transparent', border:'none', color:'#94A3B8', fontSize:14, marginBottom:10, padding:0 }}>‹ Voltar</button>
      <h1 style={{ fontSize:18, color:'#fff', marginBottom:14 }}>📋 Planejamento</h1>
      <p style={{ color:'#94A3B8', fontSize:12, marginBottom:8 }}>Mês atual — {NOMES_MESES[mesAtualNum-1]}</p>
      <div style={{ background:'#1E293B', borderRadius:12, padding:14, marginBottom:16 }}>
        <label style={{ color:'#94A3B8', fontSize:13 }}>Receita prevista (R$)</label>
        <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={receitaPrevista} onChange={(e) => setReceitaPrevista(e.target.value)} />
        <label style={{ color:'#94A3B8', fontSize:13 }}>Despesa prevista (R$)</label>
        <input style={inputStyle} type="number" inputMode="decimal" placeholder="0,00" value={despesaPrevista} onChange={(e) => setDespesaPrevista(e.target.value)} />
        <button onClick={() => onSalvarPlanejamentoMes(chave, { receitaPrevista:receitaPrevNum, despesaPrevista:despesaPrevNum })}
          style={{ width:'100%', padding:11, borderRadius:10, border:'none', background:'#6366F1', color:'#fff', fontWeight:700, marginBottom:12 }}>Salvar plano</button>
        <div style={{ borderTop:'1px solid #334155', paddingTop:10 }}>
          {[['Saldo esperado', formatarMoeda(saldoEsperado), saldoEsperado>=0?'#22C55E':'#EF4444'],
            ['Receita real', formatarMoeda(receitaReal), '#22C55E'],
            ['Despesa real', formatarMoeda(despesaReal), '#EF4444']].map(([label, val, cor]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <p style={{ color:'#94A3B8', fontSize:12 }}>{label}</p>
              <p style={{ color:cor, fontSize:12, fontWeight:600 }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <p style={{ color:'#94A3B8', fontSize:12 }}>Visão anual (IPTU, 13º, férias...)</p>
        {!modoFormItem && <button onClick={() => setModoFormItem('novo')} style={{ background:'#6366F1', border:'none', color:'#fff', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:600 }}>+ Item</button>}
      </div>
      {modoFormItem === 'novo' && <FormItemAnual onSalvar={(i) => { onAdicionarItemAnual(i); setModoFormItem(null) }} onCancelar={() => setModoFormItem(null)} />}
      {modoFormItem && modoFormItem !== 'novo' && <FormItemAnual itemInicial={modoFormItem} onSalvar={(i) => { onEditarItemAnual(i); setModoFormItem(null) }} onCancelar={() => setModoFormItem(null)} />}
      {[...itensAnuais].sort((a,b)=>a.mes-b.mes).map((item) => {
        const chegando = item.mes === mesAtualNum || item.mes === (mesAtualNum % 12) + 1
        return (
          <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: chegando?'#1E293B':'transparent', border:`1px solid ${chegando?'#6366F1':'#1E293B'}`, borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
            <div>
              <p style={{ color:'#fff', fontSize:13 }}>{item.nome} {chegando && <span style={{ color:'#6366F1', fontSize:10 }}>chegando</span>}</p>
              <p style={{ color:'#64748B', fontSize:11 }}>{NOMES_MESES[item.mes-1]}</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <p style={{ color:'#F59E0B', fontSize:13, fontWeight:600 }}>{formatarMoeda(item.valorEstimado)}</p>
              <button onClick={() => setModoFormItem(item)} style={{ background:'transparent', border:'none', fontSize:13, padding:4 }}>✏️</button>
              <button onClick={() => { if(window.confirm(`Excluir "${item.nome}"?`)) onExcluirItemAnual(item.id) }} style={{ background:'transparent', border:'none', fontSize:13, padding:4 }}>🗑️</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- Componente: Navegação inferior ----------

function BottomNav({ abaAtiva, onMudarAba }) {
  const abas = [
    { id: 'dashboard', label: 'Início', icone: '🏠' },
    { id: 'cartoes', label: 'Contas', icone: '🏦' },
    { id: 'metas', label: 'Metas', icone: '🎯' },
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
  const [contas, setContas] = useState(carregarContas)
  const [metas, setMetas] = useState(carregarMetas)
  const [reserva, setReserva] = useState(carregarReserva)
  const [planejamentos, setPlanejamentos] = useState(carregarPlanejamentos)
  const [itensAnuais, setItensAnuais] = useState(carregarItensAnuais)
  const [filhos, setFilhos] = useState(carregarFilhos)
  const [segurancaConfig, setSegurancaConfig] = useState(carregarSeguranca)
  const [preferencias, setPreferencias] = useState(carregarPreferencias)
  const [perfil, setPerfil] = useState(carregarPerfil)
  const [desbloqueado, setDesbloqueado] = useState(false)
  const [lgpdAceito, setLgpdAceito] = useState(() => localStorage.getItem('lgpdAceito') === 'true')
  const [abaAtiva, setAbaAtiva] = useState('dashboard')
  const [transacaoEditando, setTransacaoEditando] = useState(null)

  useEffect(() => {
    salvarTransacoes(transacoes)
  }, [transacoes])

  useEffect(() => {
    salvarContas(contas)
  }, [contas])

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

  function handleAdicionarConta(novaContaItem) {
    setContas((atual) => [...atual, novaContaItem])
  }

  function handleEditarConta(contaAtualizada) {
    setContas((atual) => atual.map((c) => (c.id === contaAtualizada.id ? contaAtualizada : c)))
  }

  function handleExcluirConta(id) {
    setContas((atual) => atual.filter((c) => c.id !== id))
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

  function handleSalvarSeguranca(config) {
    setSegurancaConfig(config)
    salvarSeguranca(config)
  }

  function handleRemoverSeguranca() {
    setSegurancaConfig(null)
    salvarSeguranca(null)
  }

  function handleSalvarPreferencias(novasPreferencias) {
    setPreferencias(novasPreferencias)
    salvarPreferencias(novasPreferencias)
  }

  function handleConcluirOnboarding(novoPerfil) {
    setPerfil(novoPerfil)
    salvarPerfil(novoPerfil)
  }

  if (!perfil) {
    return <TelaBoasVindas onConcluir={handleConcluirOnboarding} />
  }

  if (segurancaConfig && !desbloqueado) {
    return (
      <TelaBloqueio
        segurancaConfig={segurancaConfig}
        frase={perfil.frase}
        onDesbloquear={() => setDesbloqueado(true)}
      />
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0F172A',
        fontFamily: 'system-ui, sans-serif',
        paddingBottom: 80,
        zoom: 0.88,
      }}
    >
      {abaAtiva === 'dashboard' && (
        <Inicio
          transacoes={transacoes}
          onEditar={handleIniciarEdicao}
          onExcluir={handleExcluir}
          nome={perfil.nome}
          preferencias={preferencias}
          contas={contas}
          onAbrirFilhos={() => setAbaAtiva('filhos')}
          onAbrirPlanejamento={() => setAbaAtiva('planejamento')}
          onAbrirConfiguracoes={() => setAbaAtiva('configuracoes')}
          onAbrirAssistente={() => setAbaAtiva('assistente')}
        />
      )}
      {abaAtiva === 'configuracoes' && (
        <Configuracoes
          segurancaConfig={segurancaConfig}
          onSalvarSeguranca={handleSalvarSeguranca}
          onRemoverSeguranca={handleRemoverSeguranca}
          preferencias={preferencias}
          onSalvarPreferencias={handleSalvarPreferencias}
          onVoltar={() => setAbaAtiva('dashboard')}
        />
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
          contas={contas}
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
      {abaAtiva === 'cartoes' && (
        <Contas
          contas={contas}
          transacoes={transacoes}
          onAdicionarConta={handleAdicionarConta}
          onEditarConta={handleEditarConta}
          onExcluirConta={handleExcluirConta}
          filhos={filhos}
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
          contas={contas}
        />
      )}

      {abaAtiva !== 'adicionar' && (
        <BotaoFlutuante icone="➕" cor="#6366F1" posicaoInferior={82} onClick={() => setAbaAtiva('adicionar')} />
      )}

      <BottomNav abaAtiva={abaAtiva} onMudarAba={handleMudarAba} />

      {!lgpdAceito && (
        <AvisoPrivacidade
          onAceitar={() => {
            localStorage.setItem('lgpdAceito', 'true')
            setLgpdAceito(true)
          }}
        />
      )}
    </div>
  )
}
