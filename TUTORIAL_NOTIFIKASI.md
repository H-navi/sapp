# Panduan Implementasi & Konfigurasi Notifikasi (Email & Telegram)

Dokumen ini menjelaskan langkah demi langkah cara mengaktifkan dan menguji sistem notifikasi otomatis pada **Sistem Perizinan Pegawai**, baik melalui kanal **Email (Gmail SMTP)** maupun **Telegram Bot**.

---

## 1. Arsitektur Notifikasi

Sistem notifikasi dirancang dengan konsep **antrean andal (reliable queue)** dan **prioritas cerdas**:
- **Antrean Asinkron (`notifications`)**: Notifikasi dibuat saat event terjadi (pengajuan baru, giliran persetujuan, pengingat SLA, keputusan cuti) dan disimpan dalam tabel database.
- **Pengiriman Berkala (Dispatcher Task)**: Dijalankan otomatis setiap 2 menit oleh background task Nitro (`notification:dispatch`) dengan proteksi *Advisory Lock* PostgreSQL.
- **Mode Simulasi Aman (Dev Fallback)**: Jika variabel lingkungan belum diisi di `.env`, aplikasi **tidak akan error**. Sistem otomatis mencatat log simulasi ke konsol server dan menandai status pengiriman berhasil.
- **Pengecualian Jam Tenang (Quiet Hours)**: Notifikasi keputusan final (`REQUEST_APPROVED`, `REQUEST_REJECTED`, dll.) selalu dikirim seketika tanpa tertahan jam tenang pegawai.

---

## 2. Konfigurasi Email (Default: Gmail SMTP)

Pengiriman email menggunakan protokol SMTP standar dengan layout HTML responsif perusahaan. Untuk akun Gmail gratis maupun Google Workspace, Google mewajibkan penggunaan **Sandi Aplikasi (App Password)** dengan autentikasi 2 langkah aktif.

### Langkah-langkah Pembuatan App Password Gmail:
1. **Buka Keamanan Akun Google**:
   - Kunjungi [Google Account Security](https://myaccount.google.com/security).
   - Pastikan Anda login dengan akun Gmail pengirim (mis. `notifikasi.kantor@gmail.com`).
2. **Aktifkan Verifikasi 2 Langkah (2-Step Verification)**:
   - Jika belum aktif, klik **Verifikasi 2 Langkah** dan ikuti instruksi hingga selesai.
3. **Buat Sandi Aplikasi (App Password)**:
   - Pada kolom pencarian pengaturan akun Google di bagian atas, ketik: **"Sandi Aplikasi"** atau **"App Passwords"** (atau langsung akses [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
   - Pada input nama aplikasi, ketik: `Sistem Perizinan Pegawai`.
   - Klik tombol **Buat (Create)**.
   - Google akan menampilkan **16 karakter sandi acak** (contoh: `abcd efgh ijkl mnop`).
   - Salin 16 karakter tersebut (tanpa spasi).

### Memasukkan ke Berkas `.env`:
Buka berkas `.env` di root proyek Anda dan sesuaikan konfigurasi SMTP berikut:

```env
# =====================================================================
# KONFIGURASI EMAIL SMTP (GMAIL)
# =====================================================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="alamat_email_anda@gmail.com"
SMTP_PASSWORD="abcdefghijklmnop"
SMTP_FROM="Sistem Perizinan Pegawai <alamat_email_anda@gmail.com>"
```

> [!TIP]
> **Opsi Sandbox Lokal (Mailtrap):**
> Jika Anda tidak ingin mengirim email ke kotak masuk sungguhan saat uji coba lokal, Anda bisa menggunakan [Mailtrap](https://mailtrap.io):
> ```env
> SMTP_HOST="sandbox.smtp.mailtrap.io"
> SMTP_PORT=2525
> SMTP_USER="your_mailtrap_user"
> SMTP_PASSWORD="your_mailtrap_password"
> SMTP_FROM="Sistem Perizinan <no-reply@perusahaan.co.id>"
> ```

---

## 3. Konfigurasi Telegram Bot

Notifikasi Telegram dikirim langsung ke obrolan pribadi masing-masing pegawai atau approver menggunakan Bot Telegram resmi.

### Langkah-langkah Pembuatan Bot via BotFather:
1. Buka aplikasi Telegram di HP atau Desktop.
2. Cari akun resmi **`@BotFather`** (perhatikan centang verifikasi biru) atau buka tautan [t.me/BotFather](https://t.me/BotFather).
3. Klik **Start** atau kirim pesan:
   ```text
   /newbot
   ```
4. Masukkan **Nama Bot** yang ramah pengguna, misalnya:
   ```text
   Sistem Perizinan Pegawai
   ```
5. Masukkan **Username Bot** (harus diakhiri dengan kata `bot` dan unik di seluruh dunia), misalnya:
   ```text
   perizinan_kantor_notif_bot
   ```
6. `@BotFather` akan mengirimkan pesan berisi **HTTP API Token** (contoh format: `7123456789:AAFn9X...`).

### Memasukkan ke Berkas `.env`:
Buka berkas `.env` dan tambahkan token dan username bot:

```env
# =====================================================================
# KONFIGURASI TELEGRAM BOT
# =====================================================================
TELEGRAM_BOT_TOKEN="7123456789:AAFn9X..."
TELEGRAM_BOT_USERNAME="perizinan_kantor_notif_bot"
```

---

## 4. Cara Pegawai & Approver Menautkan Akun Telegram

Agar notifikasi perizinan sampai ke obrolan Telegram pegawai/approver, akun mereka perlu ditautkan satu kali (*one-time linking*):

1. **Buka Halaman Profil**:
   - Login ke aplikasi Sistem Perizinan.
   - Buka menu **Profil** (`/profil`).
2. **Klik "Hubungkan Telegram"**:
   - Pada kartu **Notifikasi & Penautan Telegram**, klik tombol biru **Hubungkan Telegram**.
   - Modal dialog akan menampilkan tombol **Buka Telegram (t.me/...)** dan instruksi perintah `/start <token>`.
3. **Kirim Perintah /start di Bot**:
   - Ketika tautan dibuka di Telegram, tekan tombol **Start** di bawah obrolan.
   - Bot akan membalas:
     > *"✅ Halo, [Nama Pegawai]! Akun Telegram Anda berhasil ditautkan ke Sistem Perizinan Pegawai."*
   - Dalam hitungan detik, badge di halaman profil akan berubah menjadi **Terhubung** (lengkap dengan Chat ID Anda).
4. **Pengaturan Jam Tenang (*Quiet Hours*)**:
   - Di halaman Profil yang sama, pegawai dapat menentukan jam tenang (misal: `21:00` s/d `06:00`) agar ponsel tidak berdering saat jam istirahat.

---

## 5. Menguji dan Memantau Notifikasi

### Menguji Template Langsung dari Dasbor Admin
1. Masuk ke halaman **Admin** -> **Template & Notifikasi** (`/admin/notifikasi`).
2. Pilih salah satu template (misal: `Tugas Approval Baru (Email)` atau `Tugas Approval Baru (Telegram)`).
3. Anda dapat melihat **Pratinjau Langsung (Live Preview)** di sebelah kanan:
   - Pratinjau Email dengan banner warna biru, data contoh permohonan, dan tombol tautan.
   - Pratinjau Telegram dengan bubble chat gelap, teks tebal, dan format HTML.
4. Klik tombol **"Kirim Uji ke Saya"**:
   - Sistem akan mengirimkan pesan uji coba langsung ke email atau Telegram akun admin yang sedang login.
   - Jika akun admin belum menautkan Telegram, sistem akan memberikan petunjuk ramah untuk menautkannya terlebih dahulu di menu Profil.

### Memantau Log Antrean & Pengiriman
1. Masuk ke menu **Admin** -> **Log Antrean** (`/admin/notifikasi/log`).
2. Anda dapat melihat:
   - Statistik aktivitas 24 jam: **Total Pesan**, **Berhasil Terkirim**, **Dalam Antrean**, **Gagal Terkirim**.
   - Daftar audit seluruh pengiriman beserta status (`QUEUED`, `SENDING`, `SENT`, `FAILED`).
   - Tombol **Detail** untuk melihat isi pesan lengkap dan respons error provider.
   - Tombol **Kirim Ulang** untuk mencoba mengirim kembali notifikasi yang sempat gagal.

---

## 6. Pemecahan Masalah (Troubleshooting & FAQ)

### Q: Email gagal terkirim dengan pesan error `535 5.7.8 Username and Password not accepted`?
- **Penyebab**: Sandi yang dimasukkan adalah sandi login biasa akun Google, atau 2-Step Verification belum aktif.
- **Solusi**: Pastikan Anda membuat **Sandi Aplikasi (App Password)** 16 karakter di Google Security Settings dan memasukkannya ke `SMTP_PASSWORD`.

### Q: Pesan Telegram gagal terkirim dengan error `BOT_BLOCKED`?
- **Penyebab**: Pengguna pernah memblokir bot atau menghapus obrolan bot di aplikasi Telegram mereka.
- **Penanganan Sistem**: Dispatcher sistem secara cerdas mendeteksi status pemblokiran permanen (`403`), menghentikan percobaan berulang agar antrean tidak macet, dan menghapus `telegram_chat_id` pegawai dari database. Pegawai cukup menekan tombol hubungkan kembali di profil jika ingin mengaktifkannya lagi.

### Q: Mengapa notifikasi email saya masuk ke folder Spam?
- **Penyebab**: Saat menguji dengan domain lokal atau alamat pengirim baru, penyedia email seperti Gmail terkadang menaruh email otomatis di folder Spam/Promotions.
- **Solusi**: Buka folder Spam, klik pesan, lalu pilih **"Laporkan bukan spam"** (*Not Spam*).

### Q: Di mana letak template bawaan sistem?
- Seluruh template bawaan tersimpan di tabel database `notifications.notification_templates`.
- Jika Anda mengubah kata-kata template dan ingin mengembalikannya ke format asli pabrik, cukup buka editor template bersangkutan di `/admin/notifikasi/[id]` lalu klik tombol **"Kembalikan ke Bawaan"**.
