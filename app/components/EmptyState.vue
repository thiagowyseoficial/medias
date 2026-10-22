<script setup lang="ts">
defineProps<{ icon: string, title: string, description: string }>()
</script>

<template>
  <div class="flex flex-col items-center rounded-lg border border-dashed border-accented px-6 py-14 text-center">
    <span class="mb-3 flex size-9 items-center justify-center rounded-md border border-default bg-default text-muted">
      <UIcon :name="icon" class="size-4.5" />
    </span>
    <h2 class="text-base font-semibold text-highlighted">{{ title }}</h2>
    <p class="mt-1 max-w-sm text-sm text-muted">{{ description }}</p>
    <div class="mt-4"><slot /></div>
  </div>
</template>
