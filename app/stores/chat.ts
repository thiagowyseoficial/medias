import { defineStore } from 'pinia'
import { interpret, type ChatBlock } from '~/composables/useChatEngine'
import { uid } from '~/utils/number'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text?: string
  blocks?: ChatBlock[]
}

/** Conversa com o assistente: fica na memória durante a sessão e nunca altera os dados acadêmicos. */
export const useChatStore = defineStore('chat', () => {
  const academic = useAcademicStore()
  const messages = ref<ChatMessage[]>([])
  const lastSubjectId = ref<string | null>(null)

  function send(input: string) {
    const text = input.trim()
    if (!text) return
    messages.value.push({ id: uid(), role: 'user', text })
    const reply = interpret(text, {
      subjects: academic.subjects,
      settings: academic.settings,
      lastSubjectId: lastSubjectId.value
    })
    if (reply.subjectId !== undefined) lastSubjectId.value = reply.subjectId
    messages.value.push({ id: uid(), role: 'assistant', blocks: reply.blocks })
  }

  function reset() {
    messages.value = []
    lastSubjectId.value = null
  }

  return { messages, lastSubjectId, send, reset }
})
