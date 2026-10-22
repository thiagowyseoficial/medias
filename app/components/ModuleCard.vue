<script setup lang="ts">
import type { Activity, EvaluationMethod } from '~/types'

const props = defineProps<{ subjectId: string, moduleIndex: number, showMemory: boolean }>()

const store = useAcademicStore()
const subject = computed(() => store.getSubject(props.subjectId)!)
const module = computed(() => subject.value.modules[props.moduleIndex]!)
const result = computed(() => computeModule(module.value))
const sim = computed(() => simulate(subject.value, store.settings))
const need = computed(() => {
  const n = sim.value.modules.find(m => m.index === props.moduleIndex)
  return n ? moduleNeedFigure(n, result.value) : null
})
const meta = computed(() => moduleStatusMeta[result.value.status])

const statusDot = { official: 'bg-success', partial: 'bg-warning', pending: 'bg-accented' } as const

const methodItems = [
  { label: 'Nota direta', value: 'direct' },
  { label: 'Atividades', value: 'activities' }
]

const formOpen = ref(false)
const editing = ref<Activity | null>(null)
const confirmOpen = ref(false)
const removing = ref<Activity | null>(null)

const numberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 2 }

function openCreate() { editing.value = null; formOpen.value = true }
function openEdit(a: Activity) { editing.value = a; formOpen.value = true }
function askRemove(a: Activity) { removing.value = a; confirmOpen.value = true }
function remove() {
  if (removing.value) store.removeActivity(props.subjectId, props.moduleIndex, removing.value.id)
  removing.value = null
}

function setGrade(a: Activity, value: number | null | undefined) {
  store.updateActivity(props.subjectId, props.moduleIndex, a.id, { name: a.name, weight: a.weight, grade: value ?? null })
}

const rows = computed(() => module.value.activities.map(a => ({
  a,
  evaluated: isEvaluated(a),
  product: isEvaluated(a) ? (a.grade as number) * a.weight : null
})))
const sumWeights = computed(() => result.value.evaluatedWeight)
</script>

<template>
  <section class="panel overflow-hidden" :aria-label="`Módulo ${module.label}`">
    <div class="panel-header">
      <div class="flex items-center gap-2.5">
        <h3 class="panel-title">Módulo {{ module.label }}</h3>
        <span class="inline-flex items-center gap-1.5 text-xs text-muted"><span class="size-1.5 rounded-full" :class="statusDot[result.status]" aria-hidden="true" />{{ meta.label }}</span>
      </div>
      <p class="num text-lg font-medium leading-none" :class="result.grade === null ? 'text-dimmed' : result.status === 'partial' ? 'text-warning' : 'text-highlighted'" :title="result.status === 'partial' ? 'Média parcial' : 'Média do módulo'">
        {{ formatGrade(result.grade) }}
      </p>
    </div>

    <div class="space-y-4 p-4">
      <!-- Quanto precisa tirar neste módulo -->
      <div v-if="need && sim.status !== 'guaranteed'" class="rounded-md border px-3 py-2.5" :class="need.impossible ? 'border-error/30 bg-error/5' : 'border-primary/25 bg-primary/5'" aria-label="Nota necessária neste módulo">
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-sm text-toned">Precisa tirar</span>
          <span class="num text-lg font-medium" :class="need.impossible ? 'text-error' : 'text-primary'">{{ need.impossible ? 'impossível' : need.any ? 'qualquer nota' : formatGrade(need.value) }}</span>
        </div>
        <p class="mt-0.5 text-xs text-muted">
          {{ need.scope === 'pending' ? 'de média nas atividades que faltam' : 'de média neste módulo' }}<template v-if="sim.modules.length > 1"> · supondo os outros pendentes iguais</template>
        </p>
        <p v-if="sim.modules.length > 1 && !need.impossible && !need.any" class="mt-0.5 text-xs text-muted">
          Mínimo possível <span class="num font-medium text-default">{{ formatGrade(need.min) }}</span> se tirar 10 nos outros
        </p>
      </div>
      <p v-else-if="sim.status === 'guaranteed' && result.status !== 'official'" class="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
        Aprovação garantida: qualquer nota neste módulo serve.
      </p>

      <UTabs
        :model-value="module.method" :items="methodItems" :content="false" size="sm" variant="link" color="neutral"
        :ui="{ root: 'gap-0', list: 'border-b border-default', trigger: 'px-0 pb-2 mr-5' }" class="w-full"
        @update:model-value="(v) => store.setMethod(subjectId, moduleIndex, v as EvaluationMethod)"
      />

      <div v-if="module.method === 'direct'" class="space-y-2">
        <UFormField label="Média do módulo" :name="`direct-${moduleIndex}`" hint="0 a 10">
          <UInputNumber
            :model-value="module.directGrade"
            :min="0" :max="10" :step="0.1" :step-snapping="false" locale="pt-BR" :format-options="numberFormat"
            placeholder="Não informada" class="w-full"
            @update:model-value="(v) => store.setDirectGrade(subjectId, moduleIndex, v ?? null)"
          />
        </UFormField>
        <p v-if="module.activities.length" class="text-xs text-muted">
          {{ module.activities.length }} atividade(s) preservada(s); voltam a valer ao usar “Atividades”.
        </p>
      </div>

      <div v-else class="space-y-3">
        <p v-if="result.status === 'partial'" class="text-xs text-muted">
          <span class="font-medium text-warning">Parcial:</span> {{ result.evaluatedCount }} de {{ result.totalCount }} atividades avaliadas. As pendentes não entram como zero.
        </p>

        <p v-if="!rows.length" class="rounded-md border border-dashed border-accented py-5 text-center text-sm text-muted">Nenhuma atividade neste módulo.</p>

        <ul v-else class="divide-y divide-default rounded-md border border-default">
          <li v-for="r in rows" :key="r.a.id" class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
            <div class="min-w-0 flex-1 basis-28">
              <p class="truncate text-sm font-medium text-highlighted">{{ r.a.name }}</p>
              <p class="text-xs text-muted">peso <span class="num">{{ formatNumber(r.a.weight) }}</span><template v-if="!r.evaluated"> · pendente</template></p>
            </div>
            <UInputNumber
              :model-value="r.a.grade" :min="0" :max="10" :step="0.1" :step-snapping="false" locale="pt-BR"
              :format-options="numberFormat" placeholder="Pendente" size="sm" class="w-32" :aria-label="`Nota de ${r.a.name}`"
              @update:model-value="(v) => setGrade(r.a, v)"
            />
            <div class="flex">
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-pencil" :aria-label="`Editar ${r.a.name}`" @click="openEdit(r.a)" />
              <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-trash-2" :aria-label="`Excluir ${r.a.name}`" @click="askRemove(r.a)" />
            </div>
          </li>
        </ul>

        <UButton icon="i-lucide-plus" label="Adicionar atividade" color="neutral" variant="outline" size="sm" @click="openCreate" />

        <div v-if="showMemory" class="overflow-x-auto rounded-md bg-muted p-3" aria-label="Memória de cálculo">
          <p class="label mb-2">Memória de cálculo</p>
          <p v-if="result.grade === null" class="text-sm text-muted">Nenhuma atividade avaliada: não há média para calcular.</p>
          <template v-else>
            <table class="num w-full min-w-64 text-left text-xs">
              <thead class="text-muted">
                <tr><th class="pb-1 font-normal">Atividade</th><th class="pb-1 text-right font-normal">Nota</th><th class="pb-1 text-right font-normal">Peso</th><th class="pb-1 text-right font-normal">Nota × peso</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in rows" :key="r.a.id" :class="r.evaluated ? '' : 'text-muted line-through decoration-dotted'">
                  <td class="py-0.5">{{ r.a.name }}</td>
                  <td class="py-0.5 text-right">{{ r.evaluated ? formatNumber(r.a.grade) : 'pendente' }}</td>
                  <td class="py-0.5 text-right">{{ formatNumber(r.a.weight) }}</td>
                  <td class="py-0.5 text-right">{{ r.product === null ? '—' : formatNumber(r.product) }}</td>
                </tr>
              </tbody>
              <tfoot class="border-t border-accented font-medium">
                <tr>
                  <td class="pt-1.5">Σ avaliadas</td><td />
                  <td class="pt-1.5 text-right">{{ formatNumber(sumWeights) }}</td>
                  <td class="pt-1.5 text-right">{{ formatNumber(result.weightedSum) }}</td>
                </tr>
              </tfoot>
            </table>
            <p class="num mt-2 text-xs">
              média = {{ formatNumber(result.weightedSum) }} ÷ {{ formatNumber(sumWeights) }} = <strong>{{ formatGrade(result.grade) }}</strong>
              <span v-if="result.status === 'partial'" class="font-sans text-muted"> (parcial, peso pendente {{ formatNumber(result.pendingWeight) }})</span>
            </p>
          </template>
        </div>
      </div>
    </div>

    <ActivityFormModal v-model:open="formOpen" :subject-id="subjectId" :module-index="moduleIndex" :activity="editing" />
    <ConfirmModal
      v-model:open="confirmOpen" title="Excluir atividade?"
      :description="`“${removing?.name ?? ''}” será removida do módulo ${module.label}.`" confirm-label="Excluir atividade"
      @confirm="remove"
    />
  </section>
</template>
