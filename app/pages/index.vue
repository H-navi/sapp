<script setup lang="ts">
useHead({ title: 'Beranda' })
const { data } = await useFetch('/api/health')
</script>

<template>
  <section class="space-y-3">
    <h1 class="text-xl font-semibold">Sistem Perizinan Pegawai</h1>
    <div class="card">
      <p class="text-sm text-slate-600">Status database</p>
      <p class="mt-1 font-medium" :class="data?.data?.database === 'ok' ? 'text-status-approved' : 'text-status-rejected'">
        {{ data?.data?.database ?? 'tidak diketahui' }}
      </p>
    </div>
  </section>
</template>
