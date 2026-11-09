import { useState } from 'react';
import {
  KREDIT_CONFIG,
  berechneKredit,
  formatEuro,
  getKreditBetraege,
  getKreditRahmen,
  getKreditRestStunden,
  getNaechsterRang,
  type Kredit,
} from '@leitstellendispo/shared';

const prozent = (anteil: number) => `${Math.round(anteil * 100)} %`;

/** Restlaufzeit lesbar: „ca. 3 Std. 20 Min.“ */
function formatStunden(stunden: number): string {
  const minuten = Math.max(1, Math.round(stunden * 60));
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  return `ca. ${h > 0 ? `${h} Std. ` : ''}${m > 0 || h === 0 ? `${m} Min.` : ''}`.trim();
}

/** Kredit aufnehmen und zurückzahlen – Teil der Finanzen */
export default function KreditBereich({ kredit, balance, xp, nimmKredit, loeseKreditAb }: {
  kredit: Kredit | null;
  balance: number;
  xp: number;
  nimmKredit: (betrag: number, laufzeitStunden: number) => string | null;
  loeseKreditAb: () => string | null;
}) {
  const betraege = getKreditBetraege(xp);
  const [betrag, setBetrag] = useState<number>(betraege[0]);
  const [laufzeit, setLaufzeit] = useState<number>(KREDIT_CONFIG.laufzeiten[1].stunden);
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);

  const melde = (fehler: string | null, erfolg: string) => setMeldung(fehler ? { art: 'fehler', text: fehler } : { art: 'ok', text: erfolg });

  if (kredit) {
    const bezahlt = kredit.gesamtSchuld - kredit.restSchuld;
    return (
      <section className="kredit">
        <ul className="finanz-posten">
          <li>
            <div><strong>Restschuld</strong><small>von {formatEuro(kredit.gesamtSchuld)} ({formatEuro(kredit.betrag)} + {prozent(kredit.zinsSatz)} Zinsen)</small></div>
            <span>{formatEuro(kredit.restSchuld)}</span>
          </li>
          <li>
            <div><strong>Rate</strong><small>wird minütlich abgebucht, solange das Spiel offen ist</small></div>
            <span>{formatEuro(kredit.rateJeStunde)} / Std.</span>
          </li>
          <li>
            <div><strong>Restlaufzeit</strong><small>Spielzeit</small></div>
            <span>{formatStunden(getKreditRestStunden(kredit))}</span>
          </li>
        </ul>
        <div className="bearbeitung-fortschritt">
          <div className="bearbeitung-fortschritt__balken" role="progressbar" aria-valuemin={0} aria-valuemax={kredit.gesamtSchuld} aria-valuenow={bezahlt} aria-label="Zurückgezahlt">
            <span style={{ width: `${(bezahlt / kredit.gesamtSchuld) * 100}%` }} />
          </div>
          <small>{prozent(bezahlt / kredit.gesamtSchuld)} zurückgezahlt</small>
        </div>
        <button
          type="button"
          className="btn"
          disabled={balance < kredit.restSchuld}
          title={balance < kredit.restSchuld ? `Dafür brauchst du ${formatEuro(kredit.restSchuld)} auf dem Konto` : undefined}
          onClick={() => {
            if (!window.confirm(`Restschuld von ${formatEuro(kredit.restSchuld)} jetzt auf einmal zurückzahlen?`)) return;
            melde(loeseKreditAb(), 'Kredit abgelöst – du bist schuldenfrei.');
          }}
        >
          Restschuld ablösen ({formatEuro(kredit.restSchuld)})
        </button>
        {meldung && <div className={`aktion-rueckmeldung ${meldung.art === 'fehler' ? 'ruf-minus' : ''}`} role="status">{meldung.text}</div>}
      </section>
    );
  }

  const vorschau = berechneKredit(betrag, laufzeit);
  const naechsterRang = getNaechsterRang(xp);

  return (
    <section className="kredit">
      <p className="kredit__info">
        Leih dir Geld für den nächsten Ausbau. Zurückgezahlt wird in festen Raten je Spielstunde – nur, solange das Spiel offen ist.
        Vorzeitig ablösen geht jederzeit ohne Aufpreis. Dein Kreditrahmen: <strong>{formatEuro(getKreditRahmen(xp))}</strong>
        {naechsterRang && <> (mehr ab Rang „{naechsterRang.name}“)</>}.
      </p>

      <div className="kredit__wahl">
        <span>Betrag</span>
        <div className="verwalten-reiter" role="radiogroup" aria-label="Betrag">
          {betraege.map((b) => (
            <button key={b} type="button" role="radio" aria-checked={betrag === b} className={`btn ${betrag === b ? 'btn--primary' : ''}`} onClick={() => setBetrag(b)}>
              {formatEuro(b)}
            </button>
          ))}
        </div>
      </div>

      <div className="kredit__wahl">
        <span>Laufzeit</span>
        <div className="verwalten-reiter" role="radiogroup" aria-label="Laufzeit">
          {KREDIT_CONFIG.laufzeiten.map((l) => (
            <button key={l.stunden} type="button" role="radio" aria-checked={laufzeit === l.stunden} className={`btn ${laufzeit === l.stunden ? 'btn--primary' : ''}`} onClick={() => setLaufzeit(l.stunden)}>
              {l.stunden} Std. · {prozent(l.zinsSatz)}
            </button>
          ))}
        </div>
      </div>

      {vorschau && (
        <ul className="finanz-posten">
          <li><div><strong>Auszahlung</strong></div><span>{formatEuro(vorschau.betrag)}</span></li>
          <li><div><strong>Zinsen</strong><small>{prozent(vorschau.zinsSatz)} auf die ganze Laufzeit</small></div><span>{formatEuro(vorschau.gesamtSchuld - vorschau.betrag)}</span></li>
          <li><div><strong>Rate</strong><small>{vorschau.laufzeitStunden} Spielstunden lang</small></div><span>{formatEuro(vorschau.rateJeStunde)} / Std.</span></li>
          <li className="finanz-posten__summe"><strong>Zurückzuzahlen</strong><span>{formatEuro(vorschau.gesamtSchuld)}</span></li>
        </ul>
      )}

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => {
          if (!vorschau || !window.confirm(`${formatEuro(vorschau.betrag)} leihen und ${vorschau.laufzeitStunden} Spielstunden lang ${formatEuro(vorschau.rateJeStunde)} pro Stunde zurückzahlen?`)) return;
          melde(nimmKredit(betrag, laufzeit), `${formatEuro(betrag)} sind auf deinem Konto.`);
        }}
      >
        Kredit aufnehmen
      </button>
      {meldung && <div className={`aktion-rueckmeldung ${meldung.art === 'fehler' ? 'ruf-minus' : ''}`} role="status">{meldung.text}</div>}
    </section>
  );
}
