<script setup lang="ts">

useSeoMeta({ title: 'Dashboard · Calculadora de Médias' })

const store = useAcademicStore()
const stats = useDashboardStats(() => store.subjects, () => store.settings)
const manager = useTemplateRef<{ openCreate: () => void }>('manager')
const formOpen = ref(false)

/** Disciplinas que exigem atenção, da mais urgente para a menos. */
const attention = computed(() => stats.value.analyses
  .filter(a => a.bucket === 'atRisk')
  .map(a => ({ id: a.subject.id, name: a.subject.name, status: a.simulation.status, required: a.simulation.requiredAverage, current: a.simulation.finalAverage ?? a.simulation.projectedAverage }))
  .sort((x, y) => (y.required ?? 99) - (x.required ?? 99)))

/** Média de cada módulo entre as disciplinas (apenas módulos com nota). */
const moduleRows = computed(() => Array.from({ length: store.settings.moduleCount }, (_, i) => {
  const results = store.subjects.map(sub => moduleResults(sub, store.settings)[i]!).filter(r => r.grade !== null)
  const value = results.length ? results.reduce((sum, r) => sum + (r.grade as number), 0) / results.length : null
  const official = results.length > 0 && results.every(r => r.status === 'official')
  return { label: `M${i + 1}`, value, kind: (value === null ? 'empty' : official ? 'official' : 'partial') as 'official' | 'partial' | 'empty', count: results.length }
}))

/** Sem disciplinas completas, mostra a projeção (média dos valores atuais) em vez de um traço. */
const hero = computed(() => {
  const s = stats.value
  if (s.generalAverage !== null) {
    const base = `${s.generalAverageCount} de ${plural(s.total, 'disciplina', 'disciplinas')}`
    return {
      label: 'Média geral',
      value: s.generalAverage,
      projected: false,
      hint: s.generalAverageProvisional ? `${base} · inclui parciais` : base
    }
  }
  const values = s.analyses.map(a => a.simulation.projectedAverage).filter((v): v is number => v !== null)
  if (!values.length) {
    return { label: 'Média geral', value: null, projected: false, hint: 'Sem notas lançadas' }
  }
  return {
    label: 'Média projetada',
    value: values.reduce((sum, v) => sum + v, 0) / values.length,
    projected: true,
    hint: `Projeção · ${plural(values.length, 'disciplina', 'disciplinas')}`
  }
})
</script>

<template>
  <div>
    <PageHeader title="Visão geral" description="Situação acadêmica das suas disciplinas.">
      <UButton v-if="store.hydrated && stats.total" label="Nova disciplina" icon="i-lucide-plus" @click="manager?.openCreate()" />
    </PageHeader>

    <div v-if="!store.hydrated" class="space-y-4" aria-busy="true" aria-label="Carregando dados">
      <USkeleton class="h-20 rounded-lg" />
      <USkeleton class="h-56 rounded-lg" />
    </div>

    <EmptyState
      v-else-if="!stats.total"
      icon="i-lucide-graduation-cap"
      title="Nenhuma disciplina cadastrada"
      description="Cadastre uma disciplina, lance as notas dos módulos e veja quanto falta para a aprovação."
    >
      <UButton label="Cadastrar disciplina" icon="i-lucide-plus" @click="formOpen = true" />
    </EmptyState>

    <div v-else class="space-y-4">
      <!-- Indicadores -->
      <dl class="panel grid grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] [&>*]:border-default max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:nth-child(even)]:border-l lg:[&>*+*]:border-l">
        <Stat :label="hero.label" :value="formatAverage(hero.value)" :hint="hero.hint" :projected="hero.projected" large />
        <Stat label="Aprovadas" :value="String(stats.approved)" tone="success" :hint="`de ${stats.total}`" tooltip="Todas as avaliações lançadas e média final igual ou acima do mínimo." />
        <Stat label="Em andamento" :value="String(stats.inProgress)" hint="avaliações pendentes" />
        <Stat label="Em risco" :value="String(stats.atRisk)" :tone="stats.atRisk ? 'error' : 'default'" :hint="stats.atRisk ? 'exigem atenção' : 'nenhuma'" tooltip="Aprovação impossível, não aprovada pela nota ou que exige média acima do mínimo nas avaliações pendentes." />
      </dl>

      <!-- Disciplinas -->
      <section class="panel overflow-hidden" aria-label="Disciplinas">
        <div class="panel-header">
          <h2 class="panel-title">Disciplinas</h2>
          <NuxtLink to="/disciplinas" class="text-xs font-medium text-muted hover:text-highlighted">Gerenciar</NuxtLink>
        </div>
        <SubjectTable ref="manager" :analyses="stats.analyses" />
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="panel" aria-label="Média por módulo">
          <div class="panel-header"><h2 class="panel-title">Média por módulo</h2><span class="text-xs text-muted">entre as disciplinas</span></div>
          <ul class="divide-y divide-default px-4">
            <li v-for="m in moduleRows" :key="m.label" class="grid grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-3 py-2.5">
              <span class="text-sm font-medium text-muted">{{ m.label }}</span>
              <GradeRuler :value="m.value" :threshold="store.settings.minPassingGrade" :kind="m.kind" :label="`Média do módulo ${m.label}`" />
              <span class="num text-right text-sm font-medium" :class="m.value === null ? 'text-dimmed' : 'text-highlighted'">{{ formatGrade(m.value) }}</span>
            </li>
          </ul>
        </section>

        <section class="panel" aria-label="Requer atenção">
          <div class="panel-header"><h2 class="panel-title">Requer atenção</h2><span class="text-xs text-muted">{{ attention.length }} {{ attention.length === 1 ? 'disciplina' : 'disciplinas' }}</span></div>
          <ul v-if="attention.length" class="divide-y divide-default px-4">
            <li v-for="a in attention" :key="a.id" class="flex items-center justify-between gap-3 py-2.5">
              <div class="min-w-0">
                <NuxtLink :to="`/disciplinas/${a.id}`" class="block truncate text-sm font-medium text-highlighted hover:text-primary">{{ a.name }}</NuxtLink>
                <StatusBadge :status="a.status" />
              </div>
              <div class="text-right">
                <p class="num text-sm font-medium" :class="a.status === 'impossible' || a.status === 'failed' ? 'text-error' : 'text-highlighted'">{{ a.status === 'impossible' ? 'inalcançável' : a.status === 'failed' ? formatGrade(a.current) : formatGrade(a.required) }}</p>
                <p class="text-xs text-muted">{{ a.status === 'impossible' || a.status === 'failed' ? 'média final' : 'precisa no que falta' }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="flex items-center gap-2 px-4 py-6 text-sm text-muted"><UIcon name="i-lucide-check" class="size-4 text-success" />Nenhuma disciplina em risco.</p>
        </section>
      </div>
    </div>

    <SubjectFormModal v-model:open="formOpen" @saved="(s) => navigateTo(`/disciplinas/${s.id}`)" />
  </div>
</template>
