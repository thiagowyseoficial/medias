<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'success' | 'error' | 'warning'
  tooltip?: string
  projected?: boolean
  large?: boolean
}>(), { hint: undefined, tone: 'default', tooltip: undefined, projected: false, large: false })

const toneClass = { default: 'text-highlighted', success: 'text-success', error: 'text-error', warning: 'text-warning' } as const
</script>

<template>
  <div class="min-w-0 px-4 py-3.5">
    <dt class="label">
      <UTooltip v-if="tooltip" :text="tooltip"><span class="cursor-help underline decoration-dotted underline-offset-4" tabindex="0">{{ label }}</span></UTooltip>
      <template v-else>{{ label }}</template>
    </dt>
    <dd class="num mt-1 font-medium leading-none" :class="[toneClass[tone], large ? 'text-3xl' : 'text-2xl', projected ? 'is-projected' : '']">{{ value }}</dd>
    <dd v-if="hint" class="mt-1.5 truncate text-xs text-muted" :title="hint">{{ hint }}</dd>
  </div>
</template>
