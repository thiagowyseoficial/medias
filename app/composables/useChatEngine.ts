import type { ApprovalStatus, Settings, Subject } from '~/types'
import { EPS, formatAverage, formatGrade, plural } from '~/utils/number'
import { computeModule, isEvaluated, moduleNeedFigure, moduleResults, simulate } from '~/composables/useGradeCalculator'
import { computeDashboardStats } from '~/composables/useDashboardStats'
import { approvalMeta } from '~/utils/status'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type Tone = 'success' | 'error' | 'primary'

export type ChatBlock =
  | { type: 'text', text: string }
  | { type: 'kv', rows: { label: string, value: string, tone?: Tone, send?: string }[] }
  /** Simulação interativa embutida na conversa. */
  | { type: 'sim', subjectId: string }
  | { type: 'status', status: ApprovalStatus }
  | { type: 'link', label: string, to: string }
  | { type: 'choices', items: { label: string, send: string }[] }

export interface ChatReply {
  blocks: ChatBlock[]
  /** Disciplina em foco, para perguntas de continuação ("e se eu tirar 7?"). */
  subjectId?: string | null
}

export interface ChatContext {
  subjects: Subject[]
  settings: Settings
  lastSubjectId?: string | null
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' }
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10
}

/** Minúsculas, sem acentos, algarismos romanos de 1 a 5 viram dígitos. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.,\s]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(w => ROMAN[w] ?? w)
    .join(' ')
}

const tokens = (text: string) => normalize(text).split(' ').filter(Boolean)
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para', 'por', 'na', 'no'])

/* ------------------------------------------------------------------ */
/* Disciplina                                                          */
/* ------------------------------------------------------------------ */

interface SubjectMatch { subjects: Subject[], score: number, used: string[] }

/** Encontra a(s) disciplina(s) citadas. Mais de uma com o mesmo score = ambíguo. */
export function matchSubjects(text: string, subjects: Subject[]): SubjectMatch {
  const norm = normalize(text)
  const words = norm.split(' ')
  let best: SubjectMatch = { subjects: [], score: 0, used: [] }

  for (const s of subjects) {
    const nameNorm = normalize(s.name)
    const nameTokens = nameNorm.split(' ').filter(t => !STOP.has(t))
    let score = 0
    let used: string[] = []

    if (nameNorm && (` ${norm} `).includes(` ${nameNorm} `)) {
      score = 10 + nameNorm.length
      used = nameNorm.split(' ')
    } else {
      const significant = nameTokens.filter(t => /^[a-z]{3,}$/.test(t))
      const numeric = nameTokens.filter(t => /^\d+$/.test(t))
      const hits = significant.filter(t => words.includes(t))
      if (hits.length && hits.length === significant.length) {
        const numberOk = !numeric.length || numeric.every(n => words.includes(n))
        score = numberOk ? 5 + hits.length : 3
        used = [...hits, ...(numberOk ? numeric : [])]
      } else if (hits.length) {
        score = 1 + hits.length
        used = hits
      }
    }

    if (score > best.score) best = { subjects: [s], score, used }
    else if (score === best.score && score > 0) best = { ...best, subjects: [...best.subjects, s] }
  }
  return best
}

/* ------------------------------------------------------------------ */
/* Módulo e nota citados                                               */
/* ------------------------------------------------------------------ */

const ORDINALS: Record<string, number> = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5 }

/** Extrai "M2", "módulo 2", "segundo módulo" ou "último módulo". Retorna o índice (0-based) e o texto sem a menção. */
export function extractModule(text: string, moduleCount: number): { index: number | 'last' | null, rest: string } {
  let rest = normalize(text)
  let index: number | 'last' | null = null
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => number | 'last') => {
    const m = rest.match(re)
    if (m && index === null) { index = fn(m); rest = rest.replace(re, ' ') }
  }
  take(/\bm\s?(\d)\b/, m => Number(m[1]) - 1)
  take(/\bmodulo\s+(\d)\b/, m => Number(m[1]) - 1)
  take(/\b(primeiro|segundo|terceiro|quarto|quinto)\s+modulo\b/, m => (ORDINALS[m[1]!] ?? 1) - 1)
  take(/\bultimo\s+modulo\b/, () => 'last')
  if (typeof index === 'number' && (index < 0 || index >= moduleCount)) index = null
  return { index, rest: rest.replace(/\s+/g, ' ').trim() }
}

/** Primeira nota (0 a 10) do texto, ignorando os tokens já usados pela disciplina. */
export function extractGrade(text: string, ignore: string[] = []): number | null {
  const pool = [...ignore]
  for (const raw of normalize(text).split(' ')) {
    const idx = pool.indexOf(raw)
    if (idx >= 0) { pool.splice(idx, 1); continue }
    if (raw in NUMBER_WORDS) return NUMBER_WORDS[raw]!
    if (/^\d+([.,]\d+)?$/.test(raw)) {
      const n = Number(raw.replace(',', '.'))
      if (n >= 0 && n <= 10) return n
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Hipótese: aplica uma nota nas avaliações pendentes                  */
/* ------------------------------------------------------------------ */

/** Cópia da disciplina com `grade` nas avaliações pendentes (de um módulo ou de todos). */
export function applyHypothetical(subject: Subject, settings: Settings, grade: number, moduleIndex?: number): Subject {
  const copy: Subject = JSON.parse(JSON.stringify(subject))
  for (let i = 0; i < settings.moduleCount; i++) {
    if (moduleIndex !== undefined && i !== moduleIndex) continue
    const m = copy.modules[i]
    if (!m) continue
    const r = computeModule(m)
    if (r.status === 'official') continue
    const pending = m.method === 'activities' ? m.activities.filter(a => !isEvaluated(a) && a.weight > 0) : []
    if (pending.length) pending.forEach((a) => { a.grade = grade })
    else { m.method = 'direct'; m.directGrade = grade }
  }
  return copy
}

/* ------------------------------------------------------------------ */
/* Respostas                                                           */
/* ------------------------------------------------------------------ */

const text = (t: string): ChatBlock => ({ type: 'text', text: t })
const link = (label: string, to: string): ChatBlock => ({ type: 'link', label, to })

const SUGGESTIONS = [
  { label: 'Resumo geral', send: 'resumo geral' },
  { label: 'Quais estão em risco?', send: 'quais disciplinas estão em risco' },
  { label: 'Quanto preciso tirar?', send: 'quanto preciso tirar' },
  { label: 'E se eu tirar 7?', send: 'e se eu tirar 7' }
]

function helpReply(): ChatReply {
  return {
    blocks: [
      text('Posso responder sobre as suas disciplinas e simular notas. Não altero nenhum dado. Experimente:'),
      { type: 'kv', rows: [
        { label: 'Situação', value: '“como estou em Cálculo?”' },
        { label: 'Nota necessária', value: '“quanto preciso em Física?”' },
        { label: 'Por módulo', value: '“quanto preciso no M3 de Física?”' },
        { label: 'Simulação', value: '“e se eu tirar 7 em Física?”' },
        { label: 'Simulação por módulo', value: '“e se eu tirar 8 no M2 de Cálculo?”' },
        { label: 'Brincar com as notas', value: '“simular Física”' },
        { label: 'Panorama', value: '“resumo geral” · “quais estão em risco?”' }
      ] },
      { type: 'choices', items: SUGGESTIONS }
    ]
  }
}

function noSubjects(): ChatReply {
  return { blocks: [text('Você ainda não tem disciplinas cadastradas. Cadastre uma para eu poder calcular e simular.'), link('Cadastrar disciplina', '/disciplinas')] }
}

function askWhich(subjects: Subject[], question: string): ChatReply {
  return {
    blocks: [
      text('Qual disciplina você quer dizer?'),
      { type: 'choices', items: subjects.slice(0, 8).map(s => ({ label: s.name, send: `${question} ${s.name}` })) }
    ]
  }
}

function situationReply(subject: Subject, ctx: ChatContext): ChatReply {
  const sim = simulate(subject, ctx.settings)
  const mods = moduleResults(subject, ctx.settings)
  const current = sim.finalAverage ?? sim.projectedAverage
  const blocks: ChatBlock[] = [{ type: 'status', status: sim.status }]
  blocks.push(text(statusSentence(subject.name, sim.status, sim, ctx.settings)))
  blocks.push({ type: 'kv', rows: [
    { label: sim.complete ? 'Média final' : sim.finalAverage !== null ? 'Média parcial' : 'Média projetada', value: formatAverage(current, sim.effectiveThreshold) },
    ...mods.map((m, i) => ({ label: subject.modules[i]?.label ?? `M${i + 1}`, value: formatGrade(m.grade) + (m.status === 'partial' ? ' (parcial)' : m.status === 'pending' ? ' (pendente)' : '') })),
    ...(sim.complete ? [] : [{ label: 'Falta para aprovar', value: sim.missing <= EPS ? '0,00' : formatGrade(sim.missing) }])
  ] })
  blocks.push(link(`Abrir ${subject.name}`, `/disciplinas/${subject.id}`))
  return { blocks, subjectId: subject.id }
}

function statusSentence(name: string, status: ApprovalStatus, sim: ReturnType<typeof simulate>, settings: Settings): string {
  const min = formatGrade(settings.minPassingGrade)
  switch (status) {
    case 'approved': return `${name}: aprovado, com média final ${formatGrade(sim.finalRounded)}.`
    case 'failed': return `${name}: não aprovado pela nota. A média final ficou em ${formatAverage(sim.finalAverage, sim.effectiveThreshold)}, abaixo de ${min}.`
    case 'guaranteed': return `${name}: aprovação garantida. Mesmo zerando o que falta, a média final fica em ${formatAverage(sim.worstCase, sim.effectiveThreshold)}.`
    case 'impossible': return `${name}: aprovação impossível. Com 10 em tudo que falta, a média máxima é ${formatAverage(sim.bestCase, sim.effectiveThreshold)}.`
    case 'possible': return `${name}: aprovação possível. Precisa de média ${formatGrade(sim.requiredAverage)} no que ainda falta.`
    default: return `${name}: ainda sem notas lançadas.`
  }
}

function neededReply(subject: Subject, ctx: ChatContext, moduleIndex: number | 'last' | null): ChatReply {
  const sim = simulate(subject, ctx.settings)
  const mods = moduleResults(subject, ctx.settings)
  const base: ChatReply = { blocks: [], subjectId: subject.id }

  if (sim.complete || sim.status === 'guaranteed' || sim.status === 'impossible') {
    base.blocks = [{ type: 'status', status: sim.status }, text(statusSentence(subject.name, sim.status, sim, ctx.settings)), link('Ver simulação detalhada', `/simulador?disciplina=${subject.id}`)]
    return base
  }

  let idx: number | null = null
  if (moduleIndex === 'last') idx = sim.lastModule?.index ?? null
  else if (typeof moduleIndex === 'number') idx = moduleIndex

  if (idx !== null) {
    const label = subject.modules[idx]?.label ?? `M${idx + 1}`
    const need = sim.modules.find(m => m.index === idx)
    if (!need) {
      base.blocks = [text(`${label} de ${subject.name} já está concluído, com média ${formatGrade(mods[idx]?.grade)}. Não há mais nada a tirar nele.`)]
      return base
    }
    const fig = moduleNeedFigure(need, mods[idx]!)
    const where = fig.scope === 'pending' ? 'nas atividades que faltam' : 'no módulo'
    base.blocks = [
      text(fig.impossible
        ? `Em ${label} de ${subject.name}, nem 10 nos outros módulos resolve: a aprovação já não depende só dele.`
        : fig.any ? `Em ${label} de ${subject.name}, qualquer nota serve.`
          : `Em ${label} de ${subject.name}, você precisa tirar ${formatGrade(fig.value)} ${where}, supondo que os outros módulos pendentes terminem iguais.`),
      { type: 'kv', rows: [
        { label: `Precisa em ${label}`, value: fig.impossible ? 'impossível' : fig.any ? 'qualquer' : formatGrade(fig.value), tone: fig.impossible ? 'error' : 'primary' },
        ...(sim.modules.length > 1 && !fig.impossible && !fig.any ? [{ label: 'Mínimo (10 nos outros)', value: formatGrade(fig.min) }] : []),
        { label: 'Alvo da média final', value: formatGrade(sim.effectiveThreshold) }
      ] },
      { type: 'sim', subjectId: subject.id },
      link('Abrir no simulador', `/simulador?disciplina=${subject.id}`)
    ]
    return base
  }

  const figs = sim.modules.map(m => ({ m, fig: moduleNeedFigure(m, mods[m.index]!) }))
  base.blocks = [
    { type: 'status', status: sim.status },
    text(`Em ${subject.name}, para ser aprovado você precisa de média ${formatGrade(sim.requiredAverage)} em tudo que ainda falta (alvo ${formatGrade(sim.effectiveThreshold)} na média final).`),
    { type: 'kv', rows: [
      ...figs.map(({ m, fig }) => ({
        label: `Precisa em ${m.label}`,
        value: fig.impossible ? 'impossível' : fig.any ? 'qualquer' : formatGrade(fig.value) + (sim.modules.length > 1 ? ` (mín. ${formatGrade(fig.min)})` : ''),
        tone: (fig.impossible ? 'error' : 'primary') as Tone
      })),
      { label: 'Falta na média final', value: formatGrade(sim.missing) }
    ] },
    { type: 'text', text: 'Mexa nas notas de cada módulo para ver o resultado:' },
    { type: 'sim', subjectId: subject.id },
    link('Abrir no simulador', `/simulador?disciplina=${subject.id}`)
  ]
  return base
}

function playReply(subject: Subject, ctx: ChatContext): ChatReply {
  const sim = simulate(subject, ctx.settings)
  if (sim.complete) {
    return { subjectId: subject.id, blocks: [text(`Todas as avaliações de ${subject.name} já foram lançadas, então não há o que simular.`), { type: 'status', status: sim.status }] }
  }
  return {
    subjectId: subject.id,
    blocks: [
      text(`${subject.name}: digite uma nota hipotética em cada avaliação que falta e veja a média final e a situação mudarem. Nada é salvo.`),
      { type: 'sim', subjectId: subject.id },
      link('Abrir no simulador', `/simulador?disciplina=${subject.id}`)
    ]
  }
}

function whatIfReply(subject: Subject, ctx: ChatContext, grade: number, moduleIndex: number | 'last' | null): ChatReply {
  const before = simulate(subject, ctx.settings)
  if (before.complete) {
    return { subjectId: subject.id, blocks: [text(`Todas as avaliações de ${subject.name} já foram lançadas, então não há o que simular.`), { type: 'status', status: before.status }] }
  }
  let target: number | undefined
  if (moduleIndex === 'last') target = before.lastModule?.index
  else if (typeof moduleIndex === 'number') target = moduleIndex
  const copy = applyHypothetical(subject, ctx.settings, grade, target)
  const sim = simulate(copy, ctx.settings)
  const where = target === undefined ? 'em tudo que falta' : `no ${subject.modules[target]?.label ?? `M${target + 1}`}`
  const final = sim.finalAverage ?? sim.projectedAverage
  const approved = sim.status === 'approved' || sim.status === 'guaranteed'

  const sentence = sim.complete
    ? `Com ${formatGrade(grade)} ${where}, a média final de ${subject.name} seria ${formatAverage(sim.finalAverage, sim.effectiveThreshold)}: ${approved ? 'aprovado' : 'não aprovado'}.`
    : sim.status === 'impossible'
      ? `Com ${formatGrade(grade)} ${where}, a aprovação em ${subject.name} continuaria impossível.`
      : `Com ${formatGrade(grade)} ${where}, você ainda não fecha a disciplina. Para ser aprovado precisaria de média ${formatGrade(sim.requiredAverage)} no que restar.`

  return {
    subjectId: subject.id,
    blocks: [
      { type: 'status', status: sim.status },
      text(sentence),
      { type: 'kv', rows: [
        { label: sim.complete ? 'Média final simulada' : 'Média projetada', value: formatAverage(final, sim.effectiveThreshold), tone: sim.complete ? (approved ? 'success' : 'error') : undefined },
        { label: 'Situação', value: approvalMeta[sim.status].short },
        { label: 'Falta para aprovar', value: sim.missing <= EPS ? '0,00' : formatGrade(sim.missing) }
      ] },
      link('Testar outras notas', `/simulador?disciplina=${subject.id}`)
    ]
  }
}

function overviewReply(ctx: ChatContext, onlyRisk: boolean): ChatReply {
  const stats = computeDashboardStats(ctx.subjects, ctx.settings)
  const list = onlyRisk ? stats.analyses.filter(a => a.bucket === 'atRisk') : stats.analyses

  if (onlyRisk && !list.length) {
    return { blocks: [text('Nenhuma disciplina em risco no momento.'), link('Ver visão geral', '/')] }
  }
  const head = onlyRisk
    ? `${plural(list.length, 'disciplina em risco', 'disciplinas em risco')}:`
    : `Você tem ${plural(stats.total, 'disciplina', 'disciplinas')}: ${stats.approved} aprovada(s), ${stats.inProgress} em andamento e ${stats.atRisk} em risco.`
  return {
    blocks: [
      text(head),
      { type: 'kv', rows: list.map((a) => {
        const s = a.simulation
        const v = s.status === 'impossible' ? 'inalcançável'
          : s.status === 'failed' ? `final ${formatGrade(s.finalAverage)}`
            : s.status === 'approved' ? `aprovada ${formatGrade(s.finalRounded)}`
              : s.status === 'guaranteed' ? 'garantida'
                : s.requiredAverage !== null ? `precisa ${formatGrade(s.requiredAverage)}` : 'sem notas'
        return { label: a.subject.name, value: v, send: s.complete ? `como estou em ${a.subject.name}` : `simular ${a.subject.name}`, tone: (s.status === 'impossible' || s.status === 'failed' ? 'error' : s.status === 'approved' || s.status === 'guaranteed' ? 'success' : undefined) as Tone | undefined }
      }) },
      ...(!onlyRisk && stats.generalAverage !== null ? [text(`Média geral das disciplinas completas: ${formatGrade(stats.generalAverage)}.`)] : []),
      link('Ver visão geral', '/')
    ]
  }
}

function needsOverview(ctx: ChatContext): ChatReply {
  const rows = ctx.subjects.map((s) => ({ s, sim: simulate(s, ctx.settings) })).filter(x => !x.sim.complete && x.sim.requiredAverage !== null)
  if (!rows.length) return { blocks: [text('Nenhuma disciplina tem avaliações pendentes.')] }
  return {
    blocks: [
      text('O que você precisa tirar no que ainda falta, por disciplina. Toque em uma para simular módulo a módulo:'),
      { type: 'kv', rows: rows.map(({ s, sim }) => ({
        label: s.name,
        send: `simular ${s.name}`,
        value: sim.status === 'impossible' ? 'inalcançável' : sim.status === 'guaranteed' ? 'garantida' : formatGrade(sim.requiredAverage),
        tone: (sim.status === 'impossible' ? 'error' : sim.status === 'guaranteed' ? 'success' : 'primary') as Tone
      })) },
      link('Abrir simulador', '/simulador')
    ]
  }
}

/* ------------------------------------------------------------------ */
/* Intenção                                                            */
/* ------------------------------------------------------------------ */

type Intent = 'help' | 'greeting' | 'whatif' | 'play' | 'needed' | 'risk' | 'overview' | 'list' | 'situation'

export function detectIntent(norm: string, hasGrade: boolean, hasSubject: boolean): Intent | null {
  if (/\b(ajuda|help|comandos|o que (voce|vc) (faz|sabe|pode)|como (voce )?funciona)\b/.test(norm)) return 'help'
  if (/^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite)\b/.test(norm) && norm.split(' ').length <= 4) return 'greeting'
  if (hasGrade && /\b(e se|se eu|se tirar|se tiver|simul|caso eu|supondo|tirando|tirasse)\b/.test(norm)) return 'whatif'
  if (!hasGrade && /\b(simular|simula|simulacao|brincar|testar|experimentar|mexer|cenarios?|e se|se eu)\b/.test(norm)) return 'play'
  if (/\b(risco|perigo|reprov)/.test(norm) && !hasSubject) return 'risk'
  if (/\b(quanto|qual|que nota|o que)\b.*\b(preciso|falta|tirar|necessari|passar|aprovar)|\bpreciso (tirar|de)\b|\bnota minima\b|\bpara (passar|ser aprovad)/.test(norm)) return 'needed'
  if (/\b(resumo|visao geral|panorama|media geral|geral)\b/.test(norm) && !hasSubject) return 'overview'
  if (/\b(listar|lista|quais|minhas|todas)\b.*\bdisciplinas?\b|\bdisciplinas (tenho|cadastradas)\b/.test(norm)) return 'list'
  if (/\b(como estou|situacao|status|aprovad|media|nota|notas|estou)\b/.test(norm) || hasSubject) return 'situation'
  return null
}

/** Interpreta uma mensagem do usuário e monta a resposta. */
export function interpret(input: string, ctx: ChatContext): ChatReply {
  const trimmed = input.trim()
  const norm = normalize(trimmed)
  if (!norm) return helpReply()

  const moduleCount = ctx.settings.moduleCount
  const match = matchSubjects(trimmed, ctx.subjects)
  const { index: moduleIndex, rest } = extractModule(trimmed, moduleCount)
  // A nota não pode vir de dígitos que pertencem ao nome da disciplina.
  const grade = extractGrade(rest, match.used)
  const intent = detectIntent(norm, grade !== null, match.subjects.length > 0)

  if (intent === 'help') return helpReply()
  if (intent === 'greeting') return { blocks: [text('Olá! Pergunte sobre suas notas ou simule cenários.'), { type: 'choices', items: SUGGESTIONS }] }
  if (!ctx.subjects.length) return intent ? noSubjects() : helpReply()
  if (intent === 'risk') return overviewReply(ctx, true)
  if (intent === 'overview') return overviewReply(ctx, false)
  if (intent === 'list') return overviewReply(ctx, false)
  if (intent === null) {
    return { blocks: [text('Não entendi. Posso informar a situação, a nota necessária ou simular uma nota. Tente:'), { type: 'choices', items: SUGGESTIONS }] }
  }

  // Intenções que dependem de uma disciplina.
  if (match.subjects.length > 1) return askWhich(match.subjects, rest || trimmed)
  let subject: Subject | undefined = match.subjects[0]
  if (!subject && ctx.lastSubjectId) subject = ctx.subjects.find(s => s.id === ctx.lastSubjectId)
  if (!subject && ctx.subjects.length === 1) subject = ctx.subjects[0]

  if (!subject) {
    if (intent === 'needed') return needsOverview(ctx)
    return askWhich(ctx.subjects, trimmed)
  }

  if (intent === 'play') return playReply(subject, ctx)
  if (intent === 'whatif') return whatIfReply(subject, ctx, grade as number, moduleIndex)
  if (intent === 'needed') return neededReply(subject, ctx, moduleIndex)
  return situationReply(subject, ctx)
}
