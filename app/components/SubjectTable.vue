<script setup lang="ts">
import type { SubjectAnalysis } from '~/composables/useDashboardStats'
import type { Subject } from '~/types'

const props = defineProps<{ analyses: SubjectAnalysis[] }>()

const store = useAcademicStore()
const toast = useToast()
const router = useRouter()

const formOpen = ref(false)
const editing = ref<Subject | null>(null)
const removing = ref<Subject | null>(null)
const confirmOpen = ref(false)

function openCreate() { editing.value = null; formOpen.value = true }
function openEdit(s: Subject) { editing.value = s; formOpen.value = true }
function askRemove(s: Subject) { removing.value = s; confirmOpen.value = true }
function remove() {
  if (!removing.value) return
  store.removeSubject(removing.value.id)
  toast.add({ title: 'Disciplina excluída', description: removing.value.name, color: 'neutral' })
  removing.value = null
}

type Kind = 'official' | 'partial' | 'simulated' | 'empty'
const kindLabel: Record<Kind, string> = { official: 'final', partial: 'parcial', simulated: 'projeção', empty: '' }

const rows = computed(() => props.analyses.map(({ subject, simulation: sim }) => {
  const modules = moduleResults(subject, store.settings)
  const current = sim.finalAverage ?? sim.projectedAverage
  const kind: Kind = sim.complete ? 'official' : sim.finalAverage !== null ? 'partial' : current !== null ? 'simulated' : 'empty'
  const needs = modules.map((m, i) => {
    const n = sim.modules.find(x => x.index === i)
    return n && sim.status !== 'guaranteed' ? moduleNeedFigure(n, m) : null
  })
  let need = '—'
  if (sim.status === 'impossible') need = 'Inalcançável'
  else if (sim.status === 'guaranteed') need = 'Garantida'
  else if (sim.requiredAverage !== null) need = `${formatGrade(sim.requiredAverage)} no que falta`
  return {
    subject, sim, modules, needs, current, kind, need,
    menu: [[
      { label: 'Abrir no simulador', icon: 'i-lucide-calculator', to: `/simulador?disciplina=${subject.id}` },
      { label: 'Editar', icon: 'i-lucide-pencil', onSelect: () => openEdit(subject) }
    ], [
      { label: 'Excluir', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => askRemove(subject) }
    ]]
  }
}))

const needText = (n: NonNullable<(typeof rows.value)[number]['needs'][number]>) =>
  n.impossible ? 'impossível' : n.any ? 'qualquer' : formatGrade(n.value)

defineExpose({ openCreate })
</script>

<template>
  <div>
    <!-- Tabela (tablet/desktop) -->
    <div class="hidden overflow-x-auto md:block">
      <table class="tbl">
        <thead>
          <tr>
            <th scope="col" class="w-full min-w-44">Disciplina</th>
            <th v-for="n in store.settings.moduleCount" :key="n" scope="col" class="r w-24">M{{ n }}</th>
            <th scope="col" class="r w-24">Média</th>
            <th scope="col" class="w-44 min-w-44">0 a 10</th>
            <th scope="col" class="w-36 min-w-32">Situação</th>
            <th scope="col" class="w-48 min-w-44">Precisa</th>
            <th scope="col" class="w-10"><span class="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.subject.id">
            <td>
              <NuxtLink :to="`/disciplinas/${r.subject.id}`" class="block max-w-64 truncate font-medium text-highlighted hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{{ r.subject.name }}</NuxtLink>
              <span v-if="r.subject.code || r.subject.professor" class="block max-w-64 truncate text-xs text-muted">{{ [r.subject.code, r.subject.professor].filter(Boolean).join(' · ') }}</span>
            </td>
            <td v-for="(m, i) in r.modules" :key="i" class="r whitespace-nowrap">
              <span class="num block" :class="m.status === 'pending' ? 'text-dimmed' : m.status === 'partial' ? 'text-warning' : 'text-default'" :title="m.status === 'partial' ? 'Média parcial' : undefined">{{ formatGrade(m.grade) }}</span>
              <span v-if="r.needs[i]" class="num block text-xs" :class="r.needs[i]!.impossible ? 'text-error' : 'text-primary'" :title="`Precisa tirar ${needText(r.needs[i]!)} neste módulo`">→ {{ needText(r.needs[i]!) }}</span>
            </td>
            <td class="r">
              <span class="num block text-base font-medium" :class="[r.kind === 'empty' ? 'text-dimmed' : 'text-highlighted', r.kind === 'simulated' ? 'is-projected' : '']">{{ formatAverage(r.current, r.sim.effectiveThreshold) }}</span>
              <span v-if="kindLabel[r.kind]" class="block text-xs text-muted">{{ kindLabel[r.kind] }}</span>
            </td>
            <td>
              <GradeRuler
                :value="r.current" :threshold="r.sim.effectiveThreshold" :kind="r.kind"
                :range-min="r.sim.complete ? undefined : r.sim.worstCase" :range-max="r.sim.complete ? undefined : r.sim.bestCase"
                :label="`Média de ${r.subject.name}`"
              />
            </td>
            <td><StatusBadge :status="r.sim.status" /></td>
            <td class="whitespace-nowrap text-sm text-muted">{{ r.need }}</td>
            <td class="r">
              <UDropdownMenu :items="r.menu" :content="{ align: 'end' }">
                <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-ellipsis" :aria-label="`Ações de ${r.subject.name}`" />
              </UDropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Lista (celular) -->
    <ul class="divide-y divide-default md:hidden">
      <li v-for="r in rows" :key="r.subject.id" class="px-4 py-3">
        <div class="flex items-start gap-2">
          <NuxtLink :to="`/disciplinas/${r.subject.id}`" class="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-primary">
            <span class="block truncate text-base font-medium text-highlighted">{{ r.subject.name }}</span>
            <span class="mt-0.5 block"><StatusBadge :status="r.sim.status" /></span>
          </NuxtLink>
          <div class="text-right">
            <span class="num block text-xl font-medium" :class="[r.kind === 'empty' ? 'text-dimmed' : 'text-highlighted', r.kind === 'simulated' ? 'is-projected' : '']">{{ formatAverage(r.current, r.sim.effectiveThreshold) }}</span>
            <span v-if="kindLabel[r.kind]" class="block text-xs text-muted">{{ kindLabel[r.kind] }}</span>
          </div>
          <UDropdownMenu :items="r.menu" :content="{ align: 'end' }">
            <UButton color="neutral" variant="ghost" size="md" icon="i-lucide-ellipsis" :aria-label="`Ações de ${r.subject.name}`" />
          </UDropdownMenu>
        </div>
        <div class="mt-2.5"><GradeRuler :value="r.current" :threshold="r.sim.effectiveThreshold" :kind="r.kind" :range-min="r.sim.complete ? undefined : r.sim.worstCase" :range-max="r.sim.complete ? undefined : r.sim.bestCase" :label="`Média de ${r.subject.name}`" /></div>
        <p class="num mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted">
          <span v-for="(m, i) in r.modules" :key="i">
            <span class="text-xs">M{{ i + 1 }}</span>
            <span class="ml-1" :class="m.status === 'partial' ? 'text-warning' : m.status === 'pending' ? 'text-dimmed' : 'text-default'">{{ formatGrade(m.grade) }}</span>
            <span v-if="r.needs[i]" class="ml-1 text-xs" :class="r.needs[i]!.impossible ? 'text-error' : 'text-primary'">→ {{ needText(r.needs[i]!) }}</span>
          </span>
        </p>
        <p v-if="r.need !== '—'" class="mt-1 text-xs text-muted">Precisa: {{ r.need }}</p>
      </li>
    </ul>

    <p v-if="!rows.length" class="px-4 py-10 text-center text-sm text-muted">Nenhuma disciplina encontrada.</p>

    <SubjectFormModal v-model:open="formOpen" :subject="editing" @saved="(s) => { if (!editing) router.push(`/disciplinas/${s.id}`) }" />
    <ConfirmModal
      v-model:open="confirmOpen" title="Excluir disciplina?"
      :description="`“${removing?.name ?? ''}” e todas as suas notas e atividades serão removidas. Esta ação não pode ser desfeita.`"
      confirm-label="Excluir disciplina" @confirm="remove"
    />
  </div>
</template>
