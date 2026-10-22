<script setup lang="ts">
import { interpret } from '~/composables/useChatEngine'

useSeoMeta({ title: 'Assistente · Calculadora de Médias' })

const academic = useAcademicStore()
const chat = useChatStore()

const draft = ref('')
const scroller = useTemplateRef<HTMLElement>('scroller')

/** Mensagem inicial (ajuda), exibida enquanto a conversa está vazia. */
const welcome = computed(() => interpret('ajuda', { subjects: academic.subjects, settings: academic.settings }).blocks)

function submit(text = draft.value) {
  if (!text.trim()) return
  chat.send(text)
  draft.value = ''
}

watch(() => chat.messages.length, async () => {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
})
</script>

<template>
  <div>
    <PageHeader title="Assistente" description="Pergunte sobre suas notas e simule cenários. Ele só consulta: não altera seus dados.">
      <UButton v-if="chat.messages.length" color="neutral" variant="outline" icon="i-lucide-rotate-ccw" label="Nova conversa" @click="chat.reset()" />
    </PageHeader>

    <div v-if="!academic.hydrated" class="space-y-3" aria-busy="true"><USkeleton class="h-16 w-2/3 rounded-lg" /><USkeleton class="h-12 w-full rounded-lg" /></div>

    <section v-else class="panel flex flex-col" aria-label="Conversa com o assistente">
      <div ref="scroller" class="max-h-[60dvh] min-h-72 space-y-4 overflow-y-auto p-4" role="log" aria-live="polite" aria-relevant="additions">
        <ChatMessage v-if="!chat.messages.length" :message="{ id: 'welcome', role: 'assistant', blocks: welcome }" @send="submit" />
        <ChatMessage v-for="m in chat.messages" :key="m.id" :message="m" @send="submit" />
      </div>

      <form class="flex items-center gap-2 border-t border-default p-3" @submit.prevent="submit()">
        <UInput
          v-model="draft" class="flex-1" size="lg" autofocus autocomplete="off" enterkeyhint="send"
          placeholder="Ex.: quanto preciso em Cálculo?" aria-label="Mensagem para o assistente"
        />
        <UButton type="submit" size="lg" icon="i-lucide-send-horizontal" aria-label="Enviar" :disabled="!draft.trim()" />
      </form>
    </section>
  </div>
</template>
