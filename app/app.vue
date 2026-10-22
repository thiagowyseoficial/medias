<script setup lang="ts">
usePersistence()
useSeoMeta({ title: 'Calculadora de Médias' })
</script>

<template>
  <UApp :toaster="{ position: 'bottom-right' }">
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
