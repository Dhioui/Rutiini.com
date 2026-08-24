import nodemailer, { type Transporter } from 'nodemailer';
import { log } from './vite';

/**
 * Outgoing email.
 *
 * Password reset previously wrote its token to the server log with a comment
 * saying an email would be sent in production. Nothing sent it: the user was told
 * "a reset link has been sent" and received nothing, while a credential that grants
 * account access sat in the logs, where operations staff and log shipping can read
 * it. Both halves of that are fixed here.
 *
 * Plain SMTP rather than a provider SDK, so the deployment picks its own sender --
 * the municipality's own mail server, or a service with a data processing agreement
 * and EU hosting. Nothing here is specific to one vendor.
 *
 * With SMTP_HOST unset the transport is disabled: sending is skipped and logged,
 * which keeps development and tests working without a mail server. Production
 * refuses to start unconfigured -- see assertEmailConfigured.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

function readConfig() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = Number.parseInt(process.env.SMTP_PORT ?? '587', 10);
  return {
    host,
    port,
    // Port 465 is implicit TLS; 587 and 25 upgrade with STARTTLS.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
      : undefined,
    from: process.env.SMTP_FROM?.trim() || 'Rutiini <no-reply@rutiini.com>',
  };
}

let transporter: Transporter | null = null;
let warnedUnconfigured = false;

function getTransporter(): { transport: Transporter; from: string } | null {
  const config = readConfig();
  if (!config) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }
  return { transport: transporter, from: config.from };
}

/** True when a mail server is configured and mail will actually be delivered. */
export function isEmailConfigured(): boolean {
  return readConfig() !== null;
}

/**
 * Fail fast in production rather than silently dropping password resets.
 *
 * A deployment without SMTP looks healthy until the first person forgets their
 * password and can never get back in.
 */
export function assertEmailConfigured(): void {
  if (process.env.NODE_ENV === 'production' && !isEmailConfigured()) {
    throw new Error(
      'SMTP_HOST must be set in production: without it password reset emails are ' +
      'never delivered and users locked out of their accounts cannot recover. ' +
      'See .env.example for the full list of SMTP_* variables.'
    );
  }
}

/**
 * Send one message.
 *
 * Returns whether it was handed to the mail server. Callers must not change what
 * they tell the user based on the result: the reset endpoint answers the same way
 * whether or not the address exists, and leaking delivery success would undo that.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const mailer = getTransporter();

  if (!mailer) {
    if (!warnedUnconfigured) {
      log('[Email] SMTP_HOST is not set; outgoing email is disabled', 'email');
      warnedUnconfigured = true;
    }
    return false;
  }

  try {
    await mailer.transport.sendMail({
      from: mailer.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return true;
  } catch (error: any) {
    // The address is deliberately left out: this line lands in logs that are not
    // the place for who is resetting what.
    log(`[Email] Delivery failed: ${error?.message ?? error}`, 'email');
    return false;
  }
}
