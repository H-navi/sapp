<script setup lang="ts">
useHead({
  title: 'Dasbor Admin',
})

const submenus = [
  {
    title: 'Kelola Pegawai',
    description: 'Daftar pegawai, tambah pegawai baru, hak akses, dan kuota cuti.',
    to: '/admin/pegawai',
    badge: 'Inti',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    title: 'Struktur Organisasi',
    description: 'Kelola unit kerja/departemen dan jenjang jabatan.',
    to: '/admin/organisasi',
    badge: 'Struktur',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  },
  {
    title: 'Jenis Izin & Hak Pengajuan',
    description: 'Konfigurasi 6 jenis izin dan aturan siapa yang berhak mengajukan.',
    to: '/admin/jenis-izin',
    badge: 'Perizinan',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'Mesin Aturan & Kebijakan',
    description: 'Konfigurasi 20 jenis aturan dinamis per jenis perizinan, versi kebijakan, dan simulator uji aturan.',
    to: '/admin/aturan',
    badge: 'Kebijakan',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    title: 'Alur Approval Bertingkat',
    description: 'Workflow builder persetujuan multi-level, mode kuorum/semua, eskalasi SLA, dan simulator approver.',
    to: '/admin/alur',
    badge: 'Alur Kerja',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    title: 'Pengaturan Sistem',
    description: 'Kalender kerja, jam operasional, hari libur nasional, dan parameter global.',
    to: '/admin/pengaturan',
    badge: 'Sistem',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
]
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Dasbor Pengaturan Admin"
      subtitle="Pusat pengelolaan master data pegawai, organisasi, jenis izin, dan sistem"
    />

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="menu in submenus"
        :key="menu.to"
        :to="menu.to"
        class="card block hover:border-brand-500 hover:shadow-md transition-all active:scale-[0.99] p-5"
      >
        <div class="flex items-start justify-between">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" :d="menu.icon" />
            </svg>
          </div>
          <span class="badge bg-slate-100 text-slate-600 font-medium">{{ menu.badge }}</span>
        </div>
        <h2 class="mt-4 text-base font-bold text-slate-900">{{ menu.title }}</h2>
        <p class="mt-1 text-xs text-slate-500 leading-relaxed">{{ menu.description }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
