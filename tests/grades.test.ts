import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS, activitiesAverage, applyApprovalRounding, computeModule, isApproved, simulate
} from '../app/composables/useGradeCalculator'
import { byActivities, direct, act, subject } from './helpers'

const S = DEFAULT_SETTINGS

describe('média ponderada das atividades', () => {
  it('calcula Σ(nota × peso) / Σ(peso)', () => {
    expect(activitiesAverage([act(10, 1), act(5, 3)])).toBe(6.25)
  })

  it('aceita notas decimais sem ruído de ponto flutuante', () => {
    expect(activitiesAverage([act(0.1, 1), act(0.2, 1)])).toBe(0.15)
    expect(activitiesAverage([act(7.35, 2), act(8.15, 3)])).toBe(7.83)
  })

  it('distingue nota zero de nota não preenchida', () => {
    const r = computeModule(byActivities([act(0, 1), act(10, 1)]))
    expect(r.grade).toBe(5)
    expect(r.status).toBe('official')
    expect(r.evaluatedCount).toBe(2)
  })

  it('ignora atividades pendentes e marca a média como parcial', () => {
    const r = computeModule(byActivities([act(8, 2), act(null, 3)]))
    expect(r.grade).toBe(8)
    expect(r.status).toBe('partial')
    expect(r.pendingWeight).toBe(3)
    expect(r.min).toBe(3.2)
    expect(r.max).toBe(9.2)
  })

  it('módulo sem atividades avaliadas é pendente (não é zero)', () => {
    expect(computeModule(byActivities([])).grade).toBeNull()
    expect(computeModule(byActivities([act(null, 2)])).status).toBe('pending')
  })

  it('suporta quantidade ilimitada de atividades', () => {
    const many = Array.from({ length: 500 }, () => act(7, 1))
    expect(computeModule(byActivities(many)).grade).toBe(7)
  })

  it('ignora pesos inválidos', () => {
    expect(computeModule(byActivities([act(10, 0), act(6, 1)])).grade).toBe(6)
  })
})

describe('módulo por nota direta', () => {
  it('usa a nota informada', () => {
    const r = computeModule(direct(7.5))
    expect(r.grade).toBe(7.5)
    expect(r.status).toBe('official')
  })
  it('nota vazia é pendente e zero é válida', () => {
    expect(computeModule(direct(null)).status).toBe('pending')
    expect(computeModule(direct(0)).grade).toBe(0)
  })
  it('alternar o método preserva os dados de ambos', () => {
    const m = byActivities([act(9, 1)])
    m.directGrade = 4
    expect(computeModule(m).grade).toBe(9)
    m.method = 'direct'
    expect(computeModule(m).grade).toBe(4)
    expect(m.activities).toHaveLength(1)
  })
})

describe('aprovação e arredondamento', () => {
  it('5,75 arredonda para 6,00 e aprova', () => {
    expect(applyApprovalRounding(5.75, S)).toBe(6)
    expect(isApproved(5.75, S)).toBe(true)
  })
  it('5,74 (e 5,7499) não aprova', () => {
    expect(isApproved(5.74, S)).toBe(false)
    expect(isApproved(5.7499, S)).toBe(false)
    expect(applyApprovalRounding(5.7499, S)).toBe(5.7499)
  })
  it('6,00 aprova e acima do mínimo não é alterado', () => {
    expect(isApproved(6, S)).toBe(true)
    expect(applyApprovalRounding(8.33, S)).toBe(8.33)
  })
  it('respeita configurações personalizadas', () => {
    const cfg = { ...S, minPassingGrade: 7, roundingThreshold: 6.5 }
    expect(isApproved(6.5, cfg)).toBe(true)
    expect(isApproved(6.49, cfg)).toBe(false)
  })
  it('média final de (5,7 + 5,8 + 5,75)/3 usa o limite sem erro de ponto flutuante', () => {
    const r = simulate(subject([direct(5.7), direct(5.8), direct(5.75)]), S)
    expect(r.finalAverage).toBe(5.75)
    expect(r.status).toBe('approved')
    expect(r.finalRounded).toBe(6)
  })
  it('não arredonda os módulos individualmente', () => {
    // (5,74 + 5,74 + 5,74)/3 = 5,74 → reprovado, mesmo que cada módulo "arredondasse" para 5,75
    const r = simulate(subject([direct(5.74), direct(5.74), direct(5.74)]), S)
    expect(r.status).toBe('failed')
  })
})

describe('média final', () => {
  it('MF = (M1 + M2 + M3) / 3', () => {
    const r = simulate(subject([direct(8), direct(7), direct(3)]), S)
    expect(r.finalAverage).toBe(6)
    expect(r.status).toBe('approved')
    expect(r.complete).toBe(true)
    expect(r.hasPending).toBe(false)
    expect(r.requiredAverage).toBeNull()
  })
  it('reprova abaixo do limite', () => {
    expect(simulate(subject([direct(5), direct(5), direct(5)]), S).status).toBe('failed')
  })
  it('suporta número de módulos configurável', () => {
    const cfg = { ...S, moduleCount: 2 }
    const r = simulate(subject([direct(8), direct(4), direct(0)]), cfg)
    expect(r.finalAverage).toBe(6)
  })
  it('completa módulos ausentes como pendentes', () => {
    const r = simulate(subject([direct(8)]), S)
    expect(r.moduleCount).toBe(3)
    expect(r.finalAverage).toBeNull()
  })
})

describe('simulador', () => {
  it('sem dados: status vazio e nota necessária igual ao limiar', () => {
    const r = simulate(subject([direct(null), direct(null), direct(null)]), S)
    expect(r.status).toBe('empty')
    expect(r.requiredAverage).toBe(5.75)
    expect(r.bestCase).toBe(10)
    expect(r.worstCase).toBe(0)
  })

  it('nota necessária no último módulo', () => {
    // 8 e 6 → precisa de 17,25 − 14 = 3,25 no M3
    const r = simulate(subject([direct(8), direct(6), direct(null)]), S)
    expect(r.status).toBe('possible')
    expect(r.lastModule?.neededModuleGrade).toBe(3.25)
    expect(r.lastModule?.feasible).toBe(true)
    expect(r.requiredAverage).toBe(3.25)
    expect(r.missing).toBeCloseTo(3.25 / 3, 9)
  })

  it('aprovação garantida quando o pior cenário já aprova', () => {
    const r = simulate(subject([direct(10), direct(10), direct(null)]), S)
    expect(r.status).toBe('guaranteed')
    expect(r.lastModule?.alreadyGuaranteed).toBe(true)
    expect(r.requiredAverage).toBe(0)
    expect(r.missing).toBe(0)
  })

  it('aprovação impossível quando nem 10 resolve', () => {
    const r = simulate(subject([direct(1), direct(1), direct(null)]), S)
    expect(r.status).toBe('impossible')
    expect(r.lastModule?.feasible).toBe(false)
    expect(r.bestCase).toBe(4)
  })

  it('melhor e pior cenário com avaliações pendentes', () => {
    const r = simulate(subject([direct(6), direct(null), direct(null)]), S)
    expect(r.worstCase).toBe(2)
    expect(r.bestCase).toBeCloseTo(2 + 20 / 3, 9)
  })

  it('nunca retorna nota necessária negativa', () => {
    const r = simulate(subject([direct(10), direct(10), direct(null)]), S)
    expect(r.requiredAverage).toBeGreaterThanOrEqual(0)
    expect(r.lastModule?.neededModuleGrade).toBeGreaterThanOrEqual(0)
  })

  it('considera atividades já avaliadas e seus pesos nas pendentes', () => {
    // M1=7, M2=7, M3: atividade 8 (peso 2) avaliada + peso 3 pendente.
    // Precisa M3 ≥ 17,25 − 14 = 3,25 → (8×2 + x×3)/5 ≥ 3,25 → x ≥ 0,0833 → 0,09
    const m3 = byActivities([act(8, 2), act(null, 3)])
    const r = simulate(subject([direct(7), direct(7), m3]), S)
    expect(r.status).toBe('possible') // pior caso: (7 + 7 + 3,2)/3 = 5,73 < 5,75
    expect(r.lastModule?.neededModuleGrade).toBe(3.25)
    expect(r.lastModule?.neededInPending).toBe(0.09)
    expect(r.worstCase).toBeCloseTo(5.7333333, 6)
  })

  it('nota necessária em cada módulo pendente (uniforme e mínima)', () => {
    // M1 = 5; M2 e M3 pendentes. Alvo bruto 5,75 → soma de 17,25.
    const r = simulate(subject([direct(5), direct(null), direct(null)]), S)
    expect(r.modules.map(m => m.index)).toEqual([1, 2])
    // Uniforme: (17,25 − 5) / 2 = 6,125 → 6,13 em cada um
    expect(r.modules[0]!.resultingGrade).toBeCloseTo(6.13, 2)
    // Mínimo de M2 com 10 em M3: 17,25 − 5 − 10 = 2,25
    expect(r.modules[0]!.minModuleGrade).toBe(2.25)
    expect(r.modules[1]!.minModuleGrade).toBe(2.25)
    expect(r.modules[0]!.impossible).toBe(false)
  })

  it('mínimo por módulo considera o peso das atividades pendentes', () => {
    // M1 = 7, M2 = 7; M3: 8 (peso 2) avaliada + peso 3 pendente. M3 precisa de 3,25 → 0,09 na pendente
    const m3 = byActivities([act(8, 2), act(null, 3)])
    const r = simulate(subject([direct(7), direct(7), m3]), S)
    expect(r.modules).toHaveLength(1)
    expect(r.modules[0]!.minModuleGrade).toBe(3.25)
    expect(r.modules[0]!.minInPending).toBe(0.09)
  })

  it('marca como impossível o módulo que exigiria mais de 10', () => {
    const r = simulate(subject([direct(1), direct(null), direct(null)]), S)
    // 17,25 − 1 − 10 = 6,25 no mínimo; ainda possível
    expect(r.modules[0]!.minModuleGrade).toBe(6.25)
    const bad = simulate(subject([direct(0), direct(null), direct(5)]), S)
    // 17,25 − 0 − 5 = 12,25 em M2 → impossível
    expect(bad.modules[0]!.impossible).toBe(true)
    expect(bad.status).toBe('impossible')
  })
})
