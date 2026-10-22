<script setup lang="ts">
const online = useOnline()
// Só após montar: o servidor não sabe o estado da rede e divergiria na hidratação.
const mounted = useMounted()
</script>

<template>
  <div v-if="mounted && !online" role="status" class="border-b border-default bg-muted px-4 py-1.5 text-center text-xs text-toned">
    Sem conexão. O app continua funcionando e seus dados ficam salvos neste aparelho.
  </div>
</template>
