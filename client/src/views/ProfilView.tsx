import { ROLLEN_LABELS, getRufLabel, istGruendungsSpieler, type Konto } from '@leitstellendispo/shared';
import SpielerName from '../SpielerName';

const euro = (betrag: number) => `${Math.round(betrag).toLocaleString('de-DE')} €`;

/** Eigenes Profil: wer man ist, seit wann dabei, Abzeichen und die wichtigsten Zahlen der eigenen Leitstelle */
export default function ProfilView({
  konto,
  gast,
  stand,
  onFehlerMelden,
  onZurAnmeldung,
}: {
  konto: Konto;
  gast: boolean;
  stand: { wachen: number; fahrzeuge: number; personal: number; einsaetze: number; rd: number; fw: number; guthaben: number; ruf: number };
  onFehlerMelden: () => void;
  onZurAnmeldung: () => void;
}) {
  const zahlen: Array<[string, string]> = [
    ['Guthaben', euro(stand.guthaben)],
    ['Ruf', `${stand.ruf} · ${getRufLabel(stand.ruf)}`],
    ['Wachen', String(stand.wachen)],
    ['Fahrzeuge', String(stand.fahrzeuge)],
    ['Personal', String(stand.personal)],
    ['Einsätze abgeschlossen', `${stand.einsaetze} (RD ${stand.rd} · FW ${stand.fw})`],
  ];

  return (
    <div className="profil">
      <h2>Profil</h2>

      <section className="ausbau-karte profil-kopf">
        {gast ? (
          <>
            <p><strong>Gast</strong> – ohne Konto wird nichts gespeichert.</p>
            <p>Mit einem Konto bleibt deine Leitstelle erhalten, und in der Alpha bekommst du das Abzeichen als Gründungs-Spieler.</p>
            <button type="button" className="btn btn--primary" onClick={onZurAnmeldung}>Anmelden / Registrieren</button>
          </>
        ) : (
          <>
            <p className="profil-name"><SpielerName konto={konto} /></p>
            <small className="einsatz-eintrag__zeile">
              {ROLLEN_LABELS[konto.rolle]} · dabei seit {new Date(konto.erstellt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </small>
            <div>
              <span className="ausbau-karte__kategorie">Abzeichen</span>
              {istGruendungsSpieler(konto)
                ? <p>🎖️ <strong>Gründungs-Spieler</strong> – schon in der Alpha dabei.</p>
                : <p className="einsatz-eintrag__zeile">Noch keine Abzeichen.</p>}
            </div>
          </>
        )}
      </section>

      <section className="ausbau-karte">
        <span className="ausbau-karte__kategorie">Deine Leitstelle</span>
        <dl className="profil-zahlen">
          {zahlen.map(([titel, wert]) => (
            <div key={titel}>
              <dt>{titel}</dt>
              <dd>{wert}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ausbau-karte">
        <span className="ausbau-karte__kategorie">Etwas stimmt nicht?</span>
        <p>Melde Fehler direkt aus dem Spiel – die wichtigsten Angaben zu Gerät und Spielstand werden automatisch mitgeschickt.</p>
        <button type="button" className="btn btn--secondary" onClick={onFehlerMelden} disabled={gast}>Fehler melden</button>
        {gast && <small className="einsatz-eintrag__zeile">Fehler melden geht mit einem Konto.</small>}
      </section>
    </div>
  );
}
