<script setup lang="ts">
export interface UploadedFileItem {
  id?: string
  name: string
  sizeBytes?: number
  url?: string
}

const props = withDefaults(
  defineProps<{
    files?: UploadedFileItem[]
    accept?: string
    maxSizeMb?: number
    uploading?: boolean
    multiple?: boolean
    disabled?: boolean
  }>(),
  {
    files: () => [],
    accept: '.pdf,.jpg,.jpeg,.png',
    maxSizeMb: 5,
    uploading: false,
    multiple: false,
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: 'select', files: FileList): void
  (e: 'remove', idx: number): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    emit('select', target.files)
  }
}

function triggerSelect() {
  if (!props.disabled && !props.uploading && fileInputRef.value) {
    fileInputRef.value.click()
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<template>
  <div class="space-y-3">
    <!-- Input File Tersembunyi -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled || uploading"
      @change="onFileChange"
    />

    <!-- Upload Dropzone / Button -->
    <div
      class="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center transition-colors cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 active:scale-[0.99]"
      :class="{ 'opacity-50 pointer-events-none': disabled || uploading }"
      @click="triggerSelect"
    >
      <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>

      <p class="text-sm font-semibold text-slate-800">
        {{ uploading ? 'Sedang mengunggah berkas...' : 'Ketuk untuk memilih berkas' }}
      </p>
      <p class="text-xs text-slate-500 mt-0.5">
        Format {{ accept }} (Maks. {{ maxSizeMb }} MB)
      </p>
    </div>

    <!-- Upload Progress bar if uploading -->
    <div v-if="uploading" class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
      <div class="bg-blue-600 h-1.5 rounded-full animate-pulse w-full"></div>
    </div>

    <!-- File List Preview -->
    <div v-if="files.length > 0" class="space-y-2">
      <div
        v-for="(f, idx) in files"
        :key="f.id || idx"
        class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white text-xs"
      >
        <div class="flex items-center gap-2.5 min-w-0 pr-2">
          <span class="text-slate-400 text-sm">📎</span>
          <div class="truncate">
            <p class="font-semibold text-slate-800 truncate">{{ f.name }}</p>
            <p v-if="f.sizeBytes" class="text-[11px] text-slate-400 tabular-nums">{{ formatSize(f.sizeBytes) }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <a
            v-if="f.url"
            :href="f.url"
            target="_blank"
            class="text-blue-600 hover:underline font-medium min-h-[32px] inline-flex items-center px-1"
          >
            Buka
          </a>

          <button
            type="button"
            class="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 min-h-[36px] min-w-[36px] inline-flex items-center justify-center transition"
            title="Hapus berkas"
            @click.stop="emit('remove', idx)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
