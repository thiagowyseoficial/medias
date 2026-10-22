<script setup lang="ts">
import { EPS } from '~/utils/number'
import type { Simulation } from '~/types'

/** A conclusão do simulador em uma frase: o que o aluno precisa tirar. */
const props = defineProps<{ sim: Simulation, min: number, simulated?: boolean }>()

const requiredText = computed(() => {
  const r = props.sim.requiredAverage
  if (r === null) return '—'
  if (r <= EPS) return '0,00'
  return formatGrade(r)
})
</script>

<template>
  <p class="text-lg font-medium leading-snug text-highlighted">
    <template v-if="sim.status === 'approved'">
      {{ simulated ? 'Com essas notas você passa' : 'Aprovado' }}, com média final <span class="num text-success">{{ formatGrade(sim.finalRounded) }}</span>.
    </template>
    <template v-else-if="sim.status === 'failed'">
      {{ simulated ? 'Com essas notas você não passa' : 'Não aprovado pela nota' }}: média final <span class="num text-error">{{ formatAverage(sim.finalAverage, sim.effectiveThreshold) }}</span>, abaixo de {{ formatGrade(min) }}.
    </template>
    <template v-else-if="sim.status === 'guaranteed'">
      Aprovação garantida. Mesmo zerando o que falta, a média final fica em <span class="num text-success">{{ formatAverage(sim.worstCase, sim.effectiveThreshold) }}</span>.
    </template>
    <template v-else-if="sim.status === 'impossible'">
      Aprovação impossível. Com 10 em tudo que falta, a média máxima é <span class="num text-error">{{ formatAverage(sim.bestCase, sim.effectiveThreshold) }}</span>.
    </template>
    <template v-else>
      Para ser aprovado, precisa de média <span class="num text-primary">{{ requiredText }}</span> no que ainda falta.
    </template>
  </p>
</template>
