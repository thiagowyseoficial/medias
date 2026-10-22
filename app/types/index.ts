export type EvaluationMethod = 'direct' | 'activities'

export interface Activity {
  id: string
  name: string
  /** `null` = ainda não avaliada (diferente de nota zero). */
  grade: number | null
  weight: number
}

export interface Module {
  id: string
  label: string
  method: EvaluationMethod
  /** Média informada manualmente; preservada ao alternar o método. */
  directGrade: number | null
  activities: Activity[]
}

export interface Subject {
  id: string
  name: string
  code: string
  professor: string
  modules: Module[]
  createdAt: string
}

export interface Settings {
  /** Média mínima para aprovação. */
  minPassingGrade: number
  /** A partir deste valor a média final é arredondada para a média mínima. */
  roundingThreshold: number
  moduleCount: number
}

export interface PersistedState {
  version: 1
  settings: Settings
  subjects: Subject[]
}

export type ModuleStatus = 'official' | 'partial' | 'pending'

export interface ModuleResult {
  grade: number | null
  status: ModuleStatus
  method: EvaluationMethod
  evaluatedCount: number
  totalCount: number
  evaluatedWeight: number
  pendingWeight: number
  totalWeight: number
  /** Σ(nota × peso) das atividades avaliadas. */
  weightedSum: number
  /** Menor/maior média que o módulo ainda pode ter. */
  min: number
  max: number
}

export type ApprovalStatus =
  | 'empty'
  | 'approved'
  | 'failed'
  | 'guaranteed'
  | 'possible'
  | 'impossible'

export interface SimulationModuleNeed {
  index: number
  label: string
  currentGrade: number | null
  /** Média necessária nas avaliações pendentes do módulo (uniforme). */
  neededInPending: number
  /** Média em que o módulo terminaria com essa nota nas pendências. */
  resultingGrade: number
  /** Menor nota no módulo se todos os demais pendentes tirarem 10. */
  minModuleGrade: number
  /** Menor média nas pendências do módulo se todos os demais pendentes tirarem 10. */
  minInPending: number
  /** Mesmo com 10 nos demais, o módulo sozinho precisaria de mais que 10. */
  impossible: boolean
}

export interface LastModuleNeed {
  index: number
  label: string
  /** Nota necessária no módulo inteiro. */
  neededModuleGrade: number
  /** Nota necessária nas atividades pendentes (módulo por atividades). */
  neededInPending: number | null
  feasible: boolean
  alreadyGuaranteed: boolean
  /** Os demais módulos foram assumidos em suas médias atuais (ainda incompletas). */
  assumesOthers: boolean
}

export interface Simulation {
  status: ApprovalStatus
  /** Todos os módulos estão concluídos. */
  complete: boolean
  moduleCount: number
  /** Limiar efetivo da média bruta (considera o arredondamento). */
  effectiveThreshold: number
  /** Média das notas já lançadas dividida por N (pontos acumulados). */
  accumulated: number
  /** Média final bruta quando todos os módulos têm nota; senão `null`. */
  finalAverage: number | null
  /** Média final após regra de arredondamento. */
  finalRounded: number | null
  /** Projeção: pendências iguais à média atual dos módulos com nota. */
  projectedAverage: number | null
  worstCase: number
  bestCase: number
  worstRounded: number
  bestRounded: number
  /** Quanto falta (em média final) para o limiar efetivo; 0 se já atingiu. */
  missing: number
  /** Média uniforme necessária em todas as avaliações pendentes. */
  requiredAverage: number | null
  hasPending: boolean
  modules: SimulationModuleNeed[]
  lastModule: LastModuleNeed | null
}
