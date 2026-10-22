<script setup lang="ts">
import type { ChatMessage } from '~/stores/chat'

defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{ send: [text: string] }>()

const tone = { success: 'text-success', error: 'text-error', primary: 'text-primary' } as const
</script>

<template>
  <!-- Usuário -->
  <div v-if="message.role === 'user'" class="flex justify-end">
    <p class="max-w-[85%] rounded-lg border border-default bg-muted px-3 py-2 text-sm text-highlighted">{{ message.text }}</p>
  </div>

  <!-- Assistente -->
  <div v-else class="flex w-full max-w-[92%] flex-col gap-2.5">
    <template v-for="(b, i) in message.blocks" :key="i">
      <p v-if="b.type === 'text'" class="text-sm text-default">{{ b.text }}</p>

      <StatusBadge v-else-if="b.type === 'status'" :status="b.status" :short="false" />

      <dl v-else-if="b.type === 'kv'" class="space-y-0.5 rounded-md border border-default p-1.5">
        <component
          :is="r.send ? 'button' : 'div'" v-for="r in b.rows" :key="r.label"
          class="kv w-full rounded px-1.5 py-1 text-left"
          :class="r.send ? 'cursor-pointer transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary' : ''"
          :type="r.send ? 'button' : undefined" :aria-label="r.send ? `Simular ${r.label}` : undefined"
          @click="r.send && emit('send', r.send)"
        >
          <dt class="text-muted" :class="r.send ? 'text-default' : ''">{{ r.label }}</dt><span class="leader" />
          <dd class="num font-medium" :class="r.tone ? tone[r.tone] : 'text-highlighted'">{{ r.value }}</dd>
          <UIcon v-if="r.send" name="i-lucide-chevron-right" class="size-3.5 shrink-0 self-center text-muted" />
        </component>
      </dl>

      <ChatSimulator v-else-if="b.type === 'sim'" :subject-id="b.subjectId" />

      <NuxtLink v-else-if="b.type === 'link'" :to="b.to" class="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
        {{ b.label }}<UIcon name="i-lucide-arrow-right" class="size-3.5" />
      </NuxtLink>

      <div v-else-if="b.type === 'choices'" class="flex flex-wrap gap-1.5" role="group" aria-label="Sugestões">
        <UButton v-for="c in b.items" :key="c.label" :label="c.label" color="neutral" variant="outline" size="xs" @click="emit('send', c.send)" />
      </div>
    </template>
  </div>
</template>
