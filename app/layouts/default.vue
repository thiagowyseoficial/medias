<script setup lang="ts">
const store = useAcademicStore()
const route = useRoute()

const nav = [
  { label: 'Visão geral', short: 'Início', icon: 'i-lucide-layout-grid', to: '/', exact: true },
  { label: 'Disciplinas', short: 'Disciplinas', icon: 'i-lucide-book-open', to: '/disciplinas', exact: false },
  { label: 'Simulador', short: 'Simulador', icon: 'i-lucide-calculator', to: '/simulador', exact: true },
  { label: 'Assistente', short: 'Assistente', icon: 'i-lucide-message-square', to: '/assistente', exact: true },
  { label: 'Preferências', short: 'Ajustes', icon: 'i-lucide-settings-2', to: '/preferencias', exact: true }
]
const isActive = (item: { to: string, exact: boolean }) => item.exact ? route.path === item.to : route.path.startsWith(item.to)
</script>

<template>
  <div class="min-h-dvh">
    <!-- Sidebar (desktop) -->
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-default lg:flex" aria-label="Navegação principal">
      <NuxtLink to="/" class="flex h-14 items-center gap-2.5 px-4 focus-visible:outline-2 focus-visible:outline-primary" aria-label="Médias, início">
        <img src="/icon.svg" alt="" class="size-6 rounded-md" width="24" height="24">
        <span class="text-base font-semibold text-highlighted">Médias</span>
      </NuxtLink>

      <nav class="flex-1 space-y-5 overflow-y-auto px-2 pb-4 pt-1">
        <div class="space-y-0.5">
          <SideLink v-for="item in nav" :key="item.to" :to="item.to" :label="item.label" :icon="item.icon" :exact="item.exact" />
        </div>
        <div v-if="store.subjects.length">
          <p class="label px-2.5 pb-1.5">Disciplinas</p>
          <div class="space-y-0.5">
            <SideLink v-for="s in store.subjects" :key="s.id" :to="`/disciplinas/${s.id}`" :label="s.name" exact />
          </div>
        </div>
      </nav>

      <div class="flex items-center justify-between border-t border-default px-3 py-2.5">
        <span class="text-xs text-muted">Salvo neste navegador</span>
        <UColorModeButton color="neutral" variant="ghost" size="sm" />
      </div>
    </aside>

    <!-- Topo (mobile/tablet) -->
    <header class="safe-top sticky top-0 z-20 border-b border-default bg-default/90 backdrop-blur lg:hidden">
      <div class="flex h-12 items-center justify-between px-4">
        <NuxtLink to="/" class="flex items-center gap-2" aria-label="Médias, início">
          <img src="/icon.svg" alt="" class="size-6 rounded-md" width="24" height="24">
          <span class="text-base font-semibold text-highlighted">Médias</span>
        </NuxtLink>
        <UColorModeButton color="neutral" variant="ghost" size="sm" />
      </div>
      <OfflineBar />
    </header>

    <div class="lg:pl-60">
      <div class="hidden lg:block"><OfflineBar /></div>
      <main class="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
        <slot />
      </main>
    </div>

    <!-- Navegação inferior (mobile/tablet) -->
    <nav class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação principal">
      <NuxtLink
        v-for="item in nav" :key="item.to" :to="item.to"
        class="flex flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="isActive(item) ? 'text-primary' : 'text-muted'"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <UIcon :name="item.icon" class="size-5" />{{ item.short }}
      </NuxtLink>
    </nav>
  </div>
</template>
