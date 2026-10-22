import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Settings, Simulation, Subject } from '~/types'
import { clean } from '~/utils/number'
import { simulate } from '~/composables/useGradeCalculator'

export type SubjectBucket = 'approved' | 'atRisk' | 'inProgress'

export interface SubjectAnalysis {
  subject: Subject
  simulation: Simulation
  bucket: SubjectBucket
}

export interface DashboardStats {
  analyses: SubjectAnalysis[]
  total: number
  approved: number
  inProgress: number
  atRisk: number
  /** Média das disciplinas com todos os módulos avaliados; `null` sem dados suficientes. */
  generalAverage: number | null
  generalAverageCount: number
  /** Há disciplinas na média cujas notas ainda são parciais. */
  generalAverageProvisional: boolean
}

/** Em risco: reprovada, impossível ou que exige média acima do mínimo nas pendências. */
export function bucketOf(sim: Simulation, settings: Settings): SubjectBucket {
  if (sim.status === 'approved') return 'approved'
  if (sim.status === 'failed' || sim.status === 'impossible') return 'atRisk'
  if (sim.status === 'possible' && sim.requiredAverage !== null && sim.requiredAverage > settings.minPassingGrade) return 'atRisk'
  return 'inProgress'
}

export function computeDashboardStats(subjects: Subject[], settings: Settings): DashboardStats {
  const analyses = subjects.map((subject) => {
    const simulation = simulate(subject, settings)
    return { subject, simulation, bucket: bucketOf(simulation, settings) }
  })
  const withAverage = analyses.filter(a => a.simulation.finalAverage !== null)
  const generalAverage = withAverage.length
    ? clean(withAverage.reduce((s, a) => s + (a.simulation.finalAverage as number), 0) / withAverage.length)
    : null
  return {
    analyses,
    total: analyses.length,
    approved: analyses.filter(a => a.bucket === 'approved').length,
    inProgress: analyses.filter(a => a.bucket === 'inProgress').length,
    atRisk: analyses.filter(a => a.bucket === 'atRisk').length,
    generalAverage,
    generalAverageCount: withAverage.length,
    generalAverageProvisional: withAverage.some(a => !a.simulation.complete)
  }
}

export function useDashboardStats(
  subjects: MaybeRefOrGetter<Subject[]>,
  settings: MaybeRefOrGetter<Settings>
) {
  return computed(() => computeDashboardStats(toValue(subjects), toValue(settings)))
}
