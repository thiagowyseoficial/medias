export const EPS = 1e-9

/** Remove ruído de ponto flutuante (ex.: 0.1 + 0.2). */
export function clean(value: number): number {
  return Math.round(value * 1e10) / 1e10
}

export function roundTo(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.round((clean(value) + Number.EPSILON) * f) / f
}

export function floorTo(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.floor(clean(value) * f + EPS) / f
}

export const isValidGrade = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10

export const isValidWeight = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nfFlex = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** 7.5 → "7,50" */
export function formatGrade(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : nf.format(roundTo(value, 2))
}

/** 2 → "2"; 2.5 → "2,5" */
export function formatNumber(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : nfFlex.format(roundTo(value, 2))
}

/**
 * Formata uma média sem induzir erro: se o valor está abaixo do limiar mas
 * o arredondamento visual o igualaria (5,749 → "5,75"), trunca em vez de arredondar.
 */
export function formatAverage(value: number | null | undefined, threshold?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (threshold != null && value < threshold - EPS && roundTo(value, 2) >= threshold - EPS) {
    return nf.format(floorTo(value, 2))
  }
  return formatGrade(value)
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(value * 100))}%`
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Arredonda para cima (usado em notas necessárias, para nunca subestimá-las). */
export function ceilTo(value: number, decimals = 2): number {
  const f = 10 ** decimals
  return Math.ceil(clean(value) * f - EPS) / f
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
