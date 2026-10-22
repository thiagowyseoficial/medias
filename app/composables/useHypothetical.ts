import type { Ref } from 'vue'
import type { Subject } from '~/types'

export interface PlanItem { key: string, label: string, weight?: number }
export interface PlanModule {
  index: number
  label: string
  real: number | null
  status: 'official' | 'partial' | 'pending'
  /** Avaliações que ainda podem receber uma nota hipotética. */
  items: PlanItem[]
  mode: 'module' | 'activities'
}

/**
 * Notas hipotéticas de uma disciplina (nunca salvas). Cada avaliação pendente recebe
 * uma chave "módulo" ou "módulo:atividade"; a simulação roda sobre uma cópia da disciplina.
 */
export function useHypothetical(subjectId: Ref<string>) {
  const store = useAcademicStore()
  const subject = computed(() => store.getSubject(subjectId.value))

  const hypo = reactive<Record<string, number | null>>({})
  const clear = () => { for (const k of Object.keys(hypo)) delete hypo[k] }
  watch(subjectId, clear)

  const plan = computed<PlanModule[]>(() => {
    const s = subject.value
    if (!s) return []
    return moduleResults(s, store.settings).map((r, index) => {
      const m = s.modules[index]
      const base = { index, label: m?.label ?? `M${index + 1}`, real: r.grade, status: r.status }
      if (r.status === 'official') return { ...base, items: [], mode: 'module' as const }
      const pending = m && m.method === 'activities' ? m.activities.filter(a => !isEvaluated(a) && a.weight > 0) : []
      if (pending.length) {
        return { ...base, mode: 'activities' as const, items: pending.map(a => ({ key: `${index}:${a.id}`, label: a.name || 'Atividade', weight: a.weight })) }
      }
      return { ...base, mode: 'module' as const, items: [{ key: String(index), label: 'Média do módulo' }] }
    })
  })

  const allKeys = computed(() => plan.value.flatMap(p => p.items.map(i => i.key)))

  const hypothetical = computed<Subject | null>(() => {
    const s = subject.value
    if (!s) return null
    const c: Subject = JSON.parse(JSON.stringify(s))
    for (const p of plan.value) {
      const m = c.modules[p.index]
      if (!m || !p.items.length) continue
      if (p.mode === 'module') {
        m.method = 'direct'
        m.directGrade = hypo[String(p.index)] ?? null
      } else {
        for (const it of p.items) {
          const a = m.activities.find(x => `${p.index}:${x.id}` === it.key)
          if (a) a.grade = hypo[it.key] ?? null
        }
      }
    }
    return c
  })

  const base = computed(() => subject.value ? simulate(subject.value, store.settings) : null)
  const sim = computed(() => hypothetical.value ? simulate(hypothetical.value, store.settings) : null)
  const moduleAfter = (i: number) => hypothetical.value ? computeModule(hypothetical.value.modules[i]!) : null

  /** Quanto ainda precisa tirar no módulo, considerando as notas hipotéticas já digitadas. */
  const needFor = (i: number) => {
    const n = sim.value?.modules.find(m => m.index === i)
    const r = hypothetical.value ? computeModule(hypothetical.value.modules[i]!) : null
    return n && r ? moduleNeedFigure(n, r) : null
  }

  const filled = computed(() => allKeys.value.filter(k => hypo[k] !== null && hypo[k] !== undefined).length)
  const shown = computed(() => sim.value?.finalAverage ?? sim.value?.projectedAverage ?? null)
  const kind = computed<'official' | 'partial' | 'simulated' | 'empty'>(() => {
    const s = sim.value
    if (!s) return 'empty'
    return s.complete ? 'simulated' : s.finalAverage !== null ? 'partial' : s.projectedAverage !== null ? 'simulated' : 'empty'
  })

  const setHypo = (key: string, v: number | null | undefined) => { hypo[key] = v ?? null }

  /** Preenche o que está em branco com a menor nota que garante a aprovação, dadas as notas já digitadas. */
  function fillNeeded() {
    const r = sim.value?.requiredAverage
    if (r === null || r === undefined) return
    const v = Math.max(0, Math.min(10, r))
    for (const k of allKeys.value) if (hypo[k] === null || hypo[k] === undefined) hypo[k] = v
  }

  return { subject, hypo, clear, plan, allKeys, hypothetical, base, sim, moduleAfter, needFor, filled, shown, kind, setHypo, fillNeeded }
}
