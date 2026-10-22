<script setup lang="ts">
import { EPS } from '~/utils/number'

useSeoMeta({ title: 'Simulador · Calculadora de Médias' })

const store = useAcademicStore()
const route = useRoute()

const subjectId = ref('')
function init() {
  if (!store.hydrated) return
  subjectId.value = store.getSubject(String(route.query.disciplina ?? ''))?.id ?? store.subjects[0]?.id ?? ''
}
watch(() => store.hydrated, init, { immediate: true })

const subjectItems = computed(() => store.subjects.map(s => ({ label: s.name, value: s.id })))
const { subject, hypo, clear, plan, allKeys, base, sim, moduleAfter, needFor, filled, shown, kind, setHypo, fillNeeded } = useHypothetical(subjectId)

const min = computed(() => store.settings.minPassingGrade)
const numberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 2 }
</script>

<template>
  <div>
    <PageHeader title="Simulador" description="Teste notas hipotéticas nas avaliações que faltam. Nada é salvo.">
      <USelect
        v-if="store.hydrated && subjectItems.length" v-model="subjectId" :items="subjectItems"
        class="w-56" aria-label="Disciplina"
      />
    </PageHeader>

    <div v-if="!store.hydrated" class="space-y-3" aria-busy="true"><USkeleton class="h-40 rounded-lg" /><USkeleton class="h-56 rounded-lg" /></div>

    <EmptyState
      v-else-if="!subject || !sim || !base"
      icon="i-lucide-calculator"
      title="Cadastre uma disciplina para simular"
      description="O simulador usa as notas que você já lançou e mostra o que falta para a aprovação."
    >
      <UButton to="/disciplinas" label="Ir para Disciplinas" color="neutral" variant="outline" icon="i-lucide-arrow-right" trailing />
    </EmptyState>

    <div v-else class="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <!-- Notas hipotéticas -->
      <div class="space-y-3 lg:order-1">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium text-highlighted">Avaliações</h2>
          <div class="flex gap-2">
            <UButton
              v-if="sim.requiredAverage !== null && sim.requiredAverage <= 10 + EPS && sim.requiredAverage > EPS && filled < allKeys.length"
              size="sm" icon="i-lucide-wand-sparkles" label="Usar a nota necessária" @click="fillNeeded"
            />
            <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" label="Limpar" :disabled="!filled" @click="clear" />
          </div>
        </div>

        <section v-for="p in plan" :key="p.index" class="panel overflow-hidden" :aria-label="`Módulo ${p.label}`">
          <div class="panel-header">
            <h3 class="panel-title">Módulo {{ p.label }}</h3>
            <p class="text-sm text-muted">
              <template v-if="p.status === 'official'"><span class="inline-flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-success" />Concluído</span> · <span class="num font-medium text-highlighted">{{ formatGrade(p.real) }}</span></template>
              <template v-else>termina com <span class="num font-medium" :class="p.items.some(i => hypo[i.key] != null) ? 'text-highlighted' : 'text-dimmed'">{{ p.items.some(i => hypo[i.key] != null) || p.real !== null ? formatGrade(moduleAfter(p.index)?.grade) : '—' }}</span></template>
            </p>
          </div>

          <div v-if="needFor(p.index) && sim.status !== 'guaranteed'" class="flex flex-wrap items-baseline gap-x-2 border-b border-default bg-primary/5 px-4 py-2 text-sm">
            <span class="text-toned">Para passar, precisa tirar</span>
            <span class="num font-medium" :class="needFor(p.index)!.impossible ? 'text-error' : 'text-primary'">
              {{ needFor(p.index)!.impossible ? 'impossível' : needFor(p.index)!.any ? 'qualquer nota' : formatGrade(needFor(p.index)!.value) }}
            </span>
            <span class="text-xs text-muted">{{ needFor(p.index)!.scope === 'pending' ? 'nas atividades que faltam' : 'neste módulo' }}</span>
            <span v-if="sim.modules.length > 1 && !needFor(p.index)!.impossible && !needFor(p.index)!.any" class="text-xs text-muted">· mínimo <span class="num">{{ formatGrade(needFor(p.index)!.min) }}</span> com 10 nos outros</span>
          </div>

          <p v-if="p.status === 'partial'" class="border-b border-default px-4 py-2 text-xs text-muted"><span class="font-medium text-warning">Parcial {{ formatGrade(p.real) }}</span> com as atividades já avaliadas.</p>

          <ul v-if="p.items.length" class="divide-y divide-default">
            <li v-for="it in p.items" :key="it.key" class="grid items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(7rem,11rem)]">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">{{ it.label }}</p>
                <p v-if="it.weight" class="text-xs text-muted">peso <span class="num">{{ formatNumber(it.weight) }}</span></p>
              </div>
              <UInputNumber
                :model-value="hypo[it.key] ?? null" :min="0" :max="10" :step="0.1" :step-snapping="false" locale="pt-BR"
                :format-options="numberFormat" placeholder="Em branco" size="sm" :aria-label="`Nota hipotética: ${p.label}, ${it.label}`"
                @update:model-value="(v) => setHypo(it.key, v)"
              />
              <USlider
                :model-value="hypo[it.key] ?? 0" :min="0" :max="10" :step="0.25" size="sm" :aria-label="`Ajustar nota: ${p.label}, ${it.label}`"
                @update:model-value="(v) => setHypo(it.key, v as number)"
              />
            </li>
          </ul>
          <p v-else-if="p.status !== 'official'" class="px-4 py-3 text-sm text-muted">Sem atividades pendentes para simular.</p>
        </section>
      </div>

      <!-- Resultado -->
      <aside class="panel lg:sticky lg:top-6 lg:order-2" aria-label="Resultado da simulação" aria-live="polite">
        <div class="panel-header">
          <h2 class="panel-title">Resultado</h2>
          <span class="text-xs text-muted">{{ filled ? 'simulado' : 'situação atual' }}</span>
        </div>
        <div class="space-y-5 p-4">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="label">Média final</p>
              <p class="num mt-1 text-3xl font-medium leading-none" :class="[kind === 'empty' ? 'text-dimmed' : 'text-highlighted', kind === 'simulated' ? 'is-projected' : '']">{{ formatAverage(shown, sim.effectiveThreshold) }}</p>
            </div>
            <StatusBadge :status="sim.status" :short="false" />
          </div>

          <GradeRuler
            :value="shown" :threshold="sim.effectiveThreshold" :kind="kind" scale
            :range-min="sim.complete ? undefined : sim.worstCase" :range-max="sim.complete ? undefined : sim.bestCase"
            label="Média final simulada"
          />

          <SimLead :sim="sim" :min="min" simulated />

          <dl class="space-y-2 border-t border-default pt-4">
            <div class="kv"><dt class="text-muted">Notas hipotéticas</dt><span class="leader" /><dd class="num font-medium text-highlighted">{{ filled }} de {{ allKeys.length }}</dd></div>
            <div class="kv"><dt class="text-muted">Falta para aprovar</dt><span class="leader" /><dd class="num font-medium text-highlighted">{{ sim.missing <= EPS ? '0,00' : formatGrade(sim.missing) }}</dd></div>
            <div v-if="!sim.complete && sim.requiredAverage !== null" class="kv">
              <dt class="text-muted">Ainda preciso de média</dt><span class="leader" />
              <dd class="num font-medium" :class="sim.requiredAverage > 10 + EPS ? 'text-error' : sim.requiredAverage <= EPS ? 'text-success' : 'text-primary'">
                {{ sim.requiredAverage > 10 + EPS ? 'impossível' : sim.requiredAverage <= EPS ? 'qualquer' : formatGrade(sim.requiredAverage) }}
              </dd>
            </div>
            <div v-if="!sim.complete" class="kv"><dt class="text-muted">Pior / melhor cenário</dt><span class="leader" /><dd class="num font-medium text-highlighted">{{ formatGrade(sim.worstCase) }} / {{ formatGrade(sim.bestCase) }}</dd></div>
          </dl>

          <UButton :to="`/disciplinas/${subject.id}`" block color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-arrow-right" :label="`Lançar notas reais em ${subject.name}`" />
        </div>
      </aside>
    </div>
  </div>
</template>
