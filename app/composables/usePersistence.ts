import { STORAGE_KEY } from '~/utils/schema'

/**
 * Persistência em localStorage compatível com SSR: o estado inicia vazio no
 * servidor e no primeiro render do cliente; o armazenamento só é lido após a
 * montagem (`initOnMounted`), evitando divergência de hidratação.
 */
export function usePersistence() {
  const store = useAcademicStore()
  const toast = useToast()
  const stored = useLocalStorage<unknown>(STORAGE_KEY, null, {
    initOnMounted: true,
    writeDefaults: false,
    listenToStorageChanges: false,
    serializer: { read: v => JSON.parse(v), write: v => JSON.stringify(v) }
  })

  onMounted(() => {
    const result = store.hydrate(stored.value)
    if (!result.ok) {
      // Guarda uma cópia dos dados ilegíveis antes de voltar a gravar.
      try { localStorage.setItem(`${STORAGE_KEY}:corrompido`, JSON.stringify(stored.value)) } catch { /* sem espaço/permissão */ }
      toast.add({
        title: 'Não foi possível recuperar os dados salvos',
        description: result.error, color: 'error', icon: 'i-lucide-triangle-alert'
      })
    }
    // Só passa a gravar depois da leitura, para nunca sobrescrever dados válidos com o estado vazio.
    watch(() => store.snapshot, (value) => { stored.value = value }, { deep: true, immediate: true })
  })

  return { stored }
}
