<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  confirmLabel?: string
  color?: 'error' | 'primary' | 'warning'
}>(), { confirmLabel: 'Confirmar', color: 'error', description: undefined })

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

function confirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancelar" @click="close" />
        <UButton :color="color" :label="confirmLabel" @click="confirm" />
      </div>
    </template>
  </UModal>
</template>
