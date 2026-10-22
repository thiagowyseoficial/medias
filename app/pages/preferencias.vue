<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { MAX_MODULES } from '~/utils/schema'

useSeoMeta({ title: 'Preferências · Calculadora de Médias' })

const store = useAcademicStore()
const toast = useToast()

const schema = z.object({
  minPassingGrade: z.number({ error: 'Informe a média mínima' }).min(0, 'Mínimo 0').max(10, 'Máximo 10'),
  roundingThreshold: z.number({ error: 'Informe o limite' }).min(0, 'Mínimo 0').max(10, 'Máximo 10'),
  moduleCount: z.number({ error: 'Informe a quantidade' }).int('Use um número inteiro').min(1, 'Ao menos 1 módulo').max(MAX_MODULES, `No máximo ${MAX_MODULES} módulos`)
}).refine(v => v.roundingThreshold <= v.minPassingGrade, {
  path: ['roundingThreshold'],
  message: 'O limite de arredondamento não pode ser maior que a média mínima'
})
type Schema = z.output<typeof schema>

const state = reactive<{ minPassingGrade: number | null, roundingThreshold: number | null, moduleCount: number | null }>({
  minPassingGrade: store.settings.minPassingGrade,
  roundingThreshold: store.settings.roundingThreshold,
  moduleCount: store.settings.moduleCount
})
function syncState() {
  Object.assign(state, store.settings)
}
watch(() => store.hydrated, syncState)

const numberFormat = { minimumFractionDigits: 0, maximumFractionDigits: 2 }
const dirty = computed(() =>
  state.minPassingGrade !== store.settings.minPassingGrade
  || state.roundingThreshold !== store.settings.roundingThreshold
  || state.moduleCount !== store.settings.moduleCount)

const hiddenModules = computed(() => store.subjects.filter(s => s.modules.some((m, i) =>
  i >= (state.moduleCount ?? 0) && (m.directGrade !== null || m.activities.length))).length)

function onSubmit(event: FormSubmitEvent<Schema>) {
  store.updateSettings(event.data)
  toast.add({ title: 'Preferências salvas', color: 'success' })
}

function restoreDefaults() {
  Object.assign(state, DEFAULT_SETTINGS)
}

/* ---------- Aplicativo (PWA) ---------- */
const { $pwa } = useNuxtApp()
const online = useOnline()
const mounted = useMounted()
const installed = computed(() => !!$pwa?.isPWAInstalled)
async function install() { await $pwa?.install() }

/* ---------- Exportar / importar / excluir ---------- */
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const importError = ref<string | null>(null)
const pendingImport = ref<unknown>(null)
const importOpen = ref(false)
const deleteOpen = ref(false)

function exportJson() {
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(store.snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `calculadora-medias-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: 'Backup exportado', description: a.download, color: 'success' })
}

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importError.value = null
  const text = await file.text()
  const parsed = parsePersisted(text)
  if (!parsed.ok) {
    importError.value = parsed.error
    return
  }
  pendingImport.value = parsed.data
  importOpen.value = true
}

function confirmImport() {
  const result = store.importData(pendingImport.value)
  pendingImport.value = null
  if (result.ok) {
    syncState()
    toast.add({ title: 'Dados importados', color: 'success' })
  } else {
    importError.value = result.error ?? 'Falha ao importar.'
  }
}

function deleteAll() {
  store.resetAll()
  syncState()
  toast.add({ title: 'Todos os dados foram excluídos', color: 'neutral', icon: 'i-lucide-trash-2' })
}
</script>

<template>
  <div class="max-w-3xl">
    <PageHeader title="Preferências" description="Regras de aprovação, instalação e dados." />

    <div class="space-y-4">
      <!-- Regras -->
      <section class="panel" aria-label="Regras de aprovação">
        <div class="panel-header"><h2 class="panel-title">Regras de aprovação</h2></div>
        <UForm :schema="schema" :state="state" @submit="onSubmit">
          <div class="divide-y divide-default">
            <div class="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_11rem] sm:items-start">
              <div><p class="text-sm font-medium text-highlighted">Média mínima</p><p class="text-xs text-muted">Média final necessária para aprovação (0 a 10).</p></div>
              <UFormField name="minPassingGrade">
                <UInputNumber v-model="state.minPassingGrade" :min="0" :max="10" :step="0.25" :step-snapping="false" locale="pt-BR" :format-options="numberFormat" class="w-full" aria-label="Média mínima" />
              </UFormField>
            </div>
            <div class="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_11rem] sm:items-start">
              <div><p class="text-sm font-medium text-highlighted">Arredondar a partir de</p><p class="text-xs text-muted">A média final igual ou acima deste valor sobe para a mínima. Use o mesmo valor da mínima para desativar. Não afeta os módulos.</p></div>
              <UFormField name="roundingThreshold">
                <UInputNumber v-model="state.roundingThreshold" :min="0" :max="10" :step="0.05" :step-snapping="false" locale="pt-BR" :format-options="numberFormat" class="w-full" aria-label="Arredondar a partir de" />
              </UFormField>
            </div>
            <div class="grid gap-x-6 gap-y-2 px-4 py-3.5 sm:grid-cols-[1fr_11rem] sm:items-start">
              <div><p class="text-sm font-medium text-highlighted">Módulos por disciplina</p><p class="text-xs text-muted">De 1 a {{ MAX_MODULES }} (padrão 3).</p></div>
              <UFormField name="moduleCount">
                <UInputNumber v-model="state.moduleCount" :min="1" :max="MAX_MODULES" :step="1" class="w-full" aria-label="Módulos por disciplina" />
              </UFormField>
            </div>
          </div>

          <div class="space-y-2 border-t border-default px-4 py-3">
            <p class="text-xs text-muted">
              <span class="font-medium text-toned">Fórmula:</span>
              <span class="num"> MF = (M1 + … + M{{ state.moduleCount ?? 3 }}) ÷ {{ state.moduleCount ?? 3 }}</span>.
              Média final de <span class="num">{{ formatGrade(state.roundingThreshold) }}</span> ou mais, e abaixo de <span class="num">{{ formatGrade(state.minPassingGrade) }}</span>, é arredondada para <span class="num">{{ formatGrade(state.minPassingGrade) }}</span>.
            </p>
            <UAlert
              v-if="hiddenModules" color="warning" variant="subtle" icon="i-lucide-triangle-alert"
              title="Notas preservadas, mas fora do cálculo"
              :description="`${hiddenModules} disciplina(s) possuem notas em módulos acima do novo limite. Elas não são apagadas, mas deixam de contar na média.`"
            />
          </div>

          <div class="flex justify-end gap-2 border-t border-default bg-muted px-4 py-2.5">
            <UButton color="neutral" variant="outline" size="sm" label="Restaurar padrões" icon="i-lucide-rotate-ccw" @click="restoreDefaults" />
            <UButton type="submit" size="sm" label="Salvar" :disabled="!dirty" />
          </div>
        </UForm>
      </section>

      <!-- Aplicativo -->
      <section class="panel" aria-label="Aplicativo">
        <div class="panel-header"><h2 class="panel-title">Aplicativo</h2><span class="text-xs text-muted">{{ !mounted ? '…' : online ? 'Online' : 'Offline' }}</span></div>
        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted">{{ installed ? 'Instalado neste aparelho' : 'Instalar como aplicativo' }}</p>
            <p class="text-xs text-muted">{{ installed ? 'Abre em tela cheia e funciona offline.' : 'Abre em tela cheia pela tela inicial e funciona sem internet. No iPhone: Compartilhar › Adicionar à Tela de Início.' }}</p>
          </div>
          <UButton v-if="!installed && $pwa?.showInstallPrompt" size="sm" label="Instalar" icon="i-lucide-download" @click="install" />
        </div>
      </section>

      <!-- Dados -->
      <section class="panel" aria-label="Dados">
        <div class="panel-header"><h2 class="panel-title">Dados</h2><span class="text-xs text-muted">salvos neste navegador</span></div>
        <div class="divide-y divide-default">
          <div class="space-y-3 px-4 py-3.5">
            <UAlert
              v-if="importError" color="error" variant="subtle" icon="i-lucide-circle-alert" title="Não foi possível importar"
              :description="importError" close @update:open="(o: boolean) => { if (!o) importError = null }"
            />
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><p class="text-sm font-medium text-highlighted">Backup em JSON</p><p class="text-xs text-muted">Exporte para guardar ou levar a outro dispositivo; importar substitui os dados atuais.</p></div>
              <div class="flex gap-2">
                <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-download" label="Exportar" :disabled="!store.subjects.length" @click="exportJson" />
                <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-upload" label="Importar" @click="fileInput?.click()" />
                <input ref="fileInput" type="file" accept="application/json,.json" class="sr-only" tabindex="-1" aria-hidden="true" @change="onFile">
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div><p class="text-sm font-medium text-highlighted">Excluir todos os dados</p><p class="text-xs text-muted">Remove disciplinas, notas e preferências deste navegador.</p></div>
            <UButton color="error" variant="soft" size="sm" icon="i-lucide-trash-2" label="Excluir tudo" @click="deleteOpen = true" />
          </div>
        </div>
      </section>
    </div>

    <ConfirmModal
      v-model:open="importOpen" title="Substituir dados atuais?"
      description="A importação substitui todas as disciplinas e preferências atuais pelas do arquivo. Exporte um backup antes se quiser guardá-las."
      confirm-label="Importar e substituir" color="warning" @confirm="confirmImport"
    />
    <ConfirmModal
      v-model:open="deleteOpen" title="Excluir todos os dados?"
      description="Todas as disciplinas, notas e preferências serão apagadas permanentemente. Esta ação não pode ser desfeita."
      confirm-label="Excluir tudo" @confirm="deleteAll"
    />
  </div>
</template>
