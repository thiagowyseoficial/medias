<script setup lang="ts">
import { EPS } from '~/utils/number'

/** Simulação por módulo dentro da conversa: notas hipotéticas, nunca salvas. */
const props = defineProps<{ subjectId: string }>()

const store = useAcademicStore()
const id = toRef(props, 'subjectId')
const { subject, hypo, clear, plan, allKeys, base, sim, moduleAfter, needFor, filled, shown, kind, setHypo, fillNeeded } = useHypothetical(id)

const numberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 2 }
const done = computed(() => plan.value.filter(p => p.status === 'official'))
const open = computed(() => plan.value.filter(p => p.items.length))
const canFill = computed(() => !!sim.value && sim.value.requiredAverage !== null && sim.value.requiredAverage > EPS && sim.value.requiredAverage <= 10 + EPS && filled.value < allKeys.value.length)
</script>

<template>
  <section v-if="subject && sim && base" class="w-full max-w-xl rounded-lg border border-default bg-default" :aria-label="`Simulação de ${subject.name}`">
    <div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-default px-3 py-2">
      <p class="min-w-0 flex-1 basis-40 truncate text-sm font-medium text-highlighted">{{ subject.name }}</p>
      <div class="flex items-center gap-1">
        <UButton v-if="canFill" size="xs" color="neutral" variant="outline" icon="i-lucide-wand-sparkles" label="Usar a nota necessária" @click="fillNeeded" />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-rotate-ccw" label="Limpar" :disabled="!filled" @click="clear" />
      </div>
    </div>

    <p v-if="done.length" class="border-b border-default px-3 py-1.5 text-xs text-muted">
      Concluídos:
      <span v-for="(d, i) in done" :key="d.index"><template v-if="i">, </template>{{ d.label }} <span class="num font-medium text-default">{{ formatGrade(d.real) }}</span></span>
    </p>

    <div v-for="p in open" :key="p.index" class="border-b border-default px-3 py-2.5">
      <div class="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span class="font-medium text-highlighted">{{ p.label }}<span v-if="p.status === 'partial'" class="ml-1.5 text-xs font-normal text-warning">parcial {{ formatGrade(p.real) }}</span></span>
        <span v-if="needFor(p.index) && sim.status !== 'guaranteed'" class="text-xs text-muted">
          precisa <span class="num font-medium" :class="needFor(p.index)!.impossible ? 'text-error' : 'text-primary'">{{ needFor(p.index)!.impossible ? 'impossível' : needFor(p.index)!.any ? 'qualquer' : formatGrade(needFor(p.index)!.value) }}</span>
        </span>
        <span v-else class="text-xs text-muted">termina com <span class="num font-medium text-default">{{ formatGrade(moduleAfter(p.index)?.grade) }}</span></span>
      </div>
      <ul class="space-y-2">
        <li v-for="it in p.items" :key="it.key" class="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,8rem)_7.5rem_minmax(6rem,1fr)]">
          <span class="truncate text-xs text-muted">{{ it.label }}<template v-if="it.weight"> · peso <span class="num">{{ formatNumber(it.weight) }}</span></template></span>
          <UInputNumber
            :model-value="hypo[it.key] ?? null" :min="0" :max="10" :step="0.1" :step-snapping="false" locale="pt-BR"
            :format-options="numberFormat" placeholder="Em branco" size="xs" :aria-label="`Nota hipotética: ${p.label}, ${it.label}`"
            @update:model-value="(v) => setHypo(it.key, v)"
          />
          <USlider
            :model-value="hypo[it.key] ?? 0" :min="0" :max="10" :step="0.25" size="sm" :aria-label="`Ajustar nota: ${p.label}, ${it.label}`"
            @update:model-value="(v) => setHypo(it.key, v as number)"
          />
        </li>
      </ul>
    </div>

    <div class="space-y-2 bg-muted px-3 py-2.5" aria-live="polite">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="label">{{ filled ? 'Média final simulada' : 'Média atual' }}</p>
          <p class="num text-xl font-medium leading-tight" :class="[kind === 'empty' ? 'text-dimmed' : 'text-highlighted', kind === 'simulated' ? 'is-projected' : '']">{{ formatAverage(shown, sim.effectiveThreshold) }}</p>
        </div>
        <StatusBadge :status="sim.status" :short="false" />
      </div>
      <GradeRuler
        :value="shown" :threshold="sim.effectiveThreshold" :kind="kind"
        :range-min="sim.complete ? undefined : sim.worstCase" :range-max="sim.complete ? undefined : sim.bestCase" label="Média final simulada"
      />
      <SimLead :sim="sim" :min="store.settings.minPassingGrade" simulated class="!text-sm !font-normal" />
      <p v-if="!sim.complete && sim.requiredAverage !== null && filled" class="text-xs text-muted">
        Ainda faltam {{ allKeys.length - filled }} avaliação(ões): preciso de média
        <span class="num font-medium" :class="sim.requiredAverage > 10 + EPS ? 'text-error' : 'text-primary'">{{ sim.requiredAverage > 10 + EPS ? 'impossível' : sim.requiredAverage <= EPS ? 'qualquer' : formatGrade(sim.requiredAverage) }}</span> nelas.
      </p>
    </div>
  </section>
</template>
