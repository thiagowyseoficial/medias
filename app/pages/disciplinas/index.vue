<script setup lang="ts">
useSeoMeta({ title: 'Disciplinas · Calculadora de Médias' })

const store = useAcademicStore()
const stats = useDashboardStats(() => store.subjects, () => store.settings)
const manager = useTemplateRef<{ openCreate: () => void }>('manager')
const formOpen = ref(false)
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? stats.value.analyses.filter(a => `${a.subject.name} ${a.subject.code} ${a.subject.professor}`.toLowerCase().includes(q)) : stats.value.analyses
})
</script>

<template>
  <div>
    <PageHeader title="Disciplinas" description="Cadastro, edição e situação de cada disciplina.">
      <UButton v-if="store.hydrated && stats.total" icon="i-lucide-plus" label="Nova disciplina" @click="manager?.openCreate()" />
    </PageHeader>

    <div v-if="!store.hydrated" class="space-y-2" aria-busy="true">
      <USkeleton v-for="i in 4" :key="i" class="h-12 rounded-md" />
    </div>
    <EmptyState
      v-else-if="!stats.total"
      icon="i-lucide-book-open"
      title="Nenhuma disciplina cadastrada"
      description="Cadastre uma disciplina para começar a lançar suas notas."
    >
      <UButton label="Cadastrar disciplina" icon="i-lucide-plus" @click="formOpen = true" />
    </EmptyState>
    <section v-else class="panel overflow-hidden">
      <div class="panel-header">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Buscar disciplina" size="sm" class="w-full max-w-xs" aria-label="Buscar disciplina" />
        <span class="num text-xs text-muted">{{ filtered.length }} de {{ stats.total }}</span>
      </div>
      <SubjectTable ref="manager" :analyses="filtered" />
    </section>

    <SubjectFormModal v-model:open="formOpen" @saved="(s) => navigateTo(`/disciplinas/${s.id}`)" />
  </div>
</template>
