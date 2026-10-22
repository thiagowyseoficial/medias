<script setup lang="ts">
/** Régua 0–10: faixa possível, mínimo de aprovação e média atual. */
const props = withDefaults(defineProps<{
  value: number | null
  threshold: number
  rangeMin?: number
  rangeMax?: number
  kind?: 'official' | 'partial' | 'simulated' | 'empty'
  scale?: boolean
  label?: string
}>(), { rangeMin: undefined, rangeMax: undefined, kind: 'official', scale: false, label: 'Média' })

const pct = (v: number) => `${Math.max(0, Math.min(10, v)) * 10}%`
const hasRange = computed(() => props.rangeMin !== undefined && props.rangeMax !== undefined && props.rangeMax - props.rangeMin > 0.001)
const aria = computed(() => {
  const parts = [`${props.label}: ${props.value === null ? 'sem nota' : formatGrade(props.value)}`, `mínimo ${formatGrade(props.threshold)}`]
  if (hasRange.value) parts.push(`faixa possível de ${formatGrade(props.rangeMin)} a ${formatGrade(props.rangeMax)}`)
  return parts.join('; ')
})
</script>

<template>
  <div class="w-full" role="img" :aria-label="aria">
    <div class="relative h-4">
      <span class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-sm bg-elevated" />
      <span
        v-if="hasRange" class="absolute top-1/2 h-1 -translate-y-1/2 rounded-sm bg-primary/25"
        :style="{ left: pct(rangeMin as number), width: `calc(${pct(rangeMax as number)} - ${pct(rangeMin as number)})` }"
      />
      <span class="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-highlighted" :style="{ left: pct(threshold) }" />
      <span
        v-if="value !== null" class="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary transition-[left] duration-300"
        :class="kind === 'official' ? 'bg-primary' : 'bg-default'"
        :style="{ left: pct(value) }"
      />
    </div>
    <div v-if="scale" class="num relative mt-1 h-4 text-xs text-muted" aria-hidden="true">
      <span class="absolute left-0">0</span>
      <span class="absolute -translate-x-1/2 font-medium text-highlighted" :style="{ left: pct(threshold) }">{{ formatNumber(threshold) }}</span>
      <span class="absolute right-0">10</span>
    </div>
  </div>
</template>
