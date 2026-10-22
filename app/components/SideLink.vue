<script setup lang="ts">
const props = defineProps<{ to: string, label: string, icon?: string, exact?: boolean }>()
const route = useRoute()
const active = computed(() => props.exact ? route.path === props.to : route.path.startsWith(props.to))
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    :class="active ? 'bg-elevated text-highlighted' : 'text-muted hover:bg-muted hover:text-highlighted'"
    :aria-current="active ? 'page' : undefined"
  >
    <UIcon v-if="icon" :name="icon" class="size-4 shrink-0" />
    <span v-else class="size-1.5 shrink-0 rounded-full bg-current opacity-50" aria-hidden="true" />
    <span class="truncate">{{ label }}</span>
  </NuxtLink>
</template>
