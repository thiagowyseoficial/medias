import { defineStore } from 'pinia'
import type { Activity, EvaluationMethod, PersistedState, Settings, Subject } from '~/types'
import { DEFAULT_SETTINGS } from '~/composables/useGradeCalculator'
import { MAX_MODULES, createModule, createSubject, parsePersisted } from '~/utils/schema'
import { uid } from '~/utils/number'

const defaultSettings = (): Settings => ({ ...DEFAULT_SETTINGS })

export const useAcademicStore = defineStore('academic', () => {
  const settings = ref<Settings>(defaultSettings())
  const subjects = ref<Subject[]>([])
  /** `false` até o localStorage ser lido no cliente (evita erro de hidratação). */
  const hydrated = ref(false)

  const snapshot = computed<PersistedState>(() => ({
    version: 1,
    settings: settings.value,
    subjects: subjects.value
  }))

  const getSubject = (id: string) => subjects.value.find(s => s.id === id)

  /** Garante módulos suficientes sem nunca apagar dados já lançados. */
  function syncModules() {
    for (const s of subjects.value) {
      while (s.modules.length < settings.value.moduleCount) s.modules.push(createModule(s.modules.length))
    }
  }

  function hydrate(raw: unknown): { ok: boolean, error?: string } {
    if (raw !== null && raw !== undefined) {
      const parsed = parsePersisted(raw)
      if (parsed.ok) {
        settings.value = parsed.data.settings
        subjects.value = parsed.data.subjects
        syncModules()
      } else {
        hydrated.value = true
        return { ok: false, error: parsed.error }
      }
    }
    hydrated.value = true
    return { ok: true }
  }

  function importData(raw: unknown): { ok: boolean, error?: string } {
    const parsed = parsePersisted(raw)
    if (!parsed.ok) return parsed
    settings.value = parsed.data.settings
    subjects.value = parsed.data.subjects
    syncModules()
    return { ok: true }
  }

  function resetAll() {
    settings.value = defaultSettings()
    subjects.value = []
  }

  function updateSettings(next: Settings) {
    settings.value = {
      minPassingGrade: next.minPassingGrade,
      roundingThreshold: Math.min(next.roundingThreshold, next.minPassingGrade),
      moduleCount: Math.max(1, Math.min(MAX_MODULES, Math.round(next.moduleCount)))
    }
    syncModules()
  }

  function addSubject(input: { name: string, code?: string, professor?: string }): Subject {
    const subject = createSubject(input, settings.value.moduleCount)
    subjects.value.push(subject)
    return subjects.value[subjects.value.length - 1]!
  }

  function updateSubject(id: string, input: { name: string, code?: string, professor?: string }) {
    const s = getSubject(id)
    if (!s) return
    s.name = input.name.trim()
    s.code = (input.code ?? '').trim()
    s.professor = (input.professor ?? '').trim()
  }

  function removeSubject(id: string) {
    subjects.value = subjects.value.filter(s => s.id !== id)
  }

  const getModule = (subjectId: string, moduleIndex: number) => getSubject(subjectId)?.modules[moduleIndex]

  function setMethod(subjectId: string, moduleIndex: number, method: EvaluationMethod) {
    const m = getModule(subjectId, moduleIndex)
    if (m) m.method = method
  }

  function setDirectGrade(subjectId: string, moduleIndex: number, grade: number | null) {
    const m = getModule(subjectId, moduleIndex)
    if (m) m.directGrade = grade
  }

  function addActivity(subjectId: string, moduleIndex: number, input: Omit<Activity, 'id'>) {
    getModule(subjectId, moduleIndex)?.activities.push({ id: uid(), ...input, name: input.name.trim() })
  }

  function updateActivity(subjectId: string, moduleIndex: number, activityId: string, input: Omit<Activity, 'id'>) {
    const a = getModule(subjectId, moduleIndex)?.activities.find(x => x.id === activityId)
    if (a) Object.assign(a, input, { name: input.name.trim() })
  }

  function removeActivity(subjectId: string, moduleIndex: number, activityId: string) {
    const m = getModule(subjectId, moduleIndex)
    if (m) m.activities = m.activities.filter(a => a.id !== activityId)
  }

  return {
    settings, subjects, hydrated, snapshot,
    getSubject, hydrate, importData, resetAll, updateSettings,
    addSubject, updateSubject, removeSubject,
    setMethod, setDirectGrade, addActivity, updateActivity, removeActivity
  }
})
