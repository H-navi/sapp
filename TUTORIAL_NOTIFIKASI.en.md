# Notification Implementation & Configuration Guide (Email & Telegram)

> 🌐 **Language / Bahasa:** [🇬🇧 English](TUTORIAL_NOTIFIKASI.en.md) · [🇮🇩 Bahasa Indonesia](TUTORIAL_NOTIFIKASI.md)

This document provides step-by-step instructions on configuring, linking, and testing automated multi-channel notifications in the **AutoLeave (SAPP) Employee Management System**, covering both **Email (Gmail SMTP)** and the **Telegram Bot**.

---

## 1. Notification Architecture

The notification engine is built around a **reliable asynchronous queue** and **smart prioritization**:
* **Asynchronous Queue (`notifications`)**: Notifications are automatically queued in the PostgreSQL database whenever business events take place (new submissions, approval task routing, SLA reminder deadlines, final leave decisions).
* **Scheduled Background Dispatcher**: Periodically processed every 2 minutes by a Nitro background task (`notification:dispatch`) protected by PostgreSQL session-level *Advisory Locks* to prevent duplicate execution across worker instances.
* **Safe Simulation Mode (Dev Fallback)**: If notification credentials are not yet configured in `.env`, the application **will not crash**. The dispatcher logs outgoing payloads to the server console and safely marks delivery as simulated.
* **Quiet Hours Bypass**: High-priority final decision notifications (`REQUEST_APPROVED`, `REQUEST_REJECTED`, etc.) are delivered immediately without being deferred by employee quiet hours.

---

## 2. Email Configuration (Default: Gmail SMTP)

Email delivery utilizes standard SMTP with responsive HTML enterprise layouts. For personal Gmail accounts and Google Workspace, Google mandates using a **16-character App Password** with 2-Step Verification enabled.

### Steps to Generate a Gmail App Password:
1. **Open Google Account Security**:
   - Navigate to [Google Account Security](https://myaccount.google.com/security).
   - Ensure you are signed in with the sender account (e.g., `notifications@company.com`).
2. **Enable 2-Step Verification**:
   - If not already enabled, click **2-Step Verification** and complete the verification steps.
3. **Generate an App Password**:
   - In the Google Account search bar at the top, type **"App Passwords"** (or go directly to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
   - In the app name input, enter: `AutoLeave Notification System`.
   - Click **Create**.
   - Google will display a **16-character randomized password** (e.g., `abcd efgh ijkl mnop`).
   - Copy this 16-character string without spaces.

### Updating Your `.env` File:
Open `.env` in your project root and configure the SMTP parameters:

```env
# =====================================================================
# SMTP EMAIL CONFIGURATION (GMAIL)
# =====================================================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your_email_address@gmail.com"
SMTP_PASSWORD="abcdefghijklmnop"
SMTP_FROM="AutoLeave System <your_email_address@gmail.com>"
```

> [!TIP]
> **Local Sandbox Testing (Mailtrap):**
> If you prefer not to deliver real emails to actual user inboxes during local development, you can use [Mailtrap](https://mailtrap.io):
> ```env
> SMTP_HOST="sandbox.smtp.mailtrap.io"
> SMTP_PORT=2525
> SMTP_USER="your_mailtrap_user"
> SMTP_PASSWORD="your_mailtrap_password"
> SMTP_FROM="AutoLeave System <no-reply@company.com>"
> ```

---

## 3. Telegram Bot Configuration

Telegram notifications are delivered instantly to personal chats with employees and approvers via an official Telegram Bot.

### Steps to Create a Bot with BotFather:
1. Open the Telegram app on desktop or mobile.
2. Search for the verified official **`@BotFather`** account or open [t.me/BotFather](https://t.me/BotFather).
3. Click **Start** or send the command:
   ```text
   /newbot
   ```
4. Enter a user-friendly **Bot Name**, for example:
   ```text
   AutoLeave Notification Bot
   ```
5. Enter a unique **Bot Username** (must end with `bot`), for example:
   ```text
   autoleave_company_notif_bot
   ```
6. `@BotFather` will respond with an **HTTP API Token** (format: `7123456789:AAFn9X...`).

### Updating Your `.env` File:
Add the token and username to `.env`:

```env
# =====================================================================
# TELEGRAM BOT CONFIGURATION
# =====================================================================
TELEGRAM_BOT_TOKEN="7123456789:AAFn9X..."
TELEGRAM_BOT_USERNAME="autoleave_company_notif_bot"
```

---

## 4. How Employees & Approvers Link Telegram Accounts

For leave alerts to reach an employee's personal Telegram, they must complete a **one-time linking procedure**:

1. **Navigate to the Profile Page**:
   - Sign in to the AutoLeave web application.
   - Go to the **Profile** menu (`/profil`).
2. **Click "Connect Telegram"**:
   - In the **Telegram Bot Notifications** card, click the **Connect to Telegram** button.
   - A modal dialog opens displaying a direct deep link button **Open @bot in Telegram** as well as a manual fallback command `/start <token>`.
3. **Start the Bot in Telegram**:
   - When the link opens in Telegram, press the **Start** button at the bottom of the chat.
   - The bot responds instantly:
     > *"✅ Hello, [Employee Name]! Your Telegram account has been linked to the AutoLeave System."*
   - In the web app, the status badge automatically switches to **Connected to Telegram** and displays your unique Chat ID.
4. **Configure Quiet Hours**:
   - On the same Profile page, employees can set quiet hours (e.g., `21:00` to `06:00`) to defer routine reminders until office hours.

---

## 5. Testing & Monitoring Notifications

### Live Preview & Test Sending in Admin Dashboard
1. Navigate to **Admin** -> **Notification Templates** (`/admin/notifikasi`).
2. Select any template (e.g., `New Approval Task (Email)` or `New Approval Task (Telegram)`).
3. The right-hand pane provides a **Live Preview**:
   - HTML email preview with brand styling, mock data, and actionable buttons.
   - Telegram preview formatted as a dark chat bubble with bold text and emojis.
4. Click **"Send Test to Me"**:
   - The system immediately dispatches a real test message to the administrator's email or linked Telegram chat.
   - If Telegram is not yet linked, a friendly prompt will guide you to link it first in `/profil`.

### Monitoring the Queue & Delivery Logs
1. Navigate to **Admin** -> **Queue Logs** (`/admin/notifikasi/log`).
2. Review 24-hour delivery metrics:
   - **Total Messages**, **Successfully Delivered**, **Queued**, and **Failed**.
   - Detailed audit log entries showing status (`QUEUED`, `SENDING`, `SENT`, `FAILED`).
   - Click **Details** to inspect message body, delivery timestamp, and provider error codes.
   - Click **Retry** to immediately re-attempt delivery for failed notifications.

---

## 6. Troubleshooting & FAQ

### Q: Email delivery fails with `535 5.7.8 Username and Password not accepted`?
* **Cause**: You entered your standard Google account password instead of an App Password, or 2-Step Verification is disabled.
* **Resolution**: Generate a 16-character **App Password** in Google Security Settings and assign it to `SMTP_PASSWORD`.

### Q: Telegram delivery fails with `BOT_BLOCKED`?
* **Cause**: The user blocked or deleted the chat with the bot in their Telegram app.
* **System Handling**: The dispatcher detects HTTP 403 Forbidden, prevents retries to avoid queue blockage, and removes the user's `telegram_chat_id`. The user can re-link at any time from their Profile page.

### Q: Why do emails end up in the Spam / Junk folder?
* **Cause**: When sending from a newly configured address without domain SPF/DKIM records during local testing, email providers may categorize automated emails as promotions or spam.
* **Resolution**: Open the Spam folder, open the message, and click **"Not Spam"**.

### Q: Where are default system templates stored?
* All default templates are stored in the database table `notifications.notification_templates`.
* If a template is modified and you wish to restore the original system defaults, open the template editor at `/admin/notifikasi/[id]` and click **"Restore Defaults"**.

---

## 📖 Related Links

* **[Panduan Notifikasi (Bahasa Indonesia)](TUTORIAL_NOTIFIKASI.md)**: Indonesian version of this guide.
* **[README English Version](README.en.md)**: Main project documentation.
* **[Release Checklist](RELEASE_CHECKLIST.md)**: Pre-flight checks and testing verification.
