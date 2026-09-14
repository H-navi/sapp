<script setup lang="ts">
useHead({
  title: 'Jenis Izin & Hak Pengajuan',
})

const { data: typesData, refresh } = await useFetch<{ data: any[] }>('/api/admin/leave-types')
const leaveTypes = computed(() => typesData.value?.data ?? [])

// Modal Edit Jenis Izin
const editModalOpen = ref(false)
const editingType = ref<any>(null)
const form = reactive({
  name: '',
  description: '',
  defaultAnnualQuota: 0 as number | null,
  requiresAttachment: false,
  allowHalfDay: false,
  allowBackdate: false,
  maxBackdateDays: 0,
  countsWorkingDaysOnly: true,
  color: '#64748B',
  isActive: true,
})
const saveError = ref('')
const isSaving = ref(false)

function openEdit(lt: any) {
  editingType.value = lt
  form.name = lt.name
  form.description = lt.description || ''
  form.defaultAnnualQuota = lt.defaultAnnualQuota ? Number(lt.defaultAnnualQuota) : null
  form.requiresAttachment = Boolean(lt.requiresAttachment)
  form.allowHalfDay = Boolean(lt.allowHalfDay)
  form.allowBackdate = Boolean(lt.allowBackdate)
  form.maxBackdateDays = lt.maxBackdateDays || 0
  form.countsWorkingDaysOnly = Boolean(lt.countsWorkingDaysOnly)
  form.color = lt.color || '#64748B'
  form.isActive = Boolean(lt.isActive)
  saveError.value = ''
  editModalOpen.value = true
}

async function handleSave() {
  if (!editingType.value) return
  saveError.value = ''
  isSaving.value = true
  try {
    await $fetch(`/api/admin/leave-types/${editingType.value.id}`, {
      method: 'PATCH',
      body: form,
    })
    editModalOpen.value = false
    await refresh()
  } catch (err: any) {
    saveError.value = err?.data?.message || err?.statusMessage || 'Gagal memperbarui jenis izin.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <AppPageHeader
      title="Jenis Perizinan Pegawai"
      subtitle="Kelola ketentuan 6 jenis perizinan dan konfigurasi hak pengajuan"
    />

    <div class="space-y-3">
      <div
        v-for="lt in leaveTypes"
        :key="lt.id"
        class="card p-4 space-y-3 hover:border-slate-300 transition"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span
              class="inline-block h-3.5 w-3.5 rounded-full shrink-0"
              :style="{ backgroundColor: lt.color }"
            />
            <div>
              <h3 class="font-bold text-slate-900 text-sm">{{ lt.name }}</h3>
              <p class="text-xs font-mono text-slate-400">{{ lt.code }}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              class="badge text-xs"
              :class="lt.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'"
            >
              {{ lt.isActive ? 'Aktif' : 'Nonaktif' }}
            </span>
          </div>
        </div>

        <p class="text-xs text-slate-600 leading-relaxed">{{ lt.description || 'Tidak ada keterangan' }}</p>

        <!-- Ringkasan Konfigurasi -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div>
            <span class="text-slate-400 block text-[10px]">Satuan / Kuota</span>
            <strong>{{ lt.deductsQuota ? `${lt.defaultAnnualQuota || 0} hari / th` : 'Tanpa Kuota' }}</strong>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">Wajib Lampiran</span>
            <strong :class="lt.requiresAttachment ? 'text-brand-600' : 'text-slate-600'">{{ lt.requiresAttachment ? 'Wajib' : 'Opsional' }}</strong>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">Izin Setengah Hari</span>
            <strong>{{ lt.allowHalfDay ? 'Diizinkan' : 'Penuh' }}</strong>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px]">Backdate (Mundur)</span>
            <strong>{{ lt.allowBackdate ? `Maks ${lt.maxBackdateDays} hr` : 'Tidak' }}</strong>
          </div>
        </div>

        <!-- Tombol Aksi -->
        <div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <NuxtLink
            :to="`/admin/jenis-izin/${lt.id}`"
            class="btn-ghost text-xs px-3 py-1.5 font-medium text-brand-600 border-brand-200 hover:bg-brand-50"
          >
            Atur Hak Pengajuan →
          </NuxtLink>
          <button
            type="button"
            class="btn-ghost text-xs px-3 py-1.5"
            @click="openEdit(lt)"
          >
            Edit Ketentuan
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Edit Ketentuan -->
    <Teleport to="body">
      <div v-if="editModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" @click="editModalOpen = false" />
        <div class="card relative z-10 w-full max-w-md p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
          <h3 class="font-bold text-slate-900 text-base">
            Edit Ketentuan: {{ editingType?.name }}
          </h3>

          <div v-if="saveError" class="rounded bg-red-50 p-2 text-xs text-red-600 font-medium">
            {{ saveError }}
          </div>

          <form class="space-y-3" @submit.prevent="handleSave">
            <AppFormField label="Nama Tampilan Jenis Izin" required>
              <input v-model="form.name" type="text" required class="input text-xs" />
            </AppFormField>

            <AppFormField label="Keterangan / Penjelasan">
              <textarea v-model="form.description" rows="2" class="input text-xs" />
            </AppFormField>

            <div class="grid grid-cols-2 gap-3">
              <AppFormField label="Warna Label (HEX)">
                <div class="flex items-center gap-2">
                  <input v-model="form.color" type="color" class="h-9 w-12 rounded cursor-pointer border border-slate-300" />
                  <input v-model="form.color" type="text" class="input text-xs font-mono" />
                </div>
              </AppFormField>

              <AppFormField label="Kuota Tahunan Default">
                <input v-model.number="form.defaultAnnualQuota" type="number" step="0.5" class="input text-xs" placeholder="Misal: 12" />
              </AppFormField>
            </div>

            <div class="space-y-2 border-t border-slate-100 pt-3">
              <AppToggle v-model="form.requiresAttachment" label="Wajib Mengunggah Dokumen / Surat Bukti" />
              <AppToggle v-model="form.allowHalfDay" label="Izinkan Pengajuan Setengah Hari (0.5 hari)" />
              <AppToggle v-model="form.allowBackdate" label="Izinkan Tanggal Mundur (Backdate)" />
              <div v-if="form.allowBackdate" class="pl-8">
                <AppFormField label="Maksimal Mundur (Hari Kerja)">
                  <input v-model.number="form.maxBackdateDays" type="number" min="1" max="30" class="input text-xs" />
                </AppFormField>
              </div>
              <AppToggle v-model="form.countsWorkingDaysOnly" label="Hanya Menghitung Hari Kerja (Sabtu/Minggu/Libur Tidak Dihitung)" />
              <AppToggle v-model="form.isActive" label="Jenis Izin Aktif dan Dapat Dipilih" />
            </div>

            <div class="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button type="button" class="btn-ghost text-xs" @click="editModalOpen = false">Batal</button>
              <button type="submit" :disabled="isSaving" class="btn-primary text-xs">
                {{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
