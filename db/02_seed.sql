-- =====================================================================
--  SAPP - Sistem Auto Approval Perizinan Pegawai
--  File   : 02_seed.sql
--  Isi    : data master + aturan DUMMY (silakan ubah lewat halaman admin)
--  Syarat : 01_schema.sql sudah dijalankan
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. JAM KERJA & HARI LIBUR
-- ---------------------------------------------------------------------
INSERT INTO working_hours (day_of_week, is_working_day, start_time, end_time, break_start, break_end) VALUES
    (1, true,  '08:00', '17:00', '12:00', '13:00'),
    (2, true,  '08:00', '17:00', '12:00', '13:00'),
    (3, true,  '08:00', '17:00', '12:00', '13:00'),
    (4, true,  '08:00', '17:00', '12:00', '13:00'),
    (5, true,  '08:00', '17:00', '11:30', '13:00'),
    (6, false, '08:00', '12:00', NULL, NULL),
    (7, false, '08:00', '12:00', NULL, NULL);

-- Hari libur DUMMY (ganti dengan SKB 3 Menteri tahun berjalan)
INSERT INTO holidays (holiday_date, name, type, deducts_quota) VALUES
    ('2026-01-01', 'Tahun Baru Masehi', 'NATIONAL', false),
    ('2026-03-19', 'Hari Raya Nyepi', 'NATIONAL', false),
    ('2026-03-21', 'Idul Fitri 1447 H (Hari 1)', 'NATIONAL', false),
    ('2026-03-22', 'Idul Fitri 1447 H (Hari 2)', 'NATIONAL', false),
    ('2026-03-23', 'Cuti Bersama Idul Fitri', 'JOINT_LEAVE', true),
    ('2026-05-01', 'Hari Buruh Internasional', 'NATIONAL', false),
    ('2026-08-17', 'Hari Kemerdekaan RI', 'NATIONAL', false),
    ('2026-12-25', 'Hari Raya Natal', 'NATIONAL', false);

-- ---------------------------------------------------------------------
-- 2. PENGATURAN SISTEM
-- ---------------------------------------------------------------------
INSERT INTO system_settings (key, value, value_type, group_name, description, is_secret) VALUES
    ('app.name',                  '"Sistem Perizinan Pegawai"', 'string',  'general',      'Nama aplikasi pada header & email', false),
    ('app.timezone',              '"Asia/Jakarta"',             'string',  'general',      'Zona waktu perhitungan SLA', false),
    ('app.base_url',              '"http://localhost:3000"',    'string',  'general',      'Base URL untuk tautan di notifikasi', false),
    ('reminder.default_interval_minutes', '120',                'number',  'reminder',     'Interval pengingat default (menit)', false),
    ('reminder.only_working_hours', 'true',                     'boolean', 'reminder',     'Pengingat hanya dikirim pada jam kerja', false),
    ('reminder.max_count',        '5',                          'number',  'reminder',     'Maksimum pengingat per tugas approval', false),
    ('approval.default_sla_hours','8',                          'number',  'approval',     'SLA default per step (jam kerja)', false),
    ('approval.default_deadline_hours', '24',                   'number',  'approval',     'Batas waktu keseluruhan sebelum keputusan otomatis', false),
    ('notification.email.enabled','true',                       'boolean', 'notification', 'Aktifkan kanal email', false),
    ('notification.telegram.enabled','true',                    'boolean', 'notification', 'Aktifkan kanal Telegram', false),
    ('notification.email.from',   '"no-reply@perusahaan.co.id"','string',  'notification', 'Alamat pengirim email', false),
    ('notification.telegram.bot_token', '""',                   'string',  'notification', 'Token bot Telegram (isi lewat .env, JANGAN di DB produksi)', true),
    ('quota.annual_reset_month',  '1',                          'number',  'quota',        'Bulan reset kuota tahunan', false),
    ('quota.carry_over_max_days', '6',                          'number',  'quota',        'Maksimum sisa cuti yang bisa dibawa ke tahun berikutnya', false),
    ('quota.carry_over_expire_month', '3',                      'number',  'quota',        'Bulan kadaluarsa sisa cuti tahun sebelumnya', false);

-- ---------------------------------------------------------------------
-- 3. ROLE & PERMISSION
-- ---------------------------------------------------------------------
INSERT INTO roles (code, name, description, is_system) VALUES
    ('EMPLOYEE',    'Pegawai',               'User biasa: login dan mengajukan perizinan', true),
    ('APPROVER',    'Approver',              'Berwenang menyetujui/menolak pengajuan sesuai alur', true),
    ('HR_APPROVER', 'HR Approver',           'Approver khusus dari HRD', true),
    ('ADMIN',       'Administrator Sistem',  'Mengatur hak akses, alur approval, dan aturan perizinan', true);

INSERT INTO permissions (code, name, module, description) VALUES
    ('request.view.own',      'Lihat pengajuan sendiri',        'request',      NULL),
    ('request.create',        'Membuat pengajuan perizinan',    'request',      'Hak mengajukan perizinan'),
    ('request.cancel.own',    'Membatalkan pengajuan sendiri',  'request',      NULL),
    ('request.view.team',     'Lihat pengajuan tim',            'request',      NULL),
    ('request.view.all',      'Lihat semua pengajuan',          'request',      NULL),
    ('approval.view',         'Lihat daftar tugas approval',    'approval',     NULL),
    ('approval.act',          'Menyetujui / menolak pengajuan', 'approval',     NULL),
    ('approval.delegate',     'Mendelegasikan wewenang',        'approval',     NULL),
    ('admin.employee.manage', 'Kelola data pegawai',            'admin',        NULL),
    ('admin.role.manage',     'Kelola role & hak akses user',   'admin',        NULL),
    ('admin.leavetype.manage','Kelola jenis perizinan',         'admin',        NULL),
    ('admin.policy.manage',   'Kelola aturan perizinan',        'admin',        NULL),
    ('admin.workflow.manage', 'Kelola alur approval bertingkat','admin',        NULL),
    ('admin.template.manage', 'Kustomisasi template notifikasi','admin',        NULL),
    ('admin.quota.manage',    'Kelola kuota cuti',              'admin',        NULL),
    ('admin.setting.manage',  'Kelola pengaturan sistem',       'admin',        NULL),
    ('report.view',           'Lihat laporan & rekap',          'report',       NULL),
    ('audit.view',            'Lihat log audit',                'audit',        NULL);

-- EMPLOYEE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'EMPLOYEE'
  AND p.code IN ('request.view.own', 'request.create', 'request.cancel.own');

-- APPROVER = EMPLOYEE + approval
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'APPROVER'
  AND p.code IN ('request.view.own', 'request.create', 'request.cancel.own',
                 'request.view.team', 'approval.view', 'approval.act', 'approval.delegate');

-- HR_APPROVER = APPROVER + lihat semua + laporan
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'HR_APPROVER'
  AND p.code IN ('request.view.own', 'request.create', 'request.cancel.own',
                 'request.view.team', 'request.view.all', 'approval.view',
                 'approval.act', 'approval.delegate', 'report.view', 'admin.quota.manage');

-- ADMIN = semua permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code = 'ADMIN';

-- ---------------------------------------------------------------------
-- 4. DEPARTEMEN & JABATAN
-- ---------------------------------------------------------------------
INSERT INTO departments (code, name, is_hr_department) VALUES
    ('DIR', 'Direksi',                  false),
    ('HRD', 'Human Resource',           true),
    ('IT',  'Teknologi Informasi',      false),
    ('FIN', 'Keuangan',                 false),
    ('OPS', 'Operasional',              false);

UPDATE departments SET parent_id = (SELECT id FROM departments WHERE code = 'DIR')
WHERE code IN ('HRD', 'IT', 'FIN', 'OPS');

INSERT INTO positions (code, name, level) VALUES
    ('STAFF',      'Staf',            1),
    ('SPV',        'Supervisor',      2),
    ('MGR',        'Manajer',         3),
    ('HEAD',       'Kepala Divisi',   4),
    ('DIR',        'Direktur',        5);

-- ---------------------------------------------------------------------
-- 5. PEGAWAI (DUMMY)
-- ---------------------------------------------------------------------
INSERT INTO employees (nip, full_name, email, phone, gender, department_id, position_id, employment_status, join_date, can_submit_request)
SELECT v.nip, v.full_name, v.email, v.phone, v.gender::gender_enum,
       d.id, p.id, v.status::employment_status_enum, v.join_date::date, true
FROM (VALUES
    ('EMP001', 'Hendra Wijaya',   'hendra@perusahaan.co.id',  '081200000001', 'MALE',   'DIR', 'DIR',   'PERMANENT', '2015-01-05'),
    ('EMP002', 'Joko Prasetyo',   'joko@perusahaan.co.id',    '081200000002', 'MALE',   'HRD', 'MGR',   'PERMANENT', '2017-03-01'),
    ('EMP003', 'Dewi Lestari',    'dewi@perusahaan.co.id',    '081200000003', 'FEMALE', 'HRD', 'STAFF', 'PERMANENT', '2021-07-12'),
    ('EMP004', 'Rina Kartika',    'rina@perusahaan.co.id',    '081200000004', 'FEMALE', 'IT',  'MGR',   'PERMANENT', '2018-02-19'),
    ('EMP005', 'Andi Nugroho',    'andi@perusahaan.co.id',    '081200000005', 'MALE',   'IT',  'SPV',   'PERMANENT', '2019-09-02'),
    ('EMP006', 'Budi Santoso',    'budi@perusahaan.co.id',    '081200000006', 'MALE',   'IT',  'STAFF', 'PERMANENT', '2022-04-11'),
    ('EMP007', 'Sinta Marlina',   'sinta@perusahaan.co.id',   '081200000007', 'FEMALE', 'IT',  'STAFF', 'CONTRACT',  '2024-08-01'),
    ('EMP008', 'Agus Setiawan',   'agus@perusahaan.co.id',    '081200000008', 'MALE',   'FIN', 'MGR',   'PERMANENT', '2016-11-21'),
    ('EMP009', 'Maya Puspita',    'maya@perusahaan.co.id',    '081200000009', 'FEMALE', 'FIN', 'STAFF', 'PERMANENT', '2023-01-09'),
    ('EMP010', 'Rizky Ramadhan',  'rizky@perusahaan.co.id',   '081200000010', 'MALE',   'OPS', 'STAFF', 'PROBATION', '2026-06-01')
) AS v(nip, full_name, email, phone, gender, dept_code, pos_code, status, join_date)
JOIN departments d ON d.code = v.dept_code
JOIN positions   p ON p.code = v.pos_code;

-- Atasan langsung
UPDATE employees e SET manager_id = m.id
FROM employees m
WHERE (e.nip, m.nip) IN (
    ('EMP002','EMP001'), ('EMP003','EMP002'),
    ('EMP004','EMP001'), ('EMP005','EMP004'),
    ('EMP006','EMP005'), ('EMP007','EMP005'),
    ('EMP008','EMP001'), ('EMP009','EMP008'),
    ('EMP010','EMP002')
);

-- Kepala departemen
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE nip = 'EMP001') WHERE code = 'DIR';
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE nip = 'EMP002') WHERE code = 'HRD';
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE nip = 'EMP004') WHERE code = 'IT';
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE nip = 'EMP008') WHERE code = 'FIN';
UPDATE departments SET head_employee_id = (SELECT id FROM employees WHERE nip = 'EMP002') WHERE code = 'OPS';

-- ---------------------------------------------------------------------
-- 6. USER & ROLE
--  PENTING: password_hash di bawah adalah PLACEHOLDER.
--  Jalankan scripts/hash-password.ts (dijelaskan di README) lalu UPDATE.
--  Password default rencana: Password123!
-- ---------------------------------------------------------------------
INSERT INTO users (employee_id, username, email, password_hash, must_change_password)
SELECT e.id, split_part(e.email, '@', 1), e.email, '$2b$12$PLACEHOLDER.GANTI.DENGAN.HASH.ASLI', true
FROM employees e;

-- Akun admin sistem (tanpa data pegawai)
INSERT INTO users (employee_id, username, email, password_hash, must_change_password)
VALUES (NULL, 'admin', 'admin@perusahaan.co.id', '$2b$12$PLACEHOLDER.GANTI.DENGAN.HASH.ASLI', true);

-- Semua pegawai = EMPLOYEE
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE r.code = 'EMPLOYEE' AND u.employee_id IS NOT NULL;

-- Atasan (SPV ke atas) = APPROVER
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN employees e  ON e.id = u.employee_id
JOIN positions p  ON p.id = e.position_id
CROSS JOIN roles r
WHERE r.code = 'APPROVER' AND p.level >= 2;

-- HRD level manajer = HR_APPROVER
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN employees e   ON e.id = u.employee_id
JOIN departments d ON d.id = e.department_id
JOIN positions p   ON p.id = e.position_id
CROSS JOIN roles r
WHERE r.code = 'HR_APPROVER' AND d.code = 'HRD' AND p.level >= 3;

-- Admin sistem + Manajer HRD = ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE r.code = 'ADMIN' AND u.username IN ('admin', 'joko');

-- ---------------------------------------------------------------------
-- 7. JENIS PERIZINAN
-- ---------------------------------------------------------------------
INSERT INTO leave_types
    (code, name, description, unit, deducts_quota, default_annual_quota, requires_attachment,
     gender_restriction, allow_half_day, allow_backdate, max_backdate_days, counts_working_days_only,
     color, icon, sort_order)
VALUES
    ('CUTI_TAHUNAN',     'Cuti Tahunan',        'Cuti tahunan yang memotong kuota 12 hari',                'DAY', true,  12, false, NULL,     true,  false, 0, true,  '#0EA5E9', 'sun',          1),
    ('SAKIT',            'Izin Sakit',          'Izin karena sakit, wajib surat dokter bila >= 2 hari',    'DAY', false, NULL, false, NULL,    false, true,  2, true,  '#EF4444', 'thermometer',  2),
    ('IZIN_TIDAK_MASUK', 'Izin Tidak Masuk',    'Izin keperluan pribadi mendadak, maksimal 1 hari',        'DAY', false, NULL, false, NULL,    true,  true,  1, true,  '#F59E0B', 'alert-circle', 3),
    ('MENIKAH',          'Izin Pernikahan',     'Izin menikah 3 hari kerja, sekali selama masa kerja',     'DAY', false, NULL, true,  NULL,    false, false, 0, true,  '#EC4899', 'heart',        4),
    ('MELAHIRKAN',       'Izin Melahirkan',     'Cuti melahirkan 90 hari kalender',                        'DAY', false, NULL, true,  'FEMALE', false, false, 0, false, '#8B5CF6', 'baby',         5),
    ('WFA',              'Work From Anywhere',  'Bekerja dari luar kantor, maksimal 2 hari per minggu',    'DAY', false, NULL, false, NULL,    false, false, 0, true,  '#10B981', 'laptop',       6);

-- Batasan siapa yang boleh mengajukan (contoh: WFA tidak untuk PROBATION & OUTSOURCE)
INSERT INTO leave_type_eligibilities (leave_type_id, employment_status, is_allowed, note)
SELECT lt.id, s.status::employment_status_enum, false, 'Belum berhak mengajukan WFA'
FROM leave_types lt, (VALUES ('PROBATION'), ('OUTSOURCE'), ('INTERN')) AS s(status)
WHERE lt.code = 'WFA';

INSERT INTO leave_type_eligibilities (leave_type_id, employment_status, is_allowed, note)
SELECT lt.id, s.status::employment_status_enum, false, 'Cuti tahunan hanya untuk karyawan tetap & kontrak'
FROM leave_types lt, (VALUES ('PROBATION'), ('INTERN')) AS s(status)
WHERE lt.code = 'CUTI_TAHUNAN';

-- ---------------------------------------------------------------------
-- 8. KEBIJAKAN + ATURAN DUMMY PER JENIS PERIZINAN
-- ---------------------------------------------------------------------
INSERT INTO leave_policies
    (leave_type_id, name, version, effective_from, overall_deadline_hours,
     deadline_uses_working_hours, on_deadline_action, auto_decision_requires_rule_pass, notes)
SELECT lt.id, v.name, 1, '2026-01-01'::date, v.deadline_hours,
       true, v.on_deadline::escalation_action_enum, true, v.notes
FROM (VALUES
    ('CUTI_TAHUNAN',     'Kebijakan Cuti Tahunan 2026',      48, 'AUTO_APPROVE', 'Auto approve bila seluruh aturan terpenuhi setelah 48 jam kerja tanpa tindakan'),
    ('SAKIT',            'Kebijakan Izin Sakit 2026',        12, 'AUTO_APPROVE', 'Batas waktu pendek karena sifatnya mendesak'),
    ('IZIN_TIDAK_MASUK', 'Kebijakan Izin Tidak Masuk 2026',   8, 'AUTO_APPROVE', 'Auto reject bila melanggar kuota bulanan'),
    ('MENIKAH',          'Kebijakan Izin Pernikahan 2026',   72, 'AUTO_APPROVE', 'Pengajuan jauh hari, batas waktu longgar'),
    ('MELAHIRKAN',       'Kebijakan Izin Melahirkan 2026',   72, 'AUTO_APPROVE', 'Wajib lampiran surat dokter / HPL'),
    ('WFA',              'Kebijakan WFA 2026',                4, 'AUTO_APPROVE', 'Keputusan cepat, maksimal 4 jam kerja')
) AS v(type_code, name, deadline_hours, on_deadline, notes)
JOIN leave_types lt ON lt.code = v.type_code;

-- ---- Aturan: CUTI TAHUNAN ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'CUTI_TAHUNAN'
CROSS JOIN (VALUES
    ('CT_MASA_KERJA',   'MIN_EMPLOYMENT_MONTHS', '{"months": 12}',                                  'BLOCK_SUBMIT',     'Cuti tahunan baru dapat diambil setelah masa kerja {{months}} bulan. Masa kerja Anda saat ini {{actual_months}} bulan.', 10),
    ('CT_KUOTA',        'QUOTA_SUFFICIENT',      '{}',                                              'BLOCK_SUBMIT',     'Sisa kuota cuti tahunan Anda {{balance}} hari, tidak mencukupi untuk pengajuan {{requested_days}} hari.', 20),
    ('CT_TIDAK_TUMPANG','NO_OVERLAP_REQUEST',    '{}',                                              'BLOCK_SUBMIT',     'Tanggal yang dipilih bertumpuk dengan pengajuan lain yang masih aktif ({{conflict_request_number}}).', 30),
    ('CT_MAKS_PER_AJU', 'MAX_DAYS_PER_REQUEST',  '{"max_days": 5}',                                 'REQUIRE_APPROVAL', 'Pengajuan {{requested_days}} hari melebihi batas {{max_days}} hari per pengajuan, wajib persetujuan manual.', 40),
    ('CT_H3',           'MIN_NOTICE_DAYS',       '{"min_notice_days": 3, "count": "WORKING"}',      'REQUIRE_APPROVAL', 'Pengajuan kurang dari {{min_notice_days}} hari kerja sebelum tanggal cuti, wajib persetujuan manual.', 50),
    ('CT_TUTUP_BUKU',   'BLACKOUT_PERIOD',       '{"ranges": [{"from": "2026-12-20", "to": "2026-12-31"}]}', 'AUTO_REJECT', 'Tanggal {{violating_dates}} berada dalam periode tutup buku ({{blackout_range}}) sehingga cuti tidak dapat disetujui.', 60),
    ('CT_KAPASITAS_TIM','MAX_CONCURRENT_TEAM_ON_LEAVE', '{"max_people": 2, "scope": "DEPARTMENT"}', 'REQUIRE_APPROVAL', 'Sudah ada {{current_count}} rekan satu departemen yang cuti pada tanggal tersebut (batas {{max_people}} orang).', 70)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---- Aturan: IZIN SAKIT ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'SAKIT'
CROSS JOIN (VALUES
    ('SK_MUNDUR',      'MAX_BACKDATE_DAYS',              '{"max_backdate_days": 2}',        'BLOCK_SUBMIT',     'Izin sakit hanya dapat diajukan mundur maksimal {{max_backdate_days}} hari.', 10),
    ('SK_SURAT_DOKTER','ATTACHMENT_REQUIRED_IF_DAYS_GTE','{"days": 2, "min_files": 1}',     'AUTO_REJECT',      'Izin sakit {{requested_days}} hari wajib melampirkan surat dokter.', 20),
    ('SK_MAKS_TAHUN',  'MAX_PER_YEAR',                   '{"max_days": 14}',                'REQUIRE_APPROVAL', 'Total izin sakit Anda tahun ini {{used_days}} hari, melebihi batas {{max_days}} hari sehingga wajib persetujuan HRD.', 30),
    ('SK_MAKS_PER_AJU','MAX_DAYS_PER_REQUEST',           '{"max_days": 14}',                'REQUIRE_APPROVAL', 'Izin sakit lebih dari {{max_days}} hari harus melalui verifikasi HRD.', 40)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---- Aturan: IZIN TIDAK MASUK KERJA ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'IZIN_TIDAK_MASUK'
CROSS JOIN (VALUES
    ('IT_MAKS_1HARI',  'MAX_DAYS_PER_REQUEST',    '{"max_days": 1}',                          'BLOCK_SUBMIT', 'Izin tidak masuk kerja maksimal {{max_days}} hari per pengajuan.', 10),
    ('IT_MAKS_BULAN',  'MAX_REQUESTS_PER_PERIOD', '{"max_requests": 2, "period": "MONTH"}',   'AUTO_REJECT',  'Anda sudah mengajukan izin tidak masuk {{current_count}} kali bulan ini (maksimal {{max_requests}} kali).', 20),
    ('IT_H1',          'MIN_NOTICE_DAYS',         '{"min_notice_days": 1, "count": "WORKING"}','AUTO_REJECT', 'Izin tidak masuk harus diajukan minimal {{min_notice_days}} hari kerja sebelumnya.', 30),
    ('IT_MUNDUR',      'MAX_BACKDATE_DAYS',       '{"max_backdate_days": 1}',                 'REQUIRE_APPROVAL', 'Pengajuan mundur {{backdate_days}} hari memerlukan persetujuan atasan secara manual.', 40)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---- Aturan: IZIN PERNIKAHAN ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'MENIKAH'
CROSS JOIN (VALUES
    ('MN_SEKALI',      'ONCE_PER_EMPLOYMENT',   '{}',                                        'BLOCK_SUBMIT',     'Izin pernikahan hanya dapat diambil sekali selama masa kerja (sebelumnya: {{previous_request_number}}).', 10),
    ('MN_MAKS_3HARI',  'MAX_DAYS_PER_REQUEST',  '{"max_days": 3}',                           'BLOCK_SUBMIT',     'Izin pernikahan maksimal {{max_days}} hari kerja.', 20),
    ('MN_LAMPIRAN',    'ATTACHMENT_REQUIRED',   '{"min_files": 1}',                          'BLOCK_SUBMIT',     'Wajib melampirkan undangan atau surat keterangan menikah.', 30),
    ('MN_H14',         'MIN_NOTICE_DAYS',       '{"min_notice_days": 14, "count": "CALENDAR"}','REQUIRE_APPROVAL','Pengajuan kurang dari {{min_notice_days}} hari sebelum tanggal pernikahan, wajib persetujuan manual.', 40),
    ('MN_MASA_KERJA',  'MIN_EMPLOYMENT_MONTHS', '{"months": 6}',                             'REQUIRE_APPROVAL', 'Masa kerja kurang dari {{months}} bulan, perlu persetujuan HRD.', 50)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---- Aturan: IZIN MELAHIRKAN ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'MELAHIRKAN'
CROSS JOIN (VALUES
    ('ML_GENDER',      'GENDER_RESTRICTION',    '{"gender": "FEMALE"}',                       'BLOCK_SUBMIT',     'Izin melahirkan hanya dapat diajukan oleh pegawai perempuan.', 10),
    ('ML_LAMPIRAN',    'ATTACHMENT_REQUIRED',   '{"min_files": 1}',                           'BLOCK_SUBMIT',     'Wajib melampirkan surat keterangan dokter / taksiran HPL.', 20),
    ('ML_MAKS_90',     'MAX_DAYS_PER_REQUEST',  '{"max_days": 90}',                           'REQUIRE_APPROVAL', 'Pengajuan {{requested_days}} hari melebihi ketentuan {{max_days}} hari kalender.', 30),
    ('ML_H30',         'MIN_NOTICE_DAYS',       '{"min_notice_days": 30, "count": "CALENDAR"}','REQUIRE_APPROVAL','Sebaiknya diajukan {{min_notice_days}} hari sebelumnya, pengajuan ini perlu persetujuan manual.', 40),
    ('ML_MASA_KERJA',  'MIN_EMPLOYMENT_MONTHS', '{"months": 12}',                             'WARN_ONLY',        'Masa kerja kurang dari {{months}} bulan, HRD akan meninjau hak tunjangan terkait.', 50)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---- Aturan: WFA ----
INSERT INTO leave_policy_rules (policy_id, rule_code, rule_type, params, violation_action, message_template, evaluation_order)
SELECT p.id, v.rule_code, v.rule_type::rule_type_enum, v.params::jsonb,
       v.action::rule_violation_action_enum, v.msg, v.ord
FROM leave_policies p
JOIN leave_types lt ON lt.id = p.leave_type_id AND lt.code = 'WFA'
CROSS JOIN (VALUES
    ('WFA_STATUS',      'EMPLOYMENT_STATUS_ALLOWED',    '{"statuses": ["PERMANENT", "CONTRACT"]}',   'BLOCK_SUBMIT', 'WFA hanya untuk karyawan tetap dan kontrak. Status Anda: {{employment_status}}.', 10),
    ('WFA_MAKS_2_MINGGU','MAX_DAYS_PER_PERIOD',         '{"max_days": 2, "period": "WEEK"}',         'AUTO_REJECT',  'Kuota WFA {{max_days}} hari per minggu sudah terpakai {{current_days}} hari pada minggu tersebut.', 20),
    ('WFA_TIDAK_BERURUTAN','NO_CONSECUTIVE_DAYS',       '{"min_gap_working_days": 1}',               'AUTO_REJECT',  'WFA tidak boleh diambil pada hari kerja yang berurutan ({{violating_dates}}). Beri jeda minimal {{min_gap_working_days}} hari kerja.', 30),
    ('WFA_HARI_BOLEH',  'ALLOWED_WEEKDAYS',             '{"weekdays": [2, 3, 4]}',                   'AUTO_REJECT',  'WFA hanya diperbolehkan pada hari Selasa, Rabu, dan Kamis. Tanggal bermasalah: {{violating_dates}}.', 40),
    ('WFA_MAKS_PER_AJU','MAX_DAYS_PER_REQUEST',         '{"max_days": 1}',                           'BLOCK_SUBMIT', 'Satu pengajuan WFA maksimal {{max_days}} hari. Ajukan terpisah untuk tanggal lain.', 50),
    ('WFA_H1',          'MIN_NOTICE_DAYS',              '{"min_notice_days": 1, "count": "WORKING"}','AUTO_REJECT',  'Pengajuan WFA minimal {{min_notice_days}} hari kerja sebelumnya.', 60),
    ('WFA_KAPASITAS',   'MAX_CONCURRENT_TEAM_ON_LEAVE', '{"max_people": 3, "scope": "DEPARTMENT"}',  'REQUIRE_APPROVAL', 'Sudah ada {{current_count}} rekan satu tim yang WFA pada tanggal tersebut (batas {{max_people}} orang).', 70)
) AS v(rule_code, rule_type, params, action, msg, ord);

-- ---------------------------------------------------------------------
-- 9. ALUR APPROVAL BERTINGKAT (DUMMY)
-- ---------------------------------------------------------------------
INSERT INTO approval_workflows (code, name, description, leave_type_id, min_days, max_days, priority, effective_from)
VALUES
    ('WF_DEFAULT', 'Alur Default (semua jenis izin)', 'Atasan langsung, lanjut kepala divisi bila >= 3 hari', NULL, NULL, NULL, 100, '2026-01-01');

INSERT INTO approval_workflows (code, name, description, leave_type_id, min_days, max_days, priority, effective_from)
SELECT v.code, v.name, v.descr, lt.id, v.min_days, v.max_days, v.priority, '2026-01-01'::date
FROM (VALUES
    ('WF_WFA',        'Alur WFA',                'Cukup atasan langsung, SLA 4 jam kerja',                  'WFA',          NULL::numeric, NULL::numeric, 10),
    ('WF_SAKIT',      'Alur Izin Sakit',         'Atasan langsung, verifikasi HRD bila >= 3 hari',          'SAKIT',        NULL,          NULL,          20),
    ('WF_CUTI_PENDEK','Alur Cuti Tahunan <= 5 hari', 'Atasan langsung lalu kepala divisi',                  'CUTI_TAHUNAN', 0.5,           5,             20),
    ('WF_CUTI_PANJANG','Alur Cuti Tahunan > 5 hari', 'Bertingkat sampai direktur',                          'CUTI_TAHUNAN', 5.5,           NULL,          10),
    ('WF_MENIKAH',    'Alur Izin Pernikahan',    'Atasan langsung, kepala divisi, HRD',                     'MENIKAH',      NULL,          NULL,          20),
    ('WF_MELAHIRKAN', 'Alur Izin Melahirkan',    'Atasan langsung, kepala divisi, HRD, direktur',           'MELAHIRKAN',   NULL,          NULL,          20)
) AS v(code, name, descr, type_code, min_days, max_days, priority)
JOIN leave_types lt ON lt.code = v.type_code;

-- ---- Step: WF_DEFAULT ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approval_mode, condition_min_days,
     sla_hours, reminder_interval_minutes, reminder_max_count, reminder_channels, escalation_action)
SELECT w.id, v.ord, v.name, v.atype::approver_type_enum, 'ANY_ONE', v.min_days,
       v.sla, v.reminder, 5, '{EMAIL,TELEGRAM}'::notification_channel_enum[], v.esc::escalation_action_enum
FROM approval_workflows w
CROSS JOIN (VALUES
    (1, 'Atasan Langsung', 'DIRECT_MANAGER',  NULL::numeric, 8,  120, 'AUTO_APPROVE'),
    (2, 'Kepala Divisi',   'DEPARTMENT_HEAD', 3,             16, 120, 'AUTO_APPROVE')
) AS v(ord, name, atype, min_days, sla, reminder, esc)
WHERE w.code = 'WF_DEFAULT';

-- ---- Step: WF_WFA ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approval_mode,
     sla_hours, reminder_interval_minutes, reminder_max_count, reminder_channels, escalation_action)
SELECT w.id, 1, 'Atasan Langsung', 'DIRECT_MANAGER', 'ANY_ONE',
       4, 60, 3, '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'
FROM approval_workflows w WHERE w.code = 'WF_WFA';

-- ---- Step: WF_SAKIT ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approval_mode, condition_min_days,
     sla_hours, reminder_interval_minutes, reminder_max_count, reminder_channels, escalation_action)
SELECT w.id, v.ord, v.name, v.atype::approver_type_enum, 'ANY_ONE', v.min_days,
       v.sla, v.reminder, 4, '{EMAIL,TELEGRAM}'::notification_channel_enum[], v.esc::escalation_action_enum
FROM approval_workflows w
CROSS JOIN (VALUES
    (1, 'Atasan Langsung', 'DIRECT_MANAGER', NULL::numeric, 12, 120, 'AUTO_APPROVE'),
    (2, 'Verifikasi HRD',  'HR_DEPARTMENT',  3,             24, 180, 'AUTO_APPROVE')
) AS v(ord, name, atype, min_days, sla, reminder, esc)
WHERE w.code = 'WF_SAKIT';

-- ---- Step: WF_CUTI_PENDEK ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approval_mode,
     sla_hours, reminder_interval_minutes, reminder_max_count, reminder_channels, escalation_action)
SELECT w.id, v.ord, v.name, v.atype::approver_type_enum, 'ANY_ONE',
       v.sla, v.reminder, 5, '{EMAIL,TELEGRAM}'::notification_channel_enum[], v.esc::escalation_action_enum
FROM approval_workflows w
CROSS JOIN (VALUES
    (1, 'Atasan Langsung', 'DIRECT_MANAGER',  8,  120, 'AUTO_APPROVE'),
    (2, 'Kepala Divisi',   'DEPARTMENT_HEAD', 16, 120, 'AUTO_APPROVE')
) AS v(ord, name, atype, sla, reminder, esc)
WHERE w.code = 'WF_CUTI_PENDEK';

-- ---- Step: WF_CUTI_PANJANG ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approver_role_id, approver_position_level,
     approval_mode, sla_hours, reminder_interval_minutes, reminder_max_count,
     reminder_channels, escalation_action)
SELECT w.id, 1, 'Atasan Langsung', 'DIRECT_MANAGER'::approver_type_enum, NULL::uuid, NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 8, 120, 5,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_CUTI_PANJANG'
UNION ALL
SELECT w.id, 2, 'Kepala Divisi', 'DEPARTMENT_HEAD'::approver_type_enum, NULL::uuid, NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 16, 120, 5,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_CUTI_PANJANG'
UNION ALL
SELECT w.id, 3, 'HRD', 'ROLE'::approver_type_enum,
       (SELECT id FROM roles WHERE code = 'HR_APPROVER'), NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 24, 180, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_CUTI_PANJANG'
UNION ALL
SELECT w.id, 4, 'Direktur', 'POSITION_LEVEL'::approver_type_enum, NULL::uuid, 5::smallint,
       'ANY_ONE'::approval_mode_enum, 24, 240, 3,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_CUTI_PANJANG';

-- ---- Step: WF_MENIKAH ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approver_role_id, approval_mode,
     sla_hours, reminder_interval_minutes, reminder_max_count, reminder_channels, escalation_action)
SELECT w.id, 1, 'Atasan Langsung', 'DIRECT_MANAGER'::approver_type_enum, NULL::uuid,
       'ANY_ONE'::approval_mode_enum, 16, 180, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MENIKAH'
UNION ALL
SELECT w.id, 2, 'Kepala Divisi', 'DEPARTMENT_HEAD'::approver_type_enum, NULL::uuid,
       'ANY_ONE'::approval_mode_enum, 24, 240, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MENIKAH'
UNION ALL
SELECT w.id, 3, 'HRD', 'ROLE'::approver_type_enum,
       (SELECT id FROM roles WHERE code = 'HR_APPROVER'),
       'ANY_ONE'::approval_mode_enum, 24, 240, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MENIKAH';

-- ---- Step: WF_MELAHIRKAN ----
INSERT INTO approval_workflow_steps
    (workflow_id, step_order, name, approver_type, approver_role_id, approver_position_level,
     approval_mode, sla_hours, reminder_interval_minutes, reminder_max_count,
     reminder_channels, escalation_action)
SELECT w.id, 1, 'Atasan Langsung', 'DIRECT_MANAGER'::approver_type_enum, NULL::uuid, NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 16, 180, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MELAHIRKAN'
UNION ALL
SELECT w.id, 2, 'Kepala Divisi', 'DEPARTMENT_HEAD'::approver_type_enum, NULL::uuid, NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 24, 240, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MELAHIRKAN'
UNION ALL
SELECT w.id, 3, 'HRD', 'ROLE'::approver_type_enum,
       (SELECT id FROM roles WHERE code = 'HR_APPROVER'), NULL::smallint,
       'ANY_ONE'::approval_mode_enum, 24, 240, 4,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MELAHIRKAN'
UNION ALL
SELECT w.id, 4, 'Direktur', 'POSITION_LEVEL'::approver_type_enum, NULL::uuid, 5::smallint,
       'ANY_ONE'::approval_mode_enum, 48, 480, 3,
       '{EMAIL,TELEGRAM}'::notification_channel_enum[], 'AUTO_APPROVE'::escalation_action_enum
FROM approval_workflows w WHERE w.code = 'WF_MELAHIRKAN';

-- ---------------------------------------------------------------------
-- 10. KUOTA CUTI TAHUNAN 2026
-- ---------------------------------------------------------------------
INSERT INTO leave_quotas (employee_id, leave_type_id, period_year, allocated)
SELECT e.id, lt.id, 2026, lt.default_annual_quota
FROM employees e
CROSS JOIN leave_types lt
WHERE lt.code = 'CUTI_TAHUNAN'
  AND e.employment_status IN ('PERMANENT', 'CONTRACT');

INSERT INTO leave_quota_ledger (quota_id, txn_type, amount, balance_after, note)
SELECT q.id, 'ALLOCATION', q.allocated, q.balance, 'Alokasi kuota awal tahun 2026'
FROM leave_quotas q;

-- ---------------------------------------------------------------------
-- 11. VARIABEL TEMPLATE NOTIFIKASI (pembantu UI admin)
-- ---------------------------------------------------------------------
INSERT INTO notification_template_variables (variable_key, description, example_value, sort_order) VALUES
    ('{{employee_name}}',    'Nama pegawai pemohon',                   'Budi Santoso', 1),
    ('{{employee_nip}}',     'NIP pemohon',                            'EMP006', 2),
    ('{{department_name}}',  'Departemen pemohon',                     'Teknologi Informasi', 3),
    ('{{leave_type_name}}',  'Nama jenis perizinan',                   'Cuti Tahunan', 4),
    ('{{request_number}}',   'Nomor pengajuan',                        'SAPP/2026/09/000123', 5),
    ('{{start_date}}',       'Tanggal mulai',                          '21 September 2026', 6),
    ('{{end_date}}',         'Tanggal selesai',                        '23 September 2026', 7),
    ('{{total_days}}',       'Jumlah hari',                            '3', 8),
    ('{{reason}}',           'Alasan pengajuan',                       'Acara keluarga', 9),
    ('{{approver_name}}',    'Nama approver tujuan',                   'Andi Nugroho', 10),
    ('{{step_name}}',        'Nama tahap approval',                    'Atasan Langsung', 11),
    ('{{step_order}}',       'Urutan tahap',                           '1', 12),
    ('{{due_at}}',           'Batas waktu tindakan approver',          '15 Sep 2026 15:00', 13),
    ('{{remaining_time}}',   'Sisa waktu sebelum keputusan otomatis',  '3 jam 20 menit', 14),
    ('{{reminder_count}}',   'Pengingat ke-berapa',                    '2', 15),
    ('{{action_url}}',       'Tautan langsung ke halaman approval',    'http://localhost:3000/approval/xxx', 16),
    ('{{decision}}',         'Hasil keputusan (DISETUJUI/DITOLAK)',    'DISETUJUI', 17),
    ('{{decision_reason}}',  'Alasan keputusan',                       'Seluruh ketentuan terpenuhi', 18),
    ('{{decided_by}}',       'Pemberi keputusan (nama / SISTEM)',      'SISTEM', 19),
    ('{{quota_balance}}',    'Sisa kuota setelah pengajuan',           '9', 20),
    ('{{app_name}}',         'Nama aplikasi',                          'Sistem Perizinan Pegawai', 21);

-- ---------------------------------------------------------------------
-- 12. TEMPLATE NOTIFIKASI DEFAULT
-- ---------------------------------------------------------------------
INSERT INTO notification_templates
    (code, name, event_type, channel, target_audience, subject_template, body_template, parse_mode, is_default)
VALUES
-- === Untuk APPROVER ===
('TPL_TASK_ASSIGNED_EMAIL', 'Tugas Approval Baru (Email)', 'APPROVAL_TASK_ASSIGNED', 'EMAIL', 'APPROVER',
 '[{{app_name}}] Persetujuan dibutuhkan: {{leave_type_name}} - {{employee_name}}',
 E'Halo {{approver_name}},\n\nAda pengajuan perizinan yang menunggu persetujuan Anda pada tahap "{{step_name}}".\n\nNomor    : {{request_number}}\nPemohon  : {{employee_name}} ({{department_name}})\nJenis    : {{leave_type_name}}\nTanggal  : {{start_date}} s/d {{end_date}} ({{total_days}} hari)\nAlasan   : {{reason}}\n\nBatas waktu tindakan: {{due_at}}\nJika tidak ada tindakan sampai batas waktu, sistem akan memproses pengajuan ini secara otomatis sesuai aturan yang berlaku.\n\nProses di sini: {{action_url}}',
 'TEXT', true),

('TPL_TASK_ASSIGNED_TG', 'Tugas Approval Baru (Telegram)', 'APPROVAL_TASK_ASSIGNED', 'TELEGRAM', 'APPROVER',
 NULL,
 E'<b>🔔 Persetujuan Dibutuhkan</b>\n\n<b>{{leave_type_name}}</b>\nPemohon: {{employee_name}}\nTanggal: {{start_date}} - {{end_date}} ({{total_days}} hari)\nTahap: {{step_name}}\nBatas waktu: {{due_at}}\n\n<a href="{{action_url}}">Buka halaman approval</a>',
 'HTML', true),

('TPL_REMINDER_EMAIL', 'Pengingat Approval (Email)', 'APPROVAL_REMINDER', 'EMAIL', 'APPROVER',
 '[Pengingat #{{reminder_count}}] {{request_number}} menunggu persetujuan Anda',
 E'Halo {{approver_name}},\n\nPengajuan {{request_number}} atas nama {{employee_name}} masih menunggu persetujuan Anda.\n\nJenis   : {{leave_type_name}}\nTanggal : {{start_date}} s/d {{end_date}}\nSisa waktu: {{remaining_time}}\n\nBila batas waktu terlewati, sistem akan mengambil keputusan otomatis sesuai aturan.\n\nProses di sini: {{action_url}}',
 'TEXT', true),

('TPL_REMINDER_TG', 'Pengingat Approval (Telegram)', 'APPROVAL_REMINDER', 'TELEGRAM', 'APPROVER',
 NULL,
 E'<b>⏰ Pengingat #{{reminder_count}}</b>\n\n{{request_number}} - {{employee_name}}\n{{leave_type_name}} | {{start_date}} - {{end_date}}\n\nSisa waktu: <b>{{remaining_time}}</b>\n<a href="{{action_url}}">Proses sekarang</a>',
 'HTML', true),

('TPL_ESCALATED_EMAIL', 'Eskalasi Approval (Email)', 'APPROVAL_ESCALATED', 'EMAIL', 'APPROVER',
 '[Eskalasi] {{request_number}} dilanjutkan ke tahap berikutnya',
 E'Pengajuan {{request_number}} ({{employee_name}}) telah melewati batas waktu pada tahap "{{step_name}}" dan dieskalasi secara otomatis.\n\nDetail: {{action_url}}',
 'TEXT', true),

-- === Untuk PEMOHON ===
('TPL_SUBMITTED_EMAIL', 'Pengajuan Terkirim (Email)', 'REQUEST_SUBMITTED', 'EMAIL', 'REQUESTER',
 '[{{app_name}}] Pengajuan {{request_number}} terkirim',
 E'Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda telah terkirim dan sedang diproses.\n\nNomor   : {{request_number}}\nTanggal : {{start_date}} s/d {{end_date}} ({{total_days}} hari)\nTahap saat ini: {{step_name}} ({{approver_name}})\n\nPantau status: {{action_url}}',
 'TEXT', true),

('TPL_STEP_APPROVED_TG', 'Tahap Disetujui (Telegram)', 'STEP_APPROVED', 'TELEGRAM', 'REQUESTER',
 NULL,
 E'✅ <b>Tahap {{step_order}} disetujui</b>\n\n{{request_number}} - {{leave_type_name}}\nDisetujui oleh: {{decided_by}} ({{step_name}})\n\nMenunggu tahap berikutnya.',
 'HTML', true),

('TPL_APPROVED_EMAIL', 'Pengajuan Disetujui (Email)', 'REQUEST_APPROVED', 'EMAIL', 'REQUESTER',
 '[{{app_name}}] Pengajuan {{request_number}} DISETUJUI',
 E'Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ({{start_date}} s/d {{end_date}}) telah DISETUJUI.\n\nDiputuskan oleh : {{decided_by}}\nKeterangan      : {{decision_reason}}\nSisa kuota      : {{quota_balance}} hari\n\nRiwayat lengkap: {{action_url}}',
 'TEXT', true),

('TPL_APPROVED_TG', 'Pengajuan Disetujui (Telegram)', 'REQUEST_APPROVED', 'TELEGRAM', 'REQUESTER',
 NULL,
 E'✅ <b>Pengajuan Disetujui</b>\n\n{{request_number}} - {{leave_type_name}}\n{{start_date}} s/d {{end_date}} ({{total_days}} hari)\nOleh: {{decided_by}}\n\n<a href="{{action_url}}">Lihat riwayat approval</a>',
 'HTML', true),

('TPL_REJECTED_EMAIL', 'Pengajuan Ditolak (Email)', 'REQUEST_REJECTED', 'EMAIL', 'REQUESTER',
 '[{{app_name}}] Pengajuan {{request_number}} DITOLAK',
 E'Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ({{start_date}} s/d {{end_date}}) DITOLAK.\n\nDiputuskan oleh : {{decided_by}}\nAlasan          : {{decision_reason}}\n\nRiwayat lengkap: {{action_url}}',
 'TEXT', true),

('TPL_REJECTED_TG', 'Pengajuan Ditolak (Telegram)', 'REQUEST_REJECTED', 'TELEGRAM', 'REQUESTER',
 NULL,
 E'❌ <b>Pengajuan Ditolak</b>\n\n{{request_number}} - {{leave_type_name}}\nAlasan: {{decision_reason}}\n\n<a href="{{action_url}}">Lihat detail</a>',
 'HTML', true),

('TPL_AUTO_APPROVED_EMAIL', 'Disetujui Otomatis (Email)', 'REQUEST_AUTO_APPROVED', 'EMAIL', 'REQUESTER',
 '[{{app_name}}] Pengajuan {{request_number}} disetujui otomatis',
 E'Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda disetujui secara OTOMATIS oleh sistem.\n\nAlasan: {{decision_reason}}\nTanggal: {{start_date}} s/d {{end_date}} ({{total_days}} hari)\n\nRiwayat lengkap: {{action_url}}',
 'TEXT', true),

('TPL_AUTO_REJECTED_EMAIL', 'Ditolak Otomatis (Email)', 'REQUEST_AUTO_REJECTED', 'EMAIL', 'REQUESTER',
 '[{{app_name}}] Pengajuan {{request_number}} ditolak otomatis',
 E'Halo {{employee_name}},\n\nPengajuan {{leave_type_name}} Anda ditolak secara OTOMATIS oleh sistem karena tidak memenuhi ketentuan yang berlaku.\n\nAlasan: {{decision_reason}}\n\nRiwayat lengkap: {{action_url}}',
 'TEXT', true),

-- === Untuk ADMIN ===
('TPL_ESCALATION_ADMIN_EMAIL', 'Notifikasi Eskalasi ke Admin', 'APPROVAL_ESCALATED', 'EMAIL', 'ADMIN',
 '[{{app_name}}] Eskalasi otomatis pada {{request_number}}',
 E'Pengajuan {{request_number}} ({{employee_name}}) melewati SLA pada tahap "{{step_name}}" dan diproses otomatis oleh sistem.\n\nDetail: {{action_url}}',
 'TEXT', true);

COMMIT;

-- =====================================================================
-- LANGKAH MANUAL SETELAH SEED
-- ---------------------------------------------------------------------
-- 1) Buat hash password (lihat README), lalu:
--      UPDATE users SET password_hash = '<hash_bcrypt_asli>';
-- 2) Isi telegram_chat_id tiap pegawai setelah mereka /start ke bot:
--      UPDATE employees SET telegram_chat_id = '123456789' WHERE nip = 'EMP006';
-- =====================================================================
