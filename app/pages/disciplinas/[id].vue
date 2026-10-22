<script setup lang="ts">
const route = useRoute()
const store = useAcademicStore()
const toast = useToast()

const id = computed(() => String(route.params.id))
const subject = computed(() => store.getSubject(id.value))
const sim = computed(() => subject.value ? simulate(subject.value, store.settings) : null)
const modules = computed(() => subject.value ? moduleResults(subject.value, store.settings) : [])

useSeoMeta({ title: () => `${subject.value?.name ?? 'Disciplina'} · Calculadora de Médias` })

const showMemory = useLocalStorage('calculadora-medias:memoria', false, { initOnMounted: true })

const editOpen = ref(false)
const deleteOpen = ref(false)
function remove() {
  if (!subject.value) return
  const name = subject.value.name
  store.removeSubject(subject.value.id)
  toast.add({ title: 'Disciplina excluída', description: name, color: 'neutral', icon: 'i-lucide-trash-2' })
  navigateTo('/')
}

const current = computed(() => sim.value?.finalAverage ?? sim.value?.projectedAverage ?? null)
const dataState = computed(() => !sim.value ? 'empty'
  : sim.value.complete ? 'official' : sim.value.finalAverage !== null ? 'partial' : current.value !== null ? 'simulated' : 'empty')
const dataStateLabel = computed(() => ({
  official: 'oficial', partial: 'parcial', simulated: 'projetada', empty: 'sem dados'
}[dataState.value]))
const doneModules = computed(() => modules.value.filter(m => m.status === 'official').length)
const progress = computed(() => modules.value.length ? Math.round(doneModules.value / modules.value.length * 100) : 0)
</script>

<template>
  <div v-if="!store.hydrated" class="space-y-4" aria-busy="true">
    <USkeleton class="h-8 w-56" /><USkeleton class="h-20 rounded-lg" /><USkeleton class="h-72 rounded-lg" />
  </div>

  <EmptyState
    v-else-if="!subject || !sim"
    icon="i-lucide-search-x"
    title="Disciplina não encontrada"
    description="Ela pode ter sido excluída ou o endereço está incorreto."
  >
    <UButton to="/disciplinas" label="Voltar às disciplinas" color="neutral" variant="outline" icon="i-lucide-arrow-left" />
  </EmptyState>

  <div v-else>
    <PageHeader
      :title="subject.name"
      :description="[subject.code, subject.professor].filter(Boolean).join(' · ') || undefined"
      :parent="{ label: 'Disciplinas', to: '/disciplinas' }"
    >
      <UButton color="neutral" variant="outline" icon="i-lucide-pencil" label="Editar" @click="editOpen = true" />
      <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Excluir" @click="deleteOpen = true" />
    </PageHeader>

    <div class="space-y-4">
      <!-- Resumo -->
      <section class="panel grid items-center gap-x-8 gap-y-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)]" aria-label="Resumo">
        <div class="flex items-center gap-6">
          <div>
            <p class="label">Média final · {{ dataStateLabel }}</p>
            <p class="num mt-1 text-3xl font-medium leading-none" :class="[dataState === 'empty' ? 'text-dimmed' : 'text-highlighted', dataState === 'simulated' ? 'is-projected' : '']">{{ formatAverage(current, sim.effectiveThreshold) }}</p>
          </div>
          <div class="space-y-1">
            <StatusBadge :status="sim.status" :short="false" />
            <p class="text-xs text-muted"><span class="num">{{ doneModules }}/{{ modules.length }}</span> módulos concluídos</p>
          </div>
        </div>
        <div>
          <GradeRuler
            :value="current" :threshold="sim.effectiveThreshold" :kind="dataState as 'official' | 'partial' | 'simulated' | 'empty'" scale
            :range-min="sim.complete ? undefined : sim.worstCase" :range-max="sim.complete ? undefined : sim.bestCase"
            label="Média final"
          />
          <p v-if="dataState === 'simulated'" class="mt-1 text-xs text-muted">Projeção: supõe que os módulos pendentes terão a média dos já lançados.</p>
        </div>
      </section>

      <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <!-- Notas -->
        <div class="space-y-3 lg:order-1">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-medium text-highlighted">Notas por módulo</h2>
            <USwitch v-model="showMemory" label="Memória de cálculo" size="sm" />
          </div>
          <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <ModuleCard
              v-for="(m, i) in modules" :key="subject.modules[i]?.id ?? i"
              :subject-id="subject.id" :module-index="i" :show-memory="showMemory"
            />
          </div>
        </div>

        <!-- Simulador sempre à vista -->
        <aside class="panel lg:sticky lg:top-6 lg:order-2" aria-label="Simulador">
          <div class="panel-header">
            <h2 class="panel-title flex items-center gap-2"><UIcon name="i-lucide-calculator" class="size-4 text-muted" />Simulador</h2>
          </div>
          <div class="p-4"><SimulatorPanel :subject-id="subject.id" :show-memory="showMemory" part="summary" /></div>
        </aside>
      </div>

      <SimulatorPanel v-if="!sim.complete || showMemory" :subject-id="subject.id" :show-memory="showMemory" part="detail" />
    </div>

    <SubjectFormModal v-model:open="editOpen" :subject="subject" />
    <ConfirmModal
      v-model:open="deleteOpen" title="Excluir disciplina?"
      :description="`“${subject.name}” e todas as suas notas e atividades serão removidas. Esta ação não pode ser desfeita.`"
      confirm-label="Excluir disciplina" @confirm="remove"
    />
  </div>
</template>
