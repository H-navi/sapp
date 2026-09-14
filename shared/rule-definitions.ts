export type RuleType =
  | 'MAX_DAYS_PER_REQUEST'
  | 'MIN_DAYS_PER_REQUEST'
  | 'MAX_DAYS_PER_PERIOD'
  | 'MAX_REQUESTS_PER_PERIOD'
  | 'NO_CONSECUTIVE_DAYS'
  | 'ALLOWED_WEEKDAYS'
  | 'MIN_NOTICE_DAYS'
  | 'MAX_BACKDATE_DAYS'
  | 'QUOTA_SUFFICIENT'
  | 'ATTACHMENT_REQUIRED'
  | 'ATTACHMENT_REQUIRED_IF_DAYS_GTE'
  | 'GENDER_RESTRICTION'
  | 'MIN_EMPLOYMENT_MONTHS'
  | 'EMPLOYMENT_STATUS_ALLOWED'
  | 'ONCE_PER_EMPLOYMENT'
  | 'MAX_PER_YEAR'
  | 'NO_OVERLAP_REQUEST'
  | 'BLACKOUT_PERIOD'
  | 'MAX_CONCURRENT_TEAM_ON_LEAVE'
  | 'CUSTOM_EXPRESSION'

export interface ParamField {
  key: string
  label: string
  type: 'number' | 'select' | 'text' | 'multiselect' | 'json' | 'ranges'
  options?: Array<{ value: string | number; label: string }>
  min?: number
  max?: number
  step?: number
  required?: boolean
  defaultValue?: any
  placeholder?: string
}

export interface RuleDefinition {
  label: string
  description: string
  category: 'duration' | 'schedule' | 'eligibility' | 'resource' | 'attachment' | 'custom'
  params: ParamField[]
  defaultMessage: string
  availableVars: string[]
}

export const COMMON_RULE_VARS = [
  'employee_name',
  'leave_type_name',
  'requested_days',
  'start_date',
  'end_date',
  'employment_status',
]

export const RULE_DEFINITIONS: Record<RuleType, RuleDefinition> = {
  MAX_DAYS_PER_REQUEST: {
    label: 'Maksimal Hari per Pengajuan',
    description: 'Membatasi batas atas jumlah hari yang diajukan dalam satu formulir.',
    category: 'duration',
    params: [
      { key: 'max_days', label: 'Maksimal Hari', type: 'number', min: 0.5, step: 0.5, required: true, defaultValue: 5 },
    ],
    defaultMessage: 'Pengajuan {{requested_days}} hari melebihi batas maksimal {{max_days}} hari per pengajuan.',
    availableVars: ['max_days', 'requested_days', ...COMMON_RULE_VARS],
  },

  MIN_DAYS_PER_REQUEST: {
    label: 'Minimal Hari per Pengajuan',
    description: 'Membatasi batas bawah jumlah hari yang diajukan dalam satu formulir.',
    category: 'duration',
    params: [
      { key: 'min_days', label: 'Minimal Hari', type: 'number', min: 0.5, step: 0.5, required: true, defaultValue: 1 },
    ],
    defaultMessage: 'Pengajuan {{requested_days}} hari kurang dari batas minimal {{min_days}} hari.',
    availableVars: ['min_days', 'requested_days', ...COMMON_RULE_VARS],
  },

  MAX_DAYS_PER_PERIOD: {
    label: 'Maksimal Hari per Periode',
    description: 'Membatasi jumlah hari izin dalam rentang waktu tertentu (Minggu, Bulan, Kuartal, atau Tahun).',
    category: 'duration',
    params: [
      { key: 'max_days', label: 'Maksimal Hari', type: 'number', min: 0.5, step: 0.5, required: true, defaultValue: 2 },
      {
        key: 'period',
        label: 'Periode',
        type: 'select',
        options: [
          { value: 'WEEK', label: 'Mingguan (ISO Week)' },
          { value: 'MONTH', label: 'Bulanan' },
          { value: 'QUARTER', label: 'Kuartalan' },
          { value: 'YEAR', label: 'Tahunan' },
        ],
        required: true,
        defaultValue: 'WEEK',
      },
    ],
    defaultMessage: 'Kuota {{max_days}} hari per {{period}} sudah terpakai {{current_days}} hari pada periode {{violating_period}}.',
    availableVars: ['max_days', 'period', 'current_days', 'violating_period', ...COMMON_RULE_VARS],
  },

  MAX_REQUESTS_PER_PERIOD: {
    label: 'Maksimal Pengajuan per Periode',
    description: 'Membatasi frekuensi pengajuan izin dalam periode tertentu.',
    category: 'duration',
    params: [
      { key: 'max_requests', label: 'Maksimal Kali Pengajuan', type: 'number', min: 1, step: 1, required: true, defaultValue: 2 },
      {
        key: 'period',
        label: 'Periode',
        type: 'select',
        options: [
          { value: 'MONTH', label: 'Bulan' },
          { value: 'YEAR', label: 'Tahun' },
        ],
        required: true,
        defaultValue: 'MONTH',
      },
    ],
    defaultMessage: 'Anda sudah mengajukan {{leave_type_name}} sebanyak {{current_count}} kali periode ini (maksimal {{max_requests}} kali).',
    availableVars: ['max_requests', 'period', 'current_count', ...COMMON_RULE_VARS],
  },

  MAX_PER_YEAR: {
    label: 'Maksimal Hari per Tahun Kalender',
    description: 'Membatasi akumulasi hari izin dalam satu tahun kalender berjalan.',
    category: 'duration',
    params: [
      { key: 'max_days', label: 'Maksimal Hari per Tahun', type: 'number', min: 1, step: 0.5, required: true, defaultValue: 14 },
    ],
    defaultMessage: 'Total {{leave_type_name}} Anda tahun ini sudah mencapai {{used_days}} hari, melebihi batas {{max_days}} hari per tahun.',
    availableVars: ['max_days', 'used_days', 'requested_days', ...COMMON_RULE_VARS],
  },

  NO_CONSECUTIVE_DAYS: {
    label: 'Tidak Boleh Hari Berturutan',
    description: 'Mengharuskan adanya jeda hari kerja antara hari izin (misal kebijakan WFA).',
    category: 'schedule',
    params: [
      { key: 'min_gap_working_days', label: 'Jeda Minimal (Hari Kerja)', type: 'number', min: 1, step: 1, required: true, defaultValue: 1 },
    ],
    defaultMessage: 'Izin tidak boleh diambil pada hari kerja berurutan ({{violating_dates}}). Diperlukan jeda minimal {{min_gap_working_days}} hari kerja.',
    availableVars: ['min_gap_working_days', 'violating_dates', ...COMMON_RULE_VARS],
  },

  ALLOWED_WEEKDAYS: {
    label: 'Hari Kerja yang Diperbolehkan',
    description: 'Hanya memperbolehkan hari tertentu dalam seminggu (misal WFA hanya Selasa-Kamis).',
    category: 'schedule',
    params: [
      {
        key: 'weekdays',
        label: 'Hari yang Diizinkan',
        type: 'multiselect',
        options: [
          { value: 1, label: 'Senin' },
          { value: 2, label: 'Selasa' },
          { value: 3, label: 'Rabu' },
          { value: 4, label: 'Kamis' },
          { value: 5, label: 'Jumat' },
          { value: 6, label: 'Sabtu' },
          { value: 7, label: 'Minggu' },
        ],
        required: true,
        defaultValue: [2, 3, 4],
      },
    ],
    defaultMessage: 'Hanya diperbolehkan pada hari yang telah ditentukan. Tanggal melanggar: {{violating_dates}}.',
    availableVars: ['weekdays', 'violating_dates', ...COMMON_RULE_VARS],
  },

  MIN_NOTICE_DAYS: {
    label: 'Pemberitahuan Minimal di Muka (Notice Days)',
    description: 'Mewajibkan pengajuan diajukan minimal N hari sebelum tanggal mulai.',
    category: 'schedule',
    params: [
      { key: 'min_notice_days', label: 'Minimal Hari Sebelumnya', type: 'number', min: 0, step: 1, required: true, defaultValue: 3 },
      {
        key: 'count',
        label: 'Metode Perhitungan',
        type: 'select',
        options: [
          { value: 'WORKING', label: 'Hari Kerja' },
          { value: 'CALENDAR', label: 'Hari Kalender' },
        ],
        required: true,
        defaultValue: 'WORKING',
      },
    ],
    defaultMessage: 'Pengajuan harus diajukan minimal {{min_notice_days}} hari sebelumnya. Pengajuan aktual: {{actual_notice_days}} hari.',
    availableVars: ['min_notice_days', 'actual_notice_days', ...COMMON_RULE_VARS],
  },

  MAX_BACKDATE_DAYS: {
    label: 'Batas Maksimal Pengajuan Mundur (Backdate)',
    description: 'Membatasi berapa hari ke belakang pengajuan dapat dibuat (misal izin sakit).',
    category: 'schedule',
    params: [
      { key: 'max_backdate_days', label: 'Maksimal Hari Mundur', type: 'number', min: 0, step: 1, required: true, defaultValue: 2 },
    ],
    defaultMessage: 'Pengajuan tanggal lampau melebihi batas {{max_backdate_days}} hari mundur (aktual: {{backdate_days}} hari).',
    availableVars: ['max_backdate_days', 'backdate_days', ...COMMON_RULE_VARS],
  },

  BLACKOUT_PERIOD: {
    label: 'Periode Larangan Cuti (Blackout)',
    description: 'Melarang pengajuan cuti pada rentang tanggal tertentu (misal tutup buku akhir tahun).',
    category: 'schedule',
    params: [
      { key: 'ranges', label: 'Daftar Rentang Larangan', type: 'ranges', required: true, defaultValue: [] },
    ],
    defaultMessage: 'Tanggal {{violating_dates}} berada dalam periode larangan cuti ({{blackout_range}}).',
    availableVars: ['blackout_range', 'violating_dates', ...COMMON_RULE_VARS],
  },

  QUOTA_SUFFICIENT: {
    label: 'Kecukupan Sisa Kuota',
    description: 'Memastikan sisa kuota pegawai mencukupi untuk jumlah hari yang diajukan.',
    category: 'resource',
    params: [],
    defaultMessage: 'Sisa kuota {{leave_type_name}} Anda {{balance}} hari, tidak mencukupi untuk pengajuan {{requested_days}} hari.',
    availableVars: ['balance', 'requested_days', ...COMMON_RULE_VARS],
  },

  ATTACHMENT_REQUIRED: {
    label: 'Wajib Lampiran Dokumen',
    description: 'Mengharuskan pegawai mengunggah bukti dokumen pendukung.',
    category: 'attachment',
    params: [
      { key: 'min_files', label: 'Jumlah Minimal Berkas', type: 'number', min: 1, step: 1, required: true, defaultValue: 1 },
    ],
    defaultMessage: 'Wajib melampirkan minimal {{min_files}} dokumen pendukung (terunggah: {{actual_files}}).',
    availableVars: ['min_files', 'actual_files', ...COMMON_RULE_VARS],
  },

  ATTACHMENT_REQUIRED_IF_DAYS_GTE: {
    label: 'Wajib Lampiran Jika Durasi Mencapai Ambang Batas',
    description: 'Wajib melampirkan berkas hanya jika durasi izin sama dengan atau lebih besar dari batas hari.',
    category: 'attachment',
    params: [
      { key: 'days', label: 'Ambang Batas Hari (>=)', type: 'number', min: 1, step: 0.5, required: true, defaultValue: 2 },
      { key: 'min_files', label: 'Minimal Berkas', type: 'number', min: 1, step: 1, required: true, defaultValue: 1 },
    ],
    defaultMessage: 'Izin dengan durasi {{requested_days}} hari (>= {{days}} hari) wajib melampirkan dokumen surat pendukung.',
    availableVars: ['days', 'min_files', 'requested_days', 'actual_files', ...COMMON_RULE_VARS],
  },

  GENDER_RESTRICTION: {
    label: 'Pembatasan Gender Pegawai',
    description: 'Membatasi jenis izin hanya untuk jenis kelamin tertentu (misal cuti melahirkan untuk perempuan).',
    category: 'eligibility',
    params: [
      {
        key: 'gender',
        label: 'Gender yang Diizinkan',
        type: 'select',
        options: [
          { value: 'FEMALE', label: 'Perempuan' },
          { value: 'MALE', label: 'Laki-laki' },
        ],
        required: true,
        defaultValue: 'FEMALE',
      },
    ],
    defaultMessage: 'Jenis izin ini hanya dapat diajukan oleh pegawai berjenis kelamin {{gender}}.',
    availableVars: ['gender', 'actual_gender', ...COMMON_RULE_VARS],
  },

  MIN_EMPLOYMENT_MONTHS: {
    label: 'Masa Kerja Minimal (Bulan)',
    description: 'Mengharuskan masa kerja pegawai mencapai jumlah bulan tertentu sebelum berhak mengajukan.',
    category: 'eligibility',
    params: [
      { key: 'months', label: 'Masa Kerja Minimal (Bulan)', type: 'number', min: 1, step: 1, required: true, defaultValue: 12 },
    ],
    defaultMessage: 'Baru dapat diajukan setelah masa kerja {{months}} bulan. Masa kerja Anda saat ini {{actual_months}} bulan.',
    availableVars: ['months', 'actual_months', ...COMMON_RULE_VARS],
  },

  EMPLOYMENT_STATUS_ALLOWED: {
    label: 'Status Kepegawaian yang Diizinkan',
    description: 'Membatasi hak pengajuan berdasarkan status kontrak/tetap/probation.',
    category: 'eligibility',
    params: [
      {
        key: 'statuses',
        label: 'Status yang Diizinkan',
        type: 'multiselect',
        options: [
          { value: 'PERMANENT', label: 'Tetap (Permanent)' },
          { value: 'CONTRACT', label: 'Kontrak (Contract)' },
          { value: 'PROBATION', label: 'Percobaan (Probation)' },
          { value: 'INTERN', label: 'Magang (Intern)' },
          { value: 'OUTSOURCE', label: 'Outsource' },
        ],
        required: true,
        defaultValue: ['PERMANENT', 'CONTRACT'],
      },
    ],
    defaultMessage: 'Hanya untuk status kepegawaian {{statuses}}. Status Anda: {{employment_status}}.',
    availableVars: ['statuses', 'employment_status', ...COMMON_RULE_VARS],
  },

  ONCE_PER_EMPLOYMENT: {
    label: 'Hanya Sekali Selama Masa Kerja',
    description: 'Jenis izin hanya dapat diambil satu kali seumur hidup selama bekerja di perusahaan (misal izin menikah).',
    category: 'eligibility',
    params: [],
    defaultMessage: 'Hanya dapat diambil sekali selama masa kerja (sebelumnya sudah diajukan pada: {{previous_request_number}}).',
    availableVars: ['previous_request_number', ...COMMON_RULE_VARS],
  },

  NO_OVERLAP_REQUEST: {
    label: 'Cegah Tanggal Bertumpuk (Overlap)',
    description: 'Menolak pengajuan jika tanggal bertabrakan dengan permohonan lain yang aktif/disetujui.',
    category: 'resource',
    params: [],
    defaultMessage: 'Tanggal yang dipilih bertumpuk dengan pengajuan lain yang masih aktif ({{conflict_request_number}}).',
    availableVars: ['conflict_request_number', ...COMMON_RULE_VARS],
  },

  MAX_CONCURRENT_TEAM_ON_LEAVE: {
    label: 'Batas Kuota Bersamaan Rekan Satu Tim',
    description: 'Membatasi maksimal jumlah rekan satu divisi/departemen yang boleh izin bersamaan di tanggal yang sama.',
    category: 'resource',
    params: [
      { key: 'max_people', label: 'Maksimal Orang Bersamaan', type: 'number', min: 1, step: 1, required: true, defaultValue: 2 },
      {
        key: 'scope',
        label: 'Cakupan Tim',
        type: 'select',
        options: [{ value: 'DEPARTMENT', label: 'Satu Departemen' }],
        required: true,
        defaultValue: 'DEPARTMENT',
      },
    ],
    defaultMessage: 'Sudah ada {{current_count}} rekan satu departemen yang izin pada tanggal tersebut (batas maksimal {{max_people}} orang).',
    availableVars: ['max_people', 'current_count', 'violating_dates', ...COMMON_RULE_VARS],
  },

  CUSTOM_EXPRESSION: {
    label: 'Ekspresi Kustom (JSON)',
    description: 'Validasi dinamis berbasis ekspresi kondisi terstruktur tanpa eval.',
    category: 'custom',
    params: [
      {
        key: 'expression',
        label: 'Ekspresi Kondisi (JSON)',
        type: 'json',
        required: true,
        defaultValue: { field: 'totalDays', op: 'lte', value: 5 },
        placeholder: '{"field":"totalDays","op":"lte","value":5}',
      },
    ],
    defaultMessage: 'Pengajuan tidak memenuhi ekspresi kustom yang dipersyaratkan ({{field}} {{op}} {{value}}, aktual: {{actual_value}}).',
    availableVars: ['field', 'op', 'value', 'actual_value', ...COMMON_RULE_VARS],
  },
}
