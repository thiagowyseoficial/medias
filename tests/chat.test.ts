import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../app/composables/useGradeCalculator'
import { applyHypothetical, extractGrade, extractModule, interpret, matchSubjects, normalize, type ChatBlock, type ChatContext } from '../app/composables/useChatEngine'
import { act, byActivities, direct, subject } from './helpers'

const named = (name: string, modules: Parameters<typeof subject>[0]) => ({
  ...subject(modules.map((m, i) => ({ ...m, label: `M${i + 1}` }))),
  id: name.toLowerCase().replace(/\s/g, '-'),
  name
})
const S = DEFAULT_SETTINGS

const calculo = named('Cálculo I', [direct(8), direct(7), direct(null)])
const fisica2 = named('Física II', [direct(5), direct(null), direct(null)])
const fisica3 = named('Física III', [direct(9), direct(9), direct(9)])
const prog = named('Programação', [direct(9), direct(9), direct(null)])
const ctx = (subjects = [calculo, fisica2, prog], extra: Partial<ChatContext> = {}): ChatContext => ({ subjects, settings: S, ...extra })

const flat = (blocks: ChatBlock[]) => blocks.map((b) => {
  if (b.type === 'text') return b.text
  if (b.type === 'kv') return b.rows.map(r => `${r.label}: ${r.value}`).join(' | ')
  if (b.type === 'choices') return b.items.map(i => i.label).join(' | ')
  if (b.type === 'link') return `[${b.label}]`
  return b.status
}).join('\n')

describe('texto', () => {
  it('normaliza acentos, caixa e romanos', () => {
    expect(normalize('Física III?')).toBe('fisica 3')
    expect(normalize('Cálculo I')).toBe('calculo 1')
  })
  it('extrai módulo por vários formatos', () => {
    expect(extractModule('no M2 de física', 3).index).toBe(1)
    expect(extractModule('modulo 3', 3).index).toBe(2)
    expect(extractModule('no segundo módulo', 3).index).toBe(1)
    expect(extractModule('último módulo', 3).index).toBe('last')
    expect(extractModule('no M9', 3).index).toBeNull()
  })
  it('extrai nota com vírgula, ponto e por extenso', () => {
    expect(extractGrade('tirar 7,5')).toBe(7.5)
    expect(extractGrade('tirar 8.25')).toBe(8.25)
    expect(extractGrade('tirar sete')).toBe(7)
    expect(extractGrade('tirar 11')).toBeNull()
  })
  it('não confunde o número do nome da disciplina com a nota', () => {
    const m = matchSubjects('e se eu tirar 7 em física 2', [fisica2, fisica3])
    expect(m.subjects.map(s => s.name)).toEqual(['Física II'])
    expect(extractGrade('e se eu tirar 7 em fisica 2', m.used)).toBe(7)
  })
})

describe('disciplina', () => {
  it('reconhece por parte do nome e sem acento', () => {
    expect(matchSubjects('como estou em calculo', [calculo, prog]).subjects[0]!.name).toBe('Cálculo I')
  })
  it('nome parcial ambíguo pede esclarecimento', () => {
    const r = interpret('quanto preciso em física', ctx([fisica2, fisica3]))
    expect(flat(r.blocks)).toContain('Qual disciplina')
    expect(flat(r.blocks)).toContain('Física II')
    expect(flat(r.blocks)).toContain('Física III')
  })
  it('número romano ou dígito escolhe a disciplina certa', () => {
    expect(interpret('quanto preciso em física 2', ctx([fisica2, fisica3])).subjectId).toBe(fisica2.id)
    expect(interpret('quanto preciso em física II', ctx([fisica2, fisica3])).subjectId).toBe(fisica2.id)
  })
})

describe('respostas', () => {
  it('nota necessária em tudo que falta', () => {
    const t = flat(interpret('quanto preciso em física II', ctx()).blocks)
    expect(t).toContain('6,13')
    expect(t).toContain('Precisa em M2')
    expect(t).toContain('mín. 2,25')
  })
  it('nota necessária em um módulo específico', () => {
    // 17,25 − (8 + 7) = 2,25
    const t = flat(interpret('quanto preciso no M3 de cálculo', ctx()).blocks)
    expect(t).toContain('2,25')
  })
  it('módulo já concluído', () => {
    expect(flat(interpret('quanto preciso no M1 de física', ctx()).blocks)).toContain('já está concluído')
  })
  it('simulação uniforme', () => {
    const t = flat(interpret('e se eu tirar 7 em física II', ctx()).blocks)
    expect(t).toContain('6,33')
    expect(t).toContain('aprovado')
  })
  it('simulação em um módulo diz o que ainda falta', () => {
    const t = flat(interpret('e se eu tirar 9 no M2 de física II', ctx()).blocks)
    expect(t).toContain('3,25')
    expect(t).toContain('ainda não fecha')
  })
  it('simulação que não aprova', () => {
    const t = flat(interpret('e se eu tirar 2 em física II', ctx()).blocks)
    expect(t).toContain('3,00')
    expect(t).toContain('não aprovado')
  })
  it('situação de uma disciplina', () => {
    const r = interpret('como estou em programação', ctx())
    expect(r.blocks.some(b => b.type === 'status' && b.status === 'guaranteed')).toBe(true)
  })
  it('resumo e risco', () => {
    const risky = named('Estatística', [direct(1), direct(1), direct(null)])
    expect(flat(interpret('resumo geral', ctx([calculo, risky])).blocks)).toContain('2 disciplinas')
    expect(flat(interpret('quais estão em risco', ctx([calculo, risky])).blocks)).toContain('Estatística')
    expect(flat(interpret('alguma em risco?', ctx([prog])).blocks)).toContain('Nenhuma disciplina em risco')
  })
  it('usa a última disciplina em perguntas de continuação', () => {
    const r = interpret('e se eu tirar 7', ctx([calculo, fisica2], { lastSubjectId: fisica2.id }))
    expect(r.subjectId).toBe(fisica2.id)
    expect(flat(r.blocks)).toContain('6,33')
  })
  it('sem disciplina citada e várias cadastradas, lista a necessidade de cada uma', () => {
    const t = flat(interpret('quanto preciso tirar', ctx()).blocks)
    expect(t).toContain('Cálculo I')
    expect(t).toContain('Física II')
  })
  it('sem disciplinas cadastradas, orienta o cadastro', () => {
    expect(flat(interpret('quanto preciso tirar', ctx([])).blocks)).toContain('Cadastrar disciplina')
  })
  it('mensagem desconhecida mostra sugestões e ajuda funciona', () => {
    expect(flat(interpret('asdf qwer', ctx()).blocks)).toContain('Não entendi')
    expect(flat(interpret('ajuda', ctx()).blocks)).toContain('Simulação')
  })
  it('disciplina concluída não tem o que simular', () => {
    expect(flat(interpret('e se eu tirar 7 em física III', ctx([fisica3])).blocks)).toContain('não há o que simular')
  })
})

describe('hipótese', () => {
  it('aplica a nota só nas atividades pendentes e preserva as avaliadas', () => {
    const s = named('Química', [direct(7), direct(7), byActivities([act(8, 2), act(null, 3)])])
    const copy = applyHypothetical(s, S, 4)
    expect(copy.modules[2]!.activities.map(a => a.grade)).toEqual([8, 4])
    expect(s.modules[2]!.activities[1]!.grade).toBeNull() // original intacto
  })
})

describe('simulação interativa no chat', () => {
  const hasSim = (blocks: ChatBlock[], id: string) => blocks.some(b => b.type === 'sim' && b.subjectId === id)

  it('"quanto preciso" de uma disciplina traz os controles de simulação', () => {
    expect(hasSim(interpret('quanto preciso em física II', ctx()).blocks, fisica2.id)).toBe(true)
    expect(hasSim(interpret('quanto preciso no M3 de cálculo', ctx()).blocks, calculo.id)).toBe(true)
  })
  it('"simular X" abre a simulação da disciplina', () => {
    const r = interpret('simular Física II', ctx())
    expect(hasSim(r.blocks, fisica2.id)).toBe(true)
    expect(r.subjectId).toBe(fisica2.id)
  })
  it('"e se eu tirar" sem nota abre a simulação, usando a última disciplina', () => {
    const r = interpret('e se eu tirar', ctx([calculo, fisica2], { lastSubjectId: fisica2.id }))
    expect(hasSim(r.blocks, fisica2.id)).toBe(true)
  })
  it('com nota, continua respondendo direto (sem abrir a simulação)', () => {
    expect(hasSim(interpret('e se eu tirar 7 em física II', ctx()).blocks, fisica2.id)).toBe(false)
  })
  it('lista por disciplina tem linhas clicáveis que abrem a simulação', () => {
    const kv = interpret('quanto preciso tirar', ctx()).blocks.find(b => b.type === 'kv')
    expect(kv && kv.type === 'kv' && kv.rows.every(r => r.send?.startsWith('simular '))).toBe(true)
  })
  it('disciplina concluída não abre simulação', () => {
    const r = interpret('simular física III', ctx([fisica3]))
    expect(hasSim(r.blocks, fisica3.id)).toBe(false)
    expect(flat(r.blocks)).toContain('não há o que simular')
  })
})
