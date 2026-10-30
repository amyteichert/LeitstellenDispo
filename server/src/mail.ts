// Mailversand – austauschbar. Solange kein Versand eingerichtet ist, ist er aus und „Passwort vergessen“ zeigt einen Hinweis.
//
// Einschalten (z. B. in /opt/leitstellendispo/config.env):
//   MAIL_VERSAND=konsole   → Mails werden nur ins Server-Log geschrieben (zum Testen, nichts geht raus)
//   MAIL_VERSAND=smtp      → echter Versand über SMTP, dazu:
//     SMTP_HOST, SMTP_PORT (Standard 587), SMTP_BENUTZER, SMTP_PASSWORT,
//     MAIL_ABSENDER (Standard: SMTP_BENUTZER), z. B. "LeitstellenDispo <name@icloud.com>"
//   iCloud: SMTP_HOST=smtp.mail.me.com, Passwort = app-spezifisches Passwort von account.apple.com

export interface Mail {
  an: string;
  betreff: string;
  text: string;
}

export interface Mailversand {
  aktiv: boolean;
  sende(mail: Mail): Promise<void>;
}

export const KEIN_MAILVERSAND: Mailversand = {
  aktiv: false,
  async sende() {
    throw new Error('Mailversand ist nicht eingerichtet.');
  },
};

/** Schreibt Mails nur ins Log – zum Testen auf dem Server, ohne dass etwas verschickt wird. */
export const KONSOLEN_MAILVERSAND: Mailversand = {
  aktiv: true,
  async sende(mail) {
    console.log(`[Mail an ${mail.an}] ${mail.betreff}\n${mail.text}`);
  },
};

export function smtpMailversand(einstellungen: { host: string; port: number; benutzer: string; passwort: string; absender: string }): Mailversand {
  // Erst beim ersten Versand laden – fehlt das Paket auf dem Server, startet das Spiel trotzdem
  let transport: Promise<import('nodemailer').Transporter> | undefined;
  const holeTransport = () =>
    (transport ??= import('nodemailer').then(({ default: nodemailer }) =>
      nodemailer.createTransport({
        host: einstellungen.host,
        port: einstellungen.port,
        secure: einstellungen.port === 465,
        auth: { user: einstellungen.benutzer, pass: einstellungen.passwort },
      })));
  return {
    aktiv: true,
    async sende(mail) {
      await (await holeTransport()).sendMail({ from: einstellungen.absender, to: mail.an, subject: mail.betreff, text: mail.text });
    },
  };
}

export function mailversandAusUmgebung(umgebung: NodeJS.ProcessEnv = process.env): Mailversand {
  if (umgebung.MAIL_VERSAND === 'konsole') return KONSOLEN_MAILVERSAND;
  if (umgebung.MAIL_VERSAND === 'smtp') {
    const { SMTP_HOST, SMTP_PORT, SMTP_BENUTZER, SMTP_PASSWORT, MAIL_ABSENDER } = umgebung;
    if (!SMTP_HOST || !SMTP_BENUTZER || !SMTP_PASSWORT) {
      console.error('MAIL_VERSAND=smtp, aber SMTP_HOST, SMTP_BENUTZER oder SMTP_PASSWORT fehlt – Mailversand bleibt aus.');
      return KEIN_MAILVERSAND;
    }
    return smtpMailversand({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      benutzer: SMTP_BENUTZER,
      passwort: SMTP_PASSWORT,
      absender: MAIL_ABSENDER || SMTP_BENUTZER,
    });
  }
  return KEIN_MAILVERSAND;
}
