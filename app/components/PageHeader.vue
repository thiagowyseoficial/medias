<script setup lang="ts">
defineProps<{ title: string, description?: string, parent?: { label: string, to: string } }>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
    <div class="min-w-0">
      <NuxtLink v-if="parent" :to="parent.to" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary">
        <UIcon name="i-lucide-chevron-left" class="size-3.5" />{{ parent.label }}
      </NuxtLink>
      <h1 class="truncate text-xl font-semibold tracking-tight text-highlighted">{{ title }}</h1>
      <p v-if="description" class="mt-0.5 text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-2"><slot /></div>
  </header>
</template>
