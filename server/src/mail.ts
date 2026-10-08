// Mailversand – austauschbar. Solange kein Versand eingerichtet ist, ist er aus und „Passwort vergessen“ zeigt einen Hinweis.
//
// Einschalten (z. B. in /opt/leitstellendispo/config.env):
//   MAIL_VERSAND=konsole   → Mails werden nur ins Server-Log geschrieben (zum Testen, nichts geht raus)
// Echter Versand (SMTP o. Ä.) kommt hier als weitere Variante dazu, sobald Absender und Anbieter feststehen.

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

export function mailversandAusUmgebung(umgebung: NodeJS.ProcessEnv = process.env): Mailversand {
  if (umgebung.MAIL_VERSAND === 'konsole') return KONSOLEN_MAILVERSAND;
  return KEIN_MAILVERSAND;
}
