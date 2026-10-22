<script setup lang="ts">
import { EPS } from '~/utils/number'

/**
 * Simulador da disciplina.
 * - `summary`: resumo vivo (painel lateral): frase, números e "e se eu tirar…".
 * - `detail`: cenários, necessário por módulo e memória de cálculo.
 */
const props = withDefaults(defineProps<{ subjectId: string, showMemory: boolean, part?: 'summary' | 'detail' }>(), { part: 'summary' })

const store = useAcademicStore()
const subject = computed(() => store.getSubject(props.subjectId)!)
const sim = computed(() => simulate(subject.value, store.settings))
const min = computed(() => store.settings.minPassingGrade)

const whatIf = ref(7)
const whatIfAverage = computed(() => {
  const { worstCase, bestCase } = sim.value
  return worstCase + (bestCase - worstCase) * (whatIf.value / 10)
})
const whatIfApproved = computed(() => isApproved(whatIfAverage.value, store.settings))

const scenarios = computed(() => [
  { key: 'worst', label: 'Pior cenário', note: 'zero no que falta', value: sim.value.worstCase },
  { key: 'best', label: 'Melhor cenário', note: 'dez no que falta', value: sim.value.bestCase }
].map(s => ({ ...s, approved: isApproved(s.value, store.settings) })))

const needs = computed(() => {
  const results = moduleResults(subject.value, store.settings)
  return sim.value.modules.map(m => ({ ...m, fig: moduleNeedFigure(m, results[m.index]!) }))
})

const requiredText = computed(() => {
  const r = sim.value.requiredAverage
  if (r === null) return '—'
  if (r <= EPS) return 'já garantida'
  if (r > 10 + EPS) return 'impossível'
  return formatGrade(r)
})
</script>

<template>
  <!-- Resumo vivo -->
  <div v-if="part === 'summary'" class="space-y-5">
    <SimLead :sim="sim" :min="min" />

    <dl class="space-y-2">
      <div class="kv">
        <dt class="text-muted">{{ sim.complete ? 'Média final' : 'Acumulada' }}<span v-if="!sim.complete" class="text-xs"> (pendências = 0)</span></dt><span class="leader" />
        <dd class="num font-medium text-highlighted">{{ formatAverage(sim.complete ? sim.finalAverage : sim.accumulated, sim.effectiveThreshold) }}</dd>
      </div>
      <div v-if="!sim.complete" class="kv">
        <dt class="text-muted">Projetada <span class="text-xs">(ritmo atual)</span></dt><span class="leader" />
        <dd class="num is-projected font-medium text-highlighted">{{ formatAverage(sim.projectedAverage, sim.effectiveThreshold) }}</dd>
      </div>
      <div class="kv">
        <dt class="text-muted">Falta <span class="text-xs">(alvo {{ formatGrade(sim.effectiveThreshold) }})</span></dt><span class="leader" />
        <dd class="num font-medium text-highlighted">{{ sim.missing <= EPS ? '0,00' : formatGrade(sim.missing) }}</dd>
      </div>
      <div v-if="!sim.complete" class="kv">
        <dt class="text-muted">Necessária nas pendências</dt><span class="leader" />
        <dd class="num font-medium" :class="sim.status === 'impossible' ? 'text-error' : sim.status === 'guaranteed' ? 'text-success' : 'text-primary'">{{ requiredText }}</dd>
      </div>
      <div v-if="sim.lastModule && !sim.complete" class="kv">
        <dt class="text-muted">No último módulo ({{ sim.lastModule.label }})</dt><span class="leader" />
        <dd class="num font-medium" :class="!sim.lastModule.feasible ? 'text-error' : sim.lastModule.alreadyGuaranteed ? 'text-success' : 'text-highlighted'">
          {{ sim.lastModule.alreadyGuaranteed ? 'qualquer' : !sim.lastModule.feasible ? 'inalcançável' : formatGrade(sim.lastModule.neededModuleGrade) }}
        </dd>
      </div>
      <div v-if="sim.lastModule && !sim.complete && sim.lastModule.feasible && !sim.lastModule.alreadyGuaranteed && sim.lastModule.neededInPending !== null && subject.modules[sim.lastModule.index]?.method === 'activities'" class="kv">
        <dt class="text-muted">…nas atividades pendentes</dt><span class="leader" />
        <dd class="num font-medium text-highlighted">{{ formatGrade(sim.lastModule.neededInPending) }}</dd>
      </div>
    </dl>
    <p v-if="sim.lastModule?.assumesOthers && !sim.complete" class="text-xs text-muted">O último módulo considera os demais com as médias atuais, que ainda podem mudar.</p>

    <section v-if="sim.modules.length && sim.status !== 'guaranteed'" aria-label="Nota necessária em cada módulo">
      <h3 class="label mb-1.5">Precisa em cada módulo</h3>
      <ul class="divide-y divide-default rounded-md border border-default">
        <li v-for="m in needs" :key="m.index" class="flex items-center justify-between gap-3 px-3 py-2">
          <span class="text-sm font-medium text-highlighted">{{ m.label }}</span>
          <span class="text-right">
            <span class="num text-base font-medium" :class="m.fig.impossible ? 'text-error' : 'text-primary'">{{ m.fig.impossible ? 'impossível' : m.fig.any ? 'qualquer' : formatGrade(m.fig.value) }}</span>
            <span v-if="!m.fig.impossible && !m.fig.any && sim.modules.length > 1" class="block text-xs text-muted">mín. <span class="num">{{ formatGrade(m.fig.min) }}</span> com 10 nos outros</span>
            <span v-if="m.fig.scope === 'pending'" class="block text-xs text-muted">nas atividades pendentes</span>
          </span>
        </li>
      </ul>
    </section>

    <div v-if="!sim.complete" class="space-y-2.5 border-t border-default pt-4">
      <label for="whatif" class="flex items-baseline justify-between text-sm">
        <span>E se eu tirar <span class="num font-medium text-highlighted">{{ formatGrade(whatIf) }}</span> no que falta?</span>
        <span class="label">simulado</span>
      </label>
      <USlider id="whatif" v-model="whatIf" :min="0" :max="10" :step="0.25" size="sm" aria-label="Nota hipotética nas avaliações pendentes" />
      <p class="flex items-baseline justify-between text-sm">
        <span class="text-muted">Média final simulada</span>
        <span class="flex items-baseline gap-2.5">
          <strong class="num is-projected text-base font-medium text-highlighted">{{ formatAverage(whatIfAverage, sim.effectiveThreshold) }}</strong>
          <span class="text-xs font-medium" :class="whatIfApproved ? 'text-success' : 'text-error'">{{ whatIfApproved ? 'aprova' : 'não aprova' }}</span>
        </span>
      </p>
    </div>

    <UButton :to="`/simulador?disciplina=${subjectId}`" block color="neutral" variant="outline" size="sm" icon="i-lucide-calculator" label="Abrir simulador completo" />
  </div>

  <!-- Detalhamento -->
  <div v-else class="space-y-4">
    <div class="grid gap-4 lg:grid-cols-2">
      <section v-if="!sim.complete" class="panel" aria-label="Cenários">
        <div class="panel-header"><h3 class="panel-title">Cenários</h3></div>
        <div class="space-y-4 p-4">
          <GradeRuler
            :value="sim.projectedAverage" kind="simulated" scale :threshold="sim.effectiveThreshold"
            :range-min="sim.worstCase" :range-max="sim.bestCase" label="Faixa possível da média final"
          />
          <ul class="divide-y divide-default text-sm">
            <li v-for="s in scenarios" :key="s.key" class="flex items-center justify-between gap-3 py-2">
              <span>{{ s.label }} <span class="text-xs text-muted">({{ s.note }})</span></span>
              <span class="flex items-baseline gap-3">
                <span class="num font-medium text-highlighted">{{ formatAverage(s.value, sim.effectiveThreshold) }}</span>
                <span class="w-20 whitespace-nowrap text-right text-xs font-medium" :class="s.approved ? 'text-success' : 'text-error'">{{ s.approved ? 'aprova' : 'não aprova' }}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="sim.modules.length" class="panel overflow-hidden" aria-label="Necessário por módulo">
        <div class="panel-header"><h3 class="panel-title">Necessário por módulo</h3></div>
        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr><th scope="col">Módulo</th><th scope="col" class="r">Atual</th><th scope="col" class="r">Precisa</th><th scope="col" class="r">Mínimo*</th><th scope="col" class="r">Termina com</th></tr>
            </thead>
            <tbody>
              <tr v-for="m in needs" :key="m.index">
                <td class="font-medium text-highlighted">{{ m.label }}</td>
                <td class="num r text-muted">{{ formatGrade(m.currentGrade) }}</td>
                <td class="num r font-medium" :class="m.fig.impossible ? 'text-error' : 'text-primary'">{{ m.fig.any ? 'qualquer' : m.fig.impossible ? 'impossível' : formatGrade(m.fig.value) }}</td>
                <td class="num r text-muted">{{ m.fig.impossible ? '—' : formatGrade(m.fig.min) }}</td>
                <td class="num r">{{ formatGrade(m.resultingGrade) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="border-t border-default px-4 py-2.5 text-xs text-muted">*Menor nota possível no módulo se todos os outros pendentes tirarem 10. “Precisa” supõe os pendentes iguais.</p>
      </section>
    </div>

    <div v-if="showMemory" class="rounded-lg bg-muted p-4 text-sm" aria-label="Memória de cálculo da média final">
      <p class="label mb-2">Memória de cálculo</p>
      <p class="num">MF = soma dos {{ sim.moduleCount }} módulos ÷ {{ sim.moduleCount }}</p>
      <p class="num text-muted">alvo bruto = {{ formatGrade(sim.effectiveThreshold) }}<template v-if="sim.effectiveThreshold < min"> (mínimo {{ formatGrade(min) }}, arredondando a partir de {{ formatGrade(store.settings.roundingThreshold) }})</template></p>
      <p class="num text-muted">acumulada {{ formatGrade(sim.accumulated) }} · pior {{ formatGrade(sim.worstCase) }} · melhor {{ formatGrade(sim.bestCase) }}</p>
    </div>
  </div>
</template>
