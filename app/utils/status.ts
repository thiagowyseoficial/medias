import type { ApprovalStatus, ModuleStatus } from '~/types'

type Color = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'info'

export const approvalMeta: Record<ApprovalStatus, { label: string, short: string, color: Color, icon: string, description: string }> = {
  empty: {
    label: 'Sem notas', short: 'Sem notas', color: 'neutral', icon: 'i-lucide-circle-dashed',
    description: 'Nenhuma nota lançada ainda.'
  },
  approved: {
    label: 'Aprovado', short: 'Aprovado', color: 'success', icon: 'i-lucide-circle-check',
    description: 'Todas as avaliações foram lançadas e a média final atinge o mínimo.'
  },
  failed: {
    label: 'Não aprovado pela nota', short: 'Não aprovado', color: 'error', icon: 'i-lucide-circle-x',
    description: 'Todas as avaliações foram lançadas e a média final ficou abaixo do mínimo.'
  },
  guaranteed: {
    label: 'Aprovação garantida', short: 'Garantida', color: 'success', icon: 'i-lucide-shield-check',
    description: 'Mesmo tirando zero nas avaliações pendentes, a média final atinge o mínimo.'
  },
  possible: {
    label: 'Aprovação possível', short: 'Possível', color: 'info', icon: 'i-lucide-target',
    description: 'Ainda é possível ser aprovado, dependendo das avaliações pendentes.'
  },
  impossible: {
    label: 'Aprovação impossível', short: 'Impossível', color: 'error', icon: 'i-lucide-ban',
    description: 'Nem tirando 10 nas avaliações pendentes a média final atingiria o mínimo.'
  }
}

export const moduleStatusMeta: Record<ModuleStatus, { label: string, color: Color, icon: string }> = {
  official: { label: 'Concluído', color: 'success', icon: 'i-lucide-check' },
  partial: { label: 'Parcial', color: 'warning', icon: 'i-lucide-hourglass' },
  pending: { label: 'Pendente', color: 'neutral', icon: 'i-lucide-circle-dashed' }
}
