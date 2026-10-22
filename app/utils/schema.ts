import { z } from 'zod'
import type { Module, PersistedState, Subject } from '~/types'
import { uid } from '~/utils/number'

export const MAX_MODULES = 8
export const STORAGE_KEY = 'calculadora-medias:v1'

const grade = z.number().min(0).max(10).nullable()

const activitySchema = z.object({
  id: z.string().min(1),
  name: z.string().max(80),
  grade,
  weight: z.number().positive()
})

const moduleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(20),
  method: z.enum(['direct', 'activities']),
  directGrade: grade,
  activities: z.array(activitySchema)
})

const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  code: z.string().max(20).default(''),
  professor: z.string().max(80).default(''),
  modules: z.array(moduleSchema).max(MAX_MODULES),
  createdAt: z.string()
})

const settingsSchema = z.object({
  minPassingGrade: z.number().min(0).max(10),
  roundingThreshold: z.number().min(0).max(10),
  moduleCount: z.number().int().min(1).max(MAX_MODULES)
}).refine(s => s.roundingThreshold <= s.minPassingGrade, {
  message: 'O limite de arredondamento não pode ser maior que a média mínima.'
})

export const persistedSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  subjects: z.array(subjectSchema)
})

export function createModule(index: number): Module {
  return { id: uid(), label: `M${index + 1}`, method: 'direct', directGrade: null, activities: [] }
}

export function createSubject(input: { name: string, code?: string, professor?: string }, moduleCount: number): Subject {
  return {
    id: uid(),
    name: input.name.trim(),
    code: (input.code ?? '').trim(),
    professor: (input.professor ?? '').trim(),
    modules: Array.from({ length: moduleCount }, (_, i) => createModule(i)),
    createdAt: new Date().toISOString()
  }
}

export type ParseResult =
  | { ok: true, data: PersistedState }
  | { ok: false, error: string }

/** Valida dados persistidos/importados (aceita string JSON ou objeto). */
export function parsePersisted(input: unknown): ParseResult {
  let raw = input
  if (typeof input === 'string') {
    try { raw = JSON.parse(input) } catch { return { ok: false, error: 'O arquivo não é um JSON válido.' } }
  }
  // Aceita exportações que embrulham os dados em { data: ... }
  if (raw && typeof raw === 'object' && 'data' in raw && !('subjects' in raw)) raw = (raw as { data: unknown }).data
  const parsed = persistedSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: `Formato inválido${issue ? ` em "${issue.path.join('.') || 'raiz'}": ${issue.message}` : '.'}` }
  }
  return { ok: true, data: parsed.data as PersistedState }
}

