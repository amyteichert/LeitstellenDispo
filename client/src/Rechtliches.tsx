import type { ReactNode } from 'react';

/**
 * Impressum und Datenschutzerklärung – ohne Anmeldung erreichbar unter /impressum und /datenschutz.
 *
 * ⚠ PLATZHALTER: Die Straße der Betreiberin fehlt noch (wie im Impressum der Website). Vor dem öffentlichen Betrieb ausfüllen
 * und die Texte rechtlich prüfen lassen (keine Rechtsberatung).
 */
const BETREIBER = {
  name: 'Amy Teichert',
  // TODO: Straße und Hausnummer eintragen (leer = wird nicht angezeigt)
  strasse: '',
  ort: '14770 Brandenburg an der Havel',
  email: 'kontakt@leitstellendispo.de',
};

/** Hosting / Auftragsverarbeitung (Server von UPVYRA, Standort Deutschland, Auslieferung über Cloudflare) */
const HOSTER = {
  name: 'UPVYRA Management GbR',
  vertreten: 'vertreten durch die Gesellschafter Lucas Wicht und Lukas Rinke',
  strasse: 'Max-Herm-Str. 21',
  ort: '14772 Brandenburg an der Havel, Deutschland',
};

export const RECHTLICHE_SEITEN = ['/impressum', '/datenschutz'] as const;
export const istRechtlicheSeite = (pfad: string) => (RECHTLICHE_SEITEN as readonly string[]).includes(pfad.replace(/\/+$/, ''));

function Seite({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="rechtliches">
      <article className="rechtliches__karte">
        <a className="btn" href="/">← Zum Spiel</a>
        <h1>{titel}</h1>
        {children}
        <RechtlicheLinks />
      </article>
    </div>
  );
}

/** Links zu Impressum und Datenschutz – für Anmeldeseite, Spiel und die Seiten selbst */
export function RechtlicheLinks() {
  return (
    <nav className="rechtliche-links" aria-label="Rechtliches">
      <a href="/impressum">Impressum</a>
      <span aria-hidden> · </span>
      <a href="/datenschutz">Datenschutz</a>
    </nav>
  );
}

function Impressum() {
  return (
    <Seite titel="Impressum">
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {BETREIBER.name}<br />
        {BETREIBER.strasse && <>{BETREIBER.strasse}<br /></>}
        {BETREIBER.ort}
      </p>
      <h2>Kontakt</h2>
      <p>E-Mail: {BETREIBER.email}</p>
      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>{BETREIBER.name}, Anschrift wie oben</p>
      <h2>Hosting</h2>
      <p>
        {HOSTER.name}, {HOSTER.strasse}, {HOSTER.ort}
      </p>
      <h2>Hinweis</h2>
      <p>
        LeitstellenDispo ist ein Browserspiel. Alle Einsätze, Personen und Adressen im Spiel sind frei erfunden;
        Ähnlichkeiten mit realen Ereignissen sind zufällig. Im Notfall wähle immer <strong>112</strong>.
      </p>
    </Seite>
  );
}

function Datenschutz() {
  return (
    <Seite titel="Datenschutzerklärung">
      <h2>1. Verantwortliche</h2>
      <p>
        {[BETREIBER.name, BETREIBER.strasse, BETREIBER.ort].filter(Boolean).join(', ')}<br />
        E-Mail: {BETREIBER.email}
      </p>

      <h2>2. Hosting</h2>
      <p>
        Diese Website wird auf einem Server in Deutschland betrieben von:<br />
        {HOSTER.name}, {HOSTER.vertreten}, {HOSTER.strasse}, {HOSTER.ort}.<br />
        Der Hoster verarbeitet die Daten in unserem Auftrag (Art. 28 DSGVO).
      </p>
      <p>
        Die Website wird über das Content-Delivery-Netzwerk von Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA)
        ausgeliefert, das unter anderem vor Angriffen schützt. Dabei werden technische Verbindungsdaten (insbesondere die IP-Adresse)
        auch in den USA verarbeitet; Cloudflare ist nach dem EU-US Data Privacy Framework zertifiziert.
        Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und schnellen Bereitstellung (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>3. Server-Logfiles</h2>
      <p>
        Beim Aufruf der Website werden IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browser- und Geräteinformationen verarbeitet,
        um die Website auszuliefern, Fehler zu finden und Missbrauch abzuwehren (Art. 6 Abs. 1 lit. f DSGVO).
        Logdateien werden nach spätestens 14 Tagen gelöscht.
      </p>

      <h2>4. Benutzerkonto und Spielstand</h2>
      <p>
        Für ein Konto speichern wir deine E-Mail-Adresse, den gewählten Benutzernamen, das Passwort ausschließlich als sicheren
        Hash (bcrypt), die Rolle, das Erstellungsdatum und deinen Spielstand. Rechtsgrundlage ist die Bereitstellung des Spiels,
        das du nutzen möchtest (Art. 6 Abs. 1 lit. b DSGVO). Ein Klarname wird nicht abgefragt.
        Die Daten werden gespeichert, bis du dein Konto löschen lässt (Anfrage an die oben genannte E-Mail-Adresse).
      </p>
      <p>
        Die E-Mail-Adresse nutzen wir nur, damit du ein vergessenes Passwort zurücksetzen kannst, und für wichtige Hinweise zu
        deinem Konto – nicht für Werbung oder Newsletter. Fordert man einen Link zum Zurücksetzen an, wird ein nur einmal
        verwendbarer Code (gespeichert als Hash, 1 Stunde gültig) erzeugt und an die hinterlegte Adresse geschickt.
        {/* TODO: Sobald der Mailversand eingerichtet ist, hier den Versanddienst (Anbieter, Sitz, Auftragsverarbeitung) nennen. */}
      </p>
      <p>
        Das Team (Inhaberin und von ihr benannte Administratoren) kann zur Betreuung des Spiels Benutzername, E-Mail-Adresse,
        Rolle sowie eine Zusammenfassung deines Spielstands einsehen, Konten bei Missbrauch sperren und Links zum Zurücksetzen
        des Passworts erzeugen.
      </p>
      <p>
        Zum Schutz vor Passwort-Ausprobieren wird die IP-Adresse bei fehlgeschlagenen Anmeldungen und Registrierungen kurzzeitig
        im Arbeitsspeicher gezählt (höchstens 1 Stunde, Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>5. Cookies und lokale Speicherung</h2>
      <p>
        Nach der Anmeldung wird ein technisch notwendiges Sitzungs-Cookie (<code>ld_sitzung</code>, Laufzeit 30 Tage) gesetzt, damit
        du angemeldet bleibst. Außerdem speichert der Browser lokal Einstellungen wie Ton an/aus, die Startansicht und den
        Fortschritt der „Ersten Schritte“. Diese Speicherung ist für die von dir gewünschte Funktion unbedingt erforderlich
        (§ 25 Abs. 2 Nr. 2 TDDDG). Tracking- oder Werbe-Cookies verwenden wir nicht.
      </p>

      <h2>6. Karten und Adresssuche</h2>
      <p>
        Für die Spielkarte lädt dein Browser Kartenkacheln direkt von der OpenStreetMap Foundation (St John’s Innovation Centre,
        Cowley Road, Cambridge, CB4 0WS, Vereinigtes Königreich) und – in der Satellitenansicht – von Esri (Esri Inc., 380 New York St.,
        Redlands, CA 92373, USA). Für die Adresssuche und das Ermitteln von Adressen per Kartenklick wird der Dienst Nominatim der
        OpenStreetMap Foundation genutzt; dabei werden der Suchbegriff bzw. die Koordinaten übermittelt.
        Diese Anbieter erhalten dabei deine IP-Adresse. Rechtsgrundlage ist unser berechtigtes Interesse an einer funktionierenden
        Kartendarstellung (Art. 6 Abs. 1 lit. f DSGVO). Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der EU.
      </p>
      <p>
        Für das Spielwetter ruft dein Browser etwa alle 30 Minuten das aktuelle Wetter am Ort deiner ersten Wache beim Dienst
        Open-Meteo ab (Open-Meteo.com, Zürich, Schweiz). Übermittelt werden die auf etwa 10 km gerundeten Koordinaten der Wache
        sowie deine IP-Adresse. Rechtsgrundlage ist unser berechtigtes Interesse an einem realistischen Spielablauf
        (Art. 6 Abs. 1 lit. f DSGVO). Für die Schweiz besteht ein Angemessenheitsbeschluss der EU.
      </p>

      <h2>7. Schriftarten (Google Fonts)</h2>
      <p>
        Zur einheitlichen Darstellung lädt die Website Schriftarten von Google Fonts (Google Ireland Limited, Gordon House, Barrow Street,
        Dublin 4, Irland). Dabei wird deine IP-Adresse an Google übermittelt, ggf. auch in die USA
        (Art. 6 Abs. 1 lit. f DSGVO; Google ist nach dem EU-US Data Privacy Framework zertifiziert).
      </p>

      <h2>8. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch
        gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 15–21 DSGVO). Wende dich dazu an die oben genannte E-Mail-Adresse.
        Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.
      </p>

      <p className="rechtliches__stand">Stand: Oktober 2026</p>
    </Seite>
  );
}

export default function Rechtliches({ pfad }: { pfad: string }) {
  return pfad.replace(/\/+$/, '') === '/impressum' ? <Impressum /> : <Datenschutz />;
}
