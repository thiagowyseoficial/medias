<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Activity } from '~/types'

const props = defineProps<{ subjectId: string, moduleIndex: number, activity?: Activity | null }>()
const open = defineModel<boolean>('open', { default: false })

const store = useAcademicStore()
const toast = useToast()

const schema = z.object({
  name: z.string({ error: 'Informe o nome' }).trim().min(1, 'Informe o nome da atividade').max(80, 'Máximo de 80 caracteres'),
  grade: z.number({ error: 'Nota inválida' }).min(0, 'A nota mínima é 0').max(10, 'A nota máxima é 10').nullable(),
  weight: z.number({ error: 'Informe o peso' }).positive('O peso deve ser maior que zero')
})
type Schema = z.output<typeof schema>

const state = reactive<{ name: string, grade: number | null, weight: number | null }>({ name: '', grade: null, weight: 1 })
const nameInput = useTemplateRef<{ inputRef?: HTMLInputElement }>('nameInput')

function reset() {
  state.name = props.activity?.name ?? ''
  state.grade = props.activity ? props.activity.grade : null
  state.weight = props.activity?.weight ?? 1
}
watch(open, (isOpen) => { if (isOpen) reset() })

const editing = computed(() => !!props.activity)
let addAnother = false

function onSubmit(event: FormSubmitEvent<Schema>) {
  if (props.activity) {
    store.updateActivity(props.subjectId, props.moduleIndex, props.activity.id, event.data)
    toast.add({ title: 'Atividade atualizada', color: 'success' })
  } else {
    store.addActivity(props.subjectId, props.moduleIndex, event.data)
    toast.add({ title: 'Atividade adicionada', description: event.data.name, color: 'success' })
  }
  if (addAnother && !props.activity) {
    reset()
    nextTick(() => nameInput.value?.inputRef?.focus())
  } else {
    open.value = false
  }
  addAnother = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'Editar atividade' : 'Nova atividade'"
    description="Deixe a nota em branco se a atividade ainda não foi avaliada: ela não entra na média (não conta como zero)."
  >
    <template #body>
      <UForm id="activity-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nome" name="name" required>
          <UInput ref="nameInput" v-model="state.name" placeholder="Ex.: Prova 1" class="w-full" autofocus />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nota (0 a 10)" name="grade" hint="Em branco = pendente">
            <UInputNumber
              v-model="state.grade" :min="0" :max="10" :step="0.1" :step-snapping="false" locale="pt-BR"
              :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }" placeholder="Pendente" class="w-full"
            />
          </UFormField>
          <UFormField label="Peso" name="weight" required>
            <UInputNumber
              v-model="state.weight" :min="0.01" :step="0.5" :step-snapping="false" locale="pt-BR"
              :format-options="{ minimumFractionDigits: 0, maximumFractionDigits: 2 }" class="w-full"
            />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancelar" @click="close" />
        <UButton
          v-if="!editing" type="submit" form="activity-form" color="neutral" variant="soft"
          label="Salvar e adicionar outra" @click="addAnother = true"
        />
        <UButton type="submit" form="activity-form" :label="editing ? 'Salvar' : 'Adicionar'" />
      </div>
    </template>
  </UModal>
</template>
