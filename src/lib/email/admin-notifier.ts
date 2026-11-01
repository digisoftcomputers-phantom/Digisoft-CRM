import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

interface NewUserRegistrationParams {
  fullName: string;
  email: string;
  invite?: string | null;
  timestamp?: string;
  redirectTo?: string;
}

export async function notifyAdminOnNewRegistration(params: NewUserRegistrationParams) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || `"Digisoft-CRM" <${smtpUser || 'onboarding@digisoftcomputers.com'}>`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[AdminNotifier] SMTP credentials not configured in .env.local. Notification skipped.');
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

    // 1. Generate confirmation/magiclink via Supabase Admin API
    let confirmUrl = `${siteUrl}/login`;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'magiclink',
          email: params.email,
          options: {
            redirectTo: params.redirectTo || `${siteUrl}/auth/callback?next=/dashboard`,
          },
        });
        if (!linkError && linkData?.properties?.action_link) {
          confirmUrl = linkData.properties.action_link;
        } else if (linkError) {
          console.warn('[UserNotifier] Could not generate action_link:', linkError.message);
        }
      } catch (err) {
        console.warn('[UserNotifier] Supabase generateLink error:', err);
      }
    }

    // 2. Send User Onboarding & Confirmation Email directly to the newly registered user
    const userEmailHtml = `
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
          .welcome-badge { display: inline-block; padding: 4px 12px; background-color: #dbeafe; color: #1e40af; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
          .button { display: inline-block; background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; text-decoration: none; margin: 24px 0; }
          .footer { padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Digisoft-CRM</h1>
            <p>WhatsApp CRM &amp; Customer Management Platform</p>
          </div>
          <div class="content">
            <span class="welcome-badge">Welcome to Digisoft-CRM</span>
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #0f172a;">Welcome aboard, ${escapeHtml(params.fullName || 'there')}!</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Thank you for registering with <strong>Digisoft-CRM</strong>. Your account has been created with email <strong>${escapeHtml(params.email)}</strong>.
            </p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">
              Please click the button below to confirm your account and sign in directly to your CRM dashboard:
            </p>
            <div style="text-align: center;">
              <a href="${confirmUrl}" class="button">Confirm Account &amp; Open Dashboard</a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-top: 24px;">
              If the button above does not work, copy and paste this link into your browser:<br>
              <a href="${confirmUrl}" style="color: #2563eb; word-break: break-all;">${confirmUrl}</a>
            </p>
          </div>
          <div class="footer">
            Digisoft-CRM • Powered by Digisoft Computers
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const userInfo = await transporter.sendMail({
        from: smtpFrom,
        to: params.email,
        subject: `Welcome to Digisoft-CRM — Confirm your account`,
        html: userEmailHtml,
        text: `Welcome to Digisoft-CRM!\n\nHello ${params.fullName || 'there'},\n\nPlease confirm your account and sign in here:\n${confirmUrl}\n\nDigisoft-CRM`,
      });
      console.log(`[UserNotifier] Onboarding confirmation email sent to user (${params.email}):`, userInfo.messageId);
    } catch (userMailErr) {
      console.error(`[UserNotifier] Failed to send onboarding email to user (${params.email}):`, userMailErr);
    }

    // 3. Send Admin Alert Email
    let adminMessageId: string | undefined;
    if (adminEmail) {
      const adminHtmlContent = `
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

      const adminInfo = await transporter.sendMail({
        from: smtpFrom,
        to: adminEmail,
        subject: `🔔 [Digisoft-CRM] New User Registered: ${params.fullName || params.email} (${params.email})`,
        html: adminHtmlContent,
        text: `Digisoft-CRM: A new user has registered.\n\nName: ${params.fullName}\nEmail: ${params.email}\nDate: ${registeredAt}\nSource: ${registrationSource}`,
      });
      adminMessageId = adminInfo.messageId;
      console.log('[AdminNotifier] Admin notification sent successfully:', adminInfo.messageId);
    }

    return { success: true, messageId: adminMessageId };
  } catch (error) {
    console.error('[AdminNotifier] Error sending notification email:', error);
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
