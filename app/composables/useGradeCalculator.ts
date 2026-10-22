import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type {
  Activity, ApprovalStatus, LastModuleNeed, Module, ModuleResult, Settings, Simulation,
  SimulationModuleNeed, Subject
} from '~/types'
import { EPS, ceilTo, clean, isValidGrade, isValidWeight } from '~/utils/number'

export const DEFAULT_SETTINGS: Settings = {
  minPassingGrade: 6,
  roundingThreshold: 5.75,
  moduleCount: 3
}

const MAX_GRADE = 10

/* ------------------------------------------------------------------ */
/* Regras de aprovação                                                 */
/* ------------------------------------------------------------------ */

/** Menor média bruta que resulta em aprovação (arredondamento incluso). */
export function effectiveThreshold(settings: Settings): number {
  return Math.min(settings.minPassingGrade, settings.roundingThreshold)
}

/** Aplica o arredondamento de aprovação apenas à média final. */
export function applyApprovalRounding(average: number, settings: Settings): number {
  const avg = clean(average)
  if (avg < settings.minPassingGrade - EPS && avg >= settings.roundingThreshold - EPS) {
    return settings.minPassingGrade
  }
  return avg
}

export function isApproved(average: number, settings: Settings): boolean {
  return applyApprovalRounding(average, settings) >= settings.minPassingGrade - EPS
}

/* ------------------------------------------------------------------ */
/* Módulos                                                             */
/* ------------------------------------------------------------------ */

/** Atividade conta como avaliada apenas se a nota foi preenchida (0 é nota válida). */
export const isEvaluated = (a: Activity): boolean => a.grade !== null && isValidGrade(a.grade)

export function activitiesAverage(activities: Activity[]): number | null {
  const valid = activities.filter(a => isEvaluated(a) && isValidWeight(a.weight))
  const w = valid.reduce((s, a) => s + a.weight, 0)
  if (w <= 0) return null
  return clean(valid.reduce((s, a) => s + (a.grade as number) * a.weight, 0) / w)
}

export function computeModule(module: Module): ModuleResult {
  if (module.method === 'direct') {
    const g = module.directGrade !== null && isValidGrade(module.directGrade) ? module.directGrade : null
    return {
      grade: g, status: g === null ? 'pending' : 'official', method: 'direct',
      evaluatedCount: g === null ? 0 : 1, totalCount: 1,
      evaluatedWeight: 0, pendingWeight: 0, totalWeight: 0, weightedSum: 0,
      min: g ?? 0, max: g ?? MAX_GRADE
    }
  }

  const acts = module.activities.filter(a => isValidWeight(a.weight))
  const evaluated = acts.filter(isEvaluated)
  const pending = acts.filter(a => !isEvaluated(a))
  const evaluatedWeight = evaluated.reduce((s, a) => s + a.weight, 0)
  const pendingWeight = pending.reduce((s, a) => s + a.weight, 0)
  const totalWeight = evaluatedWeight + pendingWeight
  const weightedSum = evaluated.reduce((s, a) => s + (a.grade as number) * a.weight, 0)
  const grade = evaluatedWeight > 0 ? clean(weightedSum / evaluatedWeight) : null

  const status = grade === null ? 'pending' : pending.length > 0 ? 'partial' : 'official'
  return {
    grade, status, method: 'activities',
    evaluatedCount: evaluated.length, totalCount: acts.length,
    evaluatedWeight, pendingWeight, totalWeight, weightedSum,
    min: totalWeight > 0 ? clean(weightedSum / totalWeight) : 0,
    max: totalWeight > 0 ? clean((weightedSum + MAX_GRADE * pendingWeight) / totalWeight) : MAX_GRADE
  }
}

/** Fração do módulo ainda desconhecida e pontos já garantidos (base). */
function moduleParts(r: ModuleResult): { base: number, fraction: number } {
  if (r.method === 'direct') return r.grade === null ? { base: 0, fraction: 1 } : { base: r.grade, fraction: 0 }
  if (r.totalWeight <= 0) return { base: 0, fraction: 1 }
  return { base: r.weightedSum / r.totalWeight, fraction: r.pendingWeight / r.totalWeight }
}

/** Resultado de cada módulo configurado, completando com módulos vazios se necessário. */
export function moduleResults(subject: Subject, settings: Settings): ModuleResult[] {
  const out: ModuleResult[] = []
  for (let i = 0; i < settings.moduleCount; i++) {
    const m = subject.modules[i]
    out.push(computeModule(m ?? { id: `virtual-${i}`, label: `M${i + 1}`, method: 'direct', directGrade: null, activities: [] }))
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Simulação                                                           */
/* ------------------------------------------------------------------ */

export function simulate(subject: Subject, settings: Settings): Simulation {
  const results = moduleResults(subject, settings)
  const n = results.length
  const T = effectiveThreshold(settings)
  const parts = results.map(moduleParts)

  // Valores intermediários sem arredondar: 2/3 truncado em 10 casas distorce os limites.
  const A = parts.reduce((s, p) => s + p.base, 0) / n
  const B = parts.reduce((s, p) => s + p.fraction, 0) / n

  const graded = results.filter(r => r.grade !== null)
  const hasAllGrades = graded.length === n
  const complete = results.every(r => r.status === 'official')
  const hasPending = !complete

  const finalAverage = hasAllGrades
    ? clean(graded.reduce((s, r) => s + (r.grade as number), 0) / n)
    : null
  const finalRounded = finalAverage === null ? null : applyApprovalRounding(finalAverage, settings)
  const projectedAverage = graded.length
    ? clean(graded.reduce((s, r) => s + (r.grade as number), 0) / graded.length)
    : null

  const worstCase = clean(A)
  const bestCase = clean(A + MAX_GRADE * B)
  const worstRounded = applyApprovalRounding(worstCase, settings)
  const bestRounded = applyApprovalRounding(bestCase, settings)

  let status: ApprovalStatus
  if (complete) status = isApproved(finalAverage as number, settings) ? 'approved' : 'failed'
  else if (graded.length === 0) status = 'empty'
  else if (A >= T - EPS) status = 'guaranteed'
  else if (A + MAX_GRADE * B < T - EPS) status = 'impossible'
  else status = 'possible'
  // Sem dados, a projeção ainda diferencia o impossível (só com média mínima > 10).
  if (status === 'empty' && A + MAX_GRADE * B < T - EPS) status = 'impossible'

  const missing = Math.max(0, clean(T - A))

  let requiredAverage: number | null = null
  if (B > EPS) {
    const x = (T - A) / B
    requiredAverage = x <= EPS ? 0 : ceilTo(x, 2)
  }

  const modules: SimulationModuleNeed[] = []
  if (requiredAverage !== null) {
    results.forEach((r, i) => {
      const p = parts[i]!
      if (p.fraction <= EPS) return
      // Menor exigência possível neste módulo: todos os outros módulos pendentes no máximo.
      const othersBest = parts.reduce((sum, q, j) => (j === i ? sum : sum + q.base + MAX_GRADE * q.fraction), 0)
      const moduleNeed = n * T - othersBest
      const inPending = (moduleNeed - p.base) / p.fraction
      modules.push({
        index: i,
        label: subject.modules[i]?.label ?? `M${i + 1}`,
        currentGrade: r.grade,
        neededInPending: requiredAverage as number,
        resultingGrade: clean(p.base + p.fraction * (requiredAverage as number)),
        minModuleGrade: moduleNeed <= EPS ? 0 : ceilTo(moduleNeed, 2),
        minInPending: inPending <= EPS ? 0 : ceilTo(inPending, 2),
        impossible: inPending > MAX_GRADE + EPS
      })
    })
  }

  const lastModule = computeLastModule(subject, results, parts, settings, T)

  return {
    status, complete, moduleCount: n, effectiveThreshold: T,
    accumulated: clean(A), finalAverage, finalRounded, projectedAverage,
    worstCase, bestCase, worstRounded, bestRounded,
    missing, requiredAverage, hasPending, modules, lastModule
  }
}

function computeLastModule(
  subject: Subject, results: ModuleResult[], parts: { base: number, fraction: number }[],
  settings: Settings, T: number
): LastModuleNeed | null {
  const n = results.length
  let idx = -1
  results.forEach((_, i) => { if (parts[i]!.fraction > EPS) idx = i })
  if (idx < 0) return null
  const others = results.filter((_, i) => i !== idx)
  if (others.some(r => r.grade === null)) return null

  const sumOthers = others.reduce((s, r) => s + (r.grade as number), 0)
  const needed = clean(n * T - sumOthers)
  const r = results[idx]!
  const p = parts[idx]!
  const neededModuleGrade = needed <= EPS ? 0 : ceilTo(needed, 2)

  let neededInPending: number | null = null
  if (r.method === 'activities' && r.pendingWeight > 0) {
    const x = (needed * r.totalWeight - r.weightedSum) / r.pendingWeight
    neededInPending = x <= EPS ? 0 : ceilTo(x, 2)
  } else if (p.fraction > EPS) {
    neededInPending = neededModuleGrade
  }

  return {
    index: idx,
    label: subject.modules[idx]?.label ?? `M${idx + 1}`,
    neededModuleGrade,
    neededInPending,
    feasible: needed <= r.max + EPS,
    alreadyGuaranteed: needed <= EPS,
    assumesOthers: others.some(o => o.status !== 'official')
  }
}

/* ------------------------------------------------------------------ */
/* Composables reativos                                                */
/* ------------------------------------------------------------------ */

export function useGradeCalculator(
  subject: MaybeRefOrGetter<Subject>,
  settings: MaybeRefOrGetter<Settings>
) {
  const modules = computed(() => moduleResults(toValue(subject), toValue(settings)))
  const simulation = computed(() => simulate(toValue(subject), toValue(settings)))
  return { modules, simulation }
}

/* ------------------------------------------------------------------ */
/* Apresentação da nota necessária por módulo                          */
/* ------------------------------------------------------------------ */

export interface ModuleNeedFigure {
  /** Nota que precisa tirar (no módulo, ou nas atividades pendentes se já há parcial). */
  value: number
  /** Menor valor possível se todos os demais módulos pendentes tirarem 10. */
  min: number
  /** Onde a nota é cobrada. */
  scope: 'module' | 'pending'
  /** Qualquer nota serve (já garantido neste módulo). */
  any: boolean
  /** Nem 10 nos outros módulos resolve. */
  impossible: boolean
}

export function moduleNeedFigure(need: SimulationModuleNeed, result: ModuleResult): ModuleNeedFigure {
  const scope = result.method === 'activities' && result.status === 'partial' ? 'pending' : 'module'
  const value = scope === 'pending' ? need.neededInPending : need.resultingGrade
  const min = scope === 'pending' ? need.minInPending : need.minModuleGrade
  return { value, min, scope, any: value <= EPS, impossible: need.impossible || need.neededInPending > MAX_GRADE + EPS }
}
