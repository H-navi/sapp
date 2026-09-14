# Panduan & Daftar Periksa Rilis (Release Checklist) — SAPP

Dokumen ini disusun untuk **Han (Product Owner / Lead Developer)** sebagai panduan uji terima (UAT), audit keamanan, dan prosedur peluncuran sistem ke lingkungan produksi sesuai spesifikasi teknis `doc/13-testing-checklist.md`.

---

## 1. Hasil Pengujian Otomatis (Automated Test Status)

Seluruh lapis pengujian otomatis telah dijalankan dan **100% LULUS**:

| Lapis Pengujian | Alat | Berkas Uji | Jumlah Test | Status |
|---|---|---|---|---|
| **Unit Test** | Vitest | Aturan (durasi, kuota, jadwal, attachment, eligibility), Aritmetika Jam Kerja, Perender Template, Pemilih Alur, Pelaporan | ~128 | ✅ **LULUS (100%)** |
| **Integrasi Test** | Vitest + DB PostgreSQL | Lifecycle Pengajuan (`submit.spec.ts`), Anti-Tumpang Tindih (`overlap.spec.ts`), Approval Multi-tahap (`approve.spec.ts`), Penolakan Bertingkat (`reject.spec.ts`), Eskalasi SLA (`escalation.spec.ts`), Keputusan Otomatis (`auto-decision.spec.ts`), Pengingat & Jam Kerja (`reminder.spec.ts`), Rekonsiliasi Kuota & Ledger (`quota.spec.ts`), Otorisasi Admin (`permission.spec.ts`) | 20 | ✅ **LULUS (100%)** |
| **Static Analysis** | `vue-tsc --noEmit` | Seluruh codebase TypeScript & Vue SFC | 0 error | ✅ **LULUS (0 Error)** |
| **Total Otomatis** | Vitest Run | **28 berkas pengujian** | **148 test** | ✅ **148/148 LULUS** |

Perintah eksekusi:
```powershell
# Jalankan seluruh unit & integrasi test:
npm run test

# Jalankan pemeriksaan tipe statis:
npx vue-tsc --noEmit
```

---

## 2. Uji Terima Pengguna (UAT Checklist) — [Han]

Lakukan uji penerimaan ini menggunakan peranti ponsel nyata (*smartphone*) dan libatkan perwakilan dari tiap peran pengguna:

### A. Pegawai (Employee)
- [ ] **Login & Ganti Password:** Login pertama kali mewajibkan ganti password default (`must_change_password=true`).
- [ ] **Form Pengajuan:** Mengajukan 6 jenis izin (Cuti Tahunan, Sakit, Izin Tidak Masuk, Menikah, Melahirkan, WFA) menampilkan syarat dan pesan kebijakan yang sesuai.
- [ ] **Validasi Kuota:** Mengajukan cuti melebihi sisa kuota langsung tertahan di antarmuka dengan pesan informatif.
- [ ] **Unggah Lampiran:** Unggah foto surat dokter/undangan langsung dari kamera ponsel berfungsi dengan baik (hanya format PDF/PNG/JPG).
- [ ] **Pembatalan:** Pegawai dapat membatalkan pengajuannya sendiri yang masih berstatus `DRAFT` atau `IN_REVIEW`.
- [ ] **Notifikasi:** Menerima email dan pesan Telegram secara real-time; tombol/tautan langsung mengarahkan ke halaman detail pengajuan.
- [ ] **Lini Masa:** Pemohon dapat melihat status pengajuan dan posisi penugasan approval di lini masa tanpa kebingungan.

### B. Approver (Atasan & HRD)
- [ ] **Notifikasi Tindakan:** Menerima email/Telegram dengan tautan persetujuan sekali klik.
- [ ] **Aksi Persetujuan:** Menyetujui pengajuan langsung memajukan tahap approval atau menyelesaikan pengajuan jika tahap terakhir.
- [ ] **Aksi Penolakan:** Menolak wajib mengisi catatan penolakan (minimal 10 karakter); pemohon langsung menerima alasan penolakan di lini masa dan notifikasi.
- [ ] **Pengingat Berkala:** Pengingat otomatis hanya dikirim pada jam kerja perusahaan, dan dijeda saat di luar jam kerja/hari libur.
- [ ] **Delegasi:** Approver dapat mengaktifkan delegasi saat cuti; tugas approval diteruskan ke delegat yang ditunjuk.
- [ ] **Konkurensi:** Pada mode `ANY_ONE`, approver kedua yang bertindak terlambat menerima pemberitahuan santun bahwa tugas telah diselesaikan approver lain (HTTP 409).

### C. Administrator Sistem
- [ ] **Manajemen Pegawai:** Tambah pegawai baru, ubah atasan langsung, dan atur hak submit perizinan.
- [ ] **Konfigurasi Aturan:** Ubah hari yang diizinkan untuk WFA (misal Selasa-Kamis); pengajuan baru yang melanggar langsung tertahan di form.
- [ ] **Penyusun Alur (Workflow Builder):** Tambah tahap persetujuan baru; fitur simulasi alur menampilkan nama approver yang tepat.
- [ ] **Editor Template Notifikasi:** Kustomisasi pesan notifikasi dengan live preview variabel `{{employee_name}}`, `{{request_number}}`, dan tombol uji kirim notifikasi.
- [ ] **Laporan & Ekspor:** Mengunduh rekap bulanan dalam format CSV dan memeriksa kecocokan angkanya dengan buku besar kuota.

### D. Verifikasi Keputusan Otomatis (Auto-Decision)
- [ ] **Auto-Approve:** Pengajuan yang memenuhi seluruh aturan kebijakan dan dibiarkan hingga melewati `final_deadline_at` disetujui otomatis oleh sistem (`is_auto_decided=true`).
- [ ] **Auto-Reject:** Pengajuan yang melanggar aturan (misal WFA hari Senin) dan dibiarkan hingga melewati batas waktu ditolak otomatis oleh sistem dengan alasan menyebut aturan yang dilanggar.
- [ ] **Pencegahan Otomatis (Require Approval):** Pengajuan yang melanggar aturan bernilai `REQUIRE_APPROVAL` (misal cuti > 5 hari berturut-turut) **TIDAK PERNAH** disetujui otomatis oleh sistem, melainkan diperpanjang satu siklus dan diteruskan ke administrator.
- [ ] **Audit Keputusan:** Riwayat persetujuan menampilkan perbedaan visual yang jelas antara keputusan manusia dan keputusan sistem (`SYSTEM_AUTO`).

---

## 3. Daftar Periksa Keamanan (Security Checklist)

- [x] **Otorisasi Menyeluruh:** Seluruh 56 endpoint `/api/admin/**` dijaga oleh `requirePermission`/`requireRole`/`requireAuth` (diuji di `permission.spec.ts`).
- [x] **Isolasi Data Antar-Pegawai:** Fungsi `assertCanViewEmployee` mencegah pegawai biasa melihat permohonan atau data pegawai lain dengan menebak UUID.
- [x] **SQL Injection Prevention:** 100% kueri database menggunakan Drizzle ORM atau Tagged Template String SQL postgres (`sql`...``), tidak ada penggabungan string mentah (`string concatenation`).
- [x] **Validasi File Upload:** Memeriksa magic bytes riil (bukan hanya ekstensi file), membatasi ukuran berkas maksimal 5MB, dan menyimpan berkas di luar folder web root (`storage/attachments/`).
- [x] **Bcrypt Password:** Password pengguna di-hash menggunakan bcrypt dengan salt rounds 12.
- [x] **Penanganan Transaksi:** Seluruh mutasi kuota dan perubahan status dieksekusi dalam transaksi ACID dengan penguncian baris (`FOR UPDATE`), mencegah *race condition* dan *double-spending*.
- [ ] **[Han - Produksi]** Pastikan `NODE_ENV=production` saat deploy agar endpoint `/api/dev/*` otomatis nonaktif (404).
- [ ] **[Han - Produksi]** Pastikan cookie sesi disetel `secure=true` (HTTPS) dan `httpOnly=true`.

---

## 4. Prosedur Pra-Rilis & Rencana Peluncuran (Deployment Steps)

### Langkah Pra-Rilis (Wajib Dilakukan Sebelum Go-Live)
1. **Ganti Kredensial Bawaan (.env):**
   - Buat secret sesi baru yang acak: `openssl rand -base64 48` → isi ke `NUXT_SESSION_SECRET`.
   - Ganti password akun database `POSTGRES_PASSWORD` dan password akun admin sistem bawaan.
2. **Koneksi Notifikasi Produksi:**
   - Masukkan kredensial SMTP email produksi (misal Google Workspace / AWS SES / Mailgun).
   - Masukkan token Bot Telegram resmi perusahaan dan verifikasi webhook/polling.
3. **Data Master Nyata:**
   - Impor data pegawai, departemen, jabatan, dan atasan langsung dari HRIS perusahaan.
   - Sesuaikan hari libur nasional tahun berjalan sesuai SKB 3 Menteri pada tabel `holidays`.
   - Sesuaikan jam kerja dan jam istirahat perusahaan pada tabel `working_hours`.
   - Ganti aturan dummy pada tabel `leave_policy_rules` dengan kebijakan HRD yang disetujui secara tertulis.
   - Jalankan alokasi kuota cuti tahunan berjalan melalui modul admin kuota.
4. **Uji Cadangan & Pemulihan (Backup Drill):**
   - Jalankan cadangan database:
     ```powershell
     podman exec -t sapp-postgres pg_dump -U sapp -d sapp > backup_pra_rilis.sql
     ```
   - Uji coba restore ke database pengujian sementara untuk memastikan integritas data.

### Rencana Peluncuran Bertahap (Phased Rollout)
1. **Fase 1 (Minggu 1–2): Uji Coba Terbatas (Pilot Project)**
   - Luncurkan hanya ke 1 Departemen (misal Departemen IT).
   - Setel `escalation_action` ke `NOTIFY_ADMIN_ONLY` selama 2 minggu agar tidak ada keputusan otomatis sebelum perilaku sistem terverifikasi di lapangan.
2. **Fase 2 (Minggu 3): Peluncuran Penuh (Full Rollout)**
   - Buka akses ke seluruh departemen perusahaan.
   - Aktifkan `AUTO_APPROVE` sesuai kesepakatan tertulis dengan HRD.

### Pemantauan Paska Rilis
- Pantau menu `/admin/notifikasi/log` untuk mendeteksi potensi kegagalan pengiriman email/Telegram.
- Tinjau tabel `job_executions` secara berkala untuk memastikan scheduler latar belakang (pengingat, eskalasi, auto-decision) berjalan lancar.
- Tinjau pengajuan yang diputuskan otomatis setiap minggu; bila jumlahnya terlalu tinggi, diskusikan penyesuaian SLA bersama manajemen.
