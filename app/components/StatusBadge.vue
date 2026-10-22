<script setup lang="ts">
import type { ApprovalStatus } from '~/types'

const props = withDefaults(defineProps<{ status: ApprovalStatus, short?: boolean }>(), { short: true })
const meta = computed(() => approvalMeta[props.status])
const dot = computed(() => ({
  approved: 'bg-success', guaranteed: 'bg-success', failed: 'bg-error', impossible: 'bg-error', possible: 'bg-primary', empty: 'bg-accented'
}[props.status]))
</script>

<template>
  <UTooltip :text="meta.description">
    <span class="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-default" tabindex="0">
      <span class="size-1.5 rounded-full" :class="dot" aria-hidden="true" />{{ short ? meta.short : meta.label }}
    </span>
  </UTooltip>
</template>
