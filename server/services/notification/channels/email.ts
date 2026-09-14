import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

export interface SendEmailInput {
  to: string
  subject: string
  bodyHtml: string
  bodyText?: string
  actionUrl?: string
  actionText?: string
}

export interface SendEmailResult {
  success: boolean
  messageId: string
  simulated?: boolean
}

let cachedTransporterKey = ''
let cachedTransporter: nodemailer.Transporter | null = null

function getTransporter(): { transporter: nodemailer.Transporter | null; isConfigured: boolean; fromAddress: string } {
  try {
    dotenv.config({ override: true })
  } catch {}

  let host = (process.env.SMTP_HOST || '').trim()
  if (host === 'smptp.gmail.com') host = 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const user = (process.env.SMTP_USER || '').trim()
  const rawPass = process.env.SMTP_PASSWORD || ''
  const pass = rawPass.replace(/\s+/g, '')
  const fromAddress = process.env.SMTP_FROM || `Sistem Perizinan <${user || 'no-reply@perusahaan.co.id'}>`

  const isConfigured = Boolean(host && user && pass)

  if (!isConfigured) {
    return { transporter: null, isConfigured: false, fromAddress }
  }

  const currentKey = `${host}:${port}:${user}:${pass}`
  if (!cachedTransporter || cachedTransporterKey !== currentKey) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })
    cachedTransporterKey = currentKey
  }

  return { transporter: cachedTransporter, isConfigured: true, fromAddress }
}

/**
 * Membungkus konten email dalam template HTML responsif perusahaan yang rapi.
 */
function wrapHtmlLayout(content: string, actionUrl?: string, actionText = 'Buka Aplikasi'): string {
  const formattedContent = content
    .split('\n\n')
    .map((paragraph) => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #334155;">${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')

  const actionButton = actionUrl
    ? `
    <div style="margin: 28px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
        ${actionText}
      </a>
    </div>
  `
    : ''

  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notifikasi Sistem Perizinan</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <div style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">Sistem Perizinan Pegawai</div>
                    <div style="font-size: 12px; opacity: 0.85; margin-top: 2px;">Notifikasi Otomatis Kepegawaian</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; font-size: 14px;">
              ${formattedContent}
              ${actionButton}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
              Email ini dikirimkan secara otomatis oleh Sistem Perizinan Pegawai.<br>
              Mohon untuk tidak membalas langsung ke alamat email ini.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export async function sendEmailNotification(input: SendEmailInput): Promise<SendEmailResult> {
  const { transporter, isConfigured, fromAddress } = getTransporter()

  const html = wrapHtmlLayout(input.bodyHtml, input.actionUrl, input.actionText)
  const text = input.bodyText || input.bodyHtml.replace(/<[^>]*>/g, '')

  if (!isConfigured || !transporter) {
    // Mode Simulasi (dev / tanpa SMTP)
    const simulatedId = `sim-email-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    console.info(`[EMAIL SIMULASI] Kepada: ${input.to} | Subjek: ${input.subject} | ID: ${simulatedId}`)
    return {
      success: true,
      messageId: simulatedId,
      simulated: true,
    }
  }

  const info = await transporter.sendMail({
    from: fromAddress,
    to: input.to,
    subject: input.subject,
    text,
    html,
  })

  return {
    success: true,
    messageId: info.messageId,
  }
}
