import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../app/composables/useGradeCalculator'
import { computeDashboardStats } from '../app/composables/useDashboardStats'
import { formatAverage, formatGrade, formatNumber, ceilTo, roundTo } from '../app/utils/number'
import { parsePersisted } from '../app/utils/schema'
import { act, byActivities, direct, subject } from './helpers'

const S = DEFAULT_SETTINGS

describe('dashboard', () => {
  it('estado inicial vazio', () => {
    const r = computeDashboardStats([], S)
    expect(r.total).toBe(0)
    expect(r.generalAverage).toBeNull()
  })

  it('classifica disciplinas e calcula a média geral só com dados suficientes', () => {
    const approved = subject([direct(8), direct(8), direct(8)])
    const failed = subject([direct(2), direct(2), direct(2)])
    const risk = subject([direct(1), direct(1), direct(null)])
    const progress = subject([direct(8), direct(null), direct(null)])
    const r = computeDashboardStats([approved, failed, risk, progress], S)
    expect(r.total).toBe(4)
    expect(r.approved).toBe(1)
    expect(r.atRisk).toBe(2)
    expect(r.inProgress).toBe(1)
    expect(r.generalAverage).toBe(5) // (8 + 2) / 2; ignora as sem dados suficientes
    expect(r.generalAverageCount).toBe(2)
  })

  it('média geral é provisória quando inclui módulos parciais', () => {
    const partial = subject([direct(8), direct(8), byActivities([act(8, 1), act(null, 1)])])
    expect(computeDashboardStats([partial], S).generalAverageProvisional).toBe(true)
  })
})

describe('formatação brasileira e precisão', () => {
  it('usa vírgula decimal', () => {
    expect(formatGrade(7.5)).toBe('7,50')
    expect(formatNumber(2)).toBe('2')
    expect(formatGrade(null)).toBe('—')
  })
  it('não exibe 5,75 para 5,749 (trunca em vez de arredondar)', () => {
    expect(formatAverage(5.749, 5.75)).toBe('5,74')
    expect(formatAverage(5.75, 5.75)).toBe('5,75')
    expect(formatAverage(7.456)).toBe('7,46')
  })
  it('arredonda sem ruído de ponto flutuante', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(ceilTo(3.2500000000001, 2)).toBe(3.25)
    expect(ceilTo(3.251, 2)).toBe(3.26)
  })
})

describe('importação JSON', () => {
  const valid = { version: 1, settings: { minPassingGrade: 6, roundingThreshold: 5.75, moduleCount: 3 }, subjects: [] }
  it('aceita dados válidos', () => {
    expect(parsePersisted(JSON.stringify(valid)).ok).toBe(true)
  })
  it('rejeita JSON inválido, notas fora do intervalo e pesos não positivos', () => {
    expect(parsePersisted('{oops').ok).toBe(false)
    const mod = (g: number, w: number) => ({
      ...valid,
      subjects: [{ id: 's', name: 'X', modules: [{ id: 'm', label: 'M1', method: 'activities', directGrade: null, activities: [{ id: 'a', name: 'p', grade: g, weight: w }] }], createdAt: 'x' }]
    })
    expect(parsePersisted(mod(11, 1)).ok).toBe(false)
    expect(parsePersisted(mod(5, 0)).ok).toBe(false)
    expect(parsePersisted(mod(5, 1)).ok).toBe(true)
  })
  it('rejeita arredondamento maior que a média mínima', () => {
    expect(parsePersisted({ ...valid, settings: { ...valid.settings, roundingThreshold: 7 } }).ok).toBe(false)
  })
})
