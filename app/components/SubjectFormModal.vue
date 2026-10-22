<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Subject } from '~/types'

const props = defineProps<{ subject?: Subject | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [subject: Subject] }>()

const store = useAcademicStore()
const toast = useToast()

const schema = z.object({
  name: z.string({ error: 'Informe o nome da disciplina' }).trim().min(2, 'O nome precisa ter ao menos 2 caracteres').max(80, 'Máximo de 80 caracteres'),
  code: z.string().trim().max(20, 'Máximo de 20 caracteres').optional(),
  professor: z.string().trim().max(80, 'Máximo de 80 caracteres').optional()
})
type Schema = z.output<typeof schema>

const state = reactive<Schema>({ name: '', code: '', professor: '' })

watch(open, (isOpen) => {
  if (!isOpen) return
  state.name = props.subject?.name ?? ''
  state.code = props.subject?.code ?? ''
  state.professor = props.subject?.professor ?? ''
})

const editing = computed(() => !!props.subject)

function onSubmit(event: FormSubmitEvent<Schema>) {
  let saved: Subject
  if (props.subject) {
    store.updateSubject(props.subject.id, event.data)
    saved = props.subject
  } else {
    saved = store.addSubject(event.data)
  }
  toast.add({
    title: editing.value ? 'Disciplina atualizada' : 'Disciplina cadastrada',
    description: event.data.name, color: 'success'
  })
  open.value = false
  emit('saved', saved)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'Editar disciplina' : 'Nova disciplina'"
    description="Informe os dados básicos. Os módulos e notas são lançados na página da disciplina."
  >
    <template #body>
      <UForm id="subject-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nome da disciplina" name="name" required>
          <UInput v-model="state.name" placeholder="Ex.: Cálculo I" class="w-full" autofocus />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Código" name="code" hint="Opcional">
            <UInput v-model="state.code" placeholder="Ex.: MAT101" class="w-full" />
          </UFormField>
          <UFormField label="Professor(a)" name="professor" hint="Opcional">
            <UInput v-model="state.professor" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancelar" @click="close" />
        <UButton type="submit" form="subject-form" :label="editing ? 'Salvar alterações' : 'Cadastrar disciplina'" />
      </div>
    </template>
  </UModal>
</template>
