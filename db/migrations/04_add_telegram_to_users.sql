-- Migration: 04_add_telegram_to_users.sql
-- Description: Allow users without employee record (like admin/system users) to link Telegram account

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS telegram_chat_id varchar(50),
  ADD COLUMN IF NOT EXISTS telegram_username varchar(60);

-- Sinkronkan data telegram_chat_id yang sudah ada di employees ke users
UPDATE auth.users u
SET telegram_chat_id = e.telegram_chat_id,
    telegram_username = e.telegram_username
FROM org.employees e
WHERE u.employee_id = e.id
  AND e.telegram_chat_id IS NOT NULL;
