import nodemailer from 'nodemailer';

interface NewUserRegistrationParams {
  fullName: string;
  email: string;
  invite?: string | null;
  timestamp?: string;
}

export async function notifyAdminOnNewRegistration(params: NewUserRegistrationParams) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"Digisoft-CRM" <${smtpUser || 'notifications@digisoft.com'}>`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!adminEmail) {
    console.warn('[AdminNotifier] ADMIN_NOTIFICATION_EMAIL is not set in .env.local. Notification skipped.');
    return { success: false, reason: 'ADMIN_NOTIFICATION_EMAIL_NOT_SET' };
  }

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[AdminNotifier] SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) not configured in .env.local. Notification skipped.');
    return { success: false, reason: 'SMTP_CREDENTIALS_MISSING' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const registeredAt = params.timestamp
      ? new Date(params.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
      : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

    const registrationSource = params.invite ? `Team Invite (${params.invite})` : 'Direct Website Registration';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { background: #0f172a; padding: 24px 32px; color: #ffffff; text-align: left; }
          .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em; }
          .header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }
          .content { padding: 32px; }
          .alert-badge { display: inline-block; padding: 4px 12px; background-color: #dbeafe; color: #1e40af; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
          .table-wrapper { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          .table-wrapper td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
          .label { color: #64748b; font-weight: 500; width: 35%; }
          .value { color: #0f172a; font-weight: 600; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; margin-top: 12px; }
          .footer { padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Digisoft-CRM</h1>
            <p>Admin System Notification</p>
          </div>
          <div class="content">
            <span class="alert-badge">New Onboarding</span>
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">A new user has registered!</h2>
            <table class="table-wrapper">
              <tr>
                <td class="label">Full Name</td>
                <td class="value">${escapeHtml(params.fullName || 'Not provided')}</td>
              </tr>
              <tr>
                <td class="label">Email Address</td>
                <td class="value"><a href="mailto:${escapeHtml(params.email)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(params.email)}</a></td>
              </tr>
              <tr>
                <td class="label">Registered At</td>
                <td class="value">${escapeHtml(registeredAt)}</td>
              </tr>
              <tr>
                <td class="label">Signup Source</td>
                <td class="value">${escapeHtml(registrationSource)}</td>
              </tr>
            </table>
            <div style="text-align: center; margin-top: 28px;">
              <a href="${siteUrl}/dashboard" class="button">Open Digisoft-CRM</a>
            </div>
          </div>
          <div class="footer">
            This is an automated notification from your Digisoft-CRM server.
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: adminEmail,
      subject: `🔔 [Digisoft-CRM] New User Registered: ${params.fullName || params.email} (${params.email})`,
      html: htmlContent,
      text: `Digisoft-CRM: A new user has registered.\n\nName: ${params.fullName}\nEmail: ${params.email}\nDate: ${registeredAt}\nSource: ${registrationSource}`,
    });

    console.log('[AdminNotifier] Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[AdminNotifier] Error sending admin notification email:', error);
    return { success: false, error: (error as Error).message };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

