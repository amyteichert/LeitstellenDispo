import { KOSTEN_CONFIG, KREDIT_AUSZAHLUNG_LABEL, formatEuro, type Kredit, type LaufendeKosten } from '@leitstellendispo/shared';
import KreditBereich from './KreditBereich';
import type { FinanceTransaction, MapLocation, Vehicle } from '../types';

const STUNDE = 60 * 60 * 1000;

function Kachel({ titel, wert, hinweis, ton }: { titel: string; wert: string; hinweis?: string; ton?: 'plus' | 'minus' }) {
  return (
    <div className={`finanz-kachel ${ton ? `finanz-kachel--${ton}` : ''}`}>
      <span>{titel}</span>
      <strong>{wert}</strong>
      {hinweis && <small>{hinweis}</small>}
    </div>
  );
}

export default function FinanzenView({ balance, locations, vehicles, transactions, laufendeKosten, nowMs, kredit, xp, nimmKredit, loeseKreditAb }: {
  balance: number;
  locations: MapLocation[];
  vehicles: Vehicle[];
  transactions: FinanceTransaction[];
  laufendeKosten: LaufendeKosten;
  nowMs: number;
  kredit: Kredit | null;
  xp: number;
  nimmKredit: (betrag: number, laufzeitStunden: number) => string | null;
  loeseKreditAb: () => string | null;
}) {
  const stationAssets = locations.filter(l => l.type === 'station');
  const totalStationValue = stationAssets.reduce((s, it) => s + (it.price ?? 0), 0);
  const totalVehicleValue = vehicles.reduce((s, v) => s + (v.price ?? 0), 0);
  const einnahmen = transactions.filter((tx) => tx.kind === 'Einnahme').reduce((s, tx) => s + tx.amount, 0);
  const ausgaben = transactions.filter((tx) => tx.kind === 'Ausgabe').reduce((s, tx) => s + tx.amount, 0);
  // Einnahmen der letzten Stunde (ohne Startguthaben und Kredite) – zum Vergleich mit den laufenden Kosten
  const einnahmenLetzteStunde = transactions
    .filter((tx) => tx.kind === 'Einnahme' && tx.id !== 'initial-balance' && tx.label !== KREDIT_AUSZAHLUNG_LABEL && nowMs - new Date(tx.createdAt).getTime() <= STUNDE)
    .reduce((s, tx) => s + tx.amount, 0);
  const kreditRate = kredit?.rateJeStunde ?? 0;
  const bilanz = einnahmenLetzteStunde - laufendeKosten.gesamt - kreditRate;

  const posten: Array<[string, number, string]> = [
    ['Gehälter', laufendeKosten.gehaelter, `${formatEuro(KOSTEN_CONFIG.gehaltJeStunde)} je Person, Zulagen für Notarzt, Führung u. a.`],
    ['Wachen', laufendeKosten.wachen, 'Unterhalt je Wache, Ausbauten und Ausbildungsräume'],
    ['Fahrzeuge', laufendeKosten.fahrzeuge, `${formatEuro(KOSTEN_CONFIG.fahrzeugJeStunde)} je Fahrzeug (Wartung, Versicherung)`],
    ['Krankenhäuser', laufendeKosten.krankenhaeuser, 'Grundbetrieb eigener Häuser'],
  ];

  return (
    <div>
      <div className="seiten-kopf">
        <h2 data-tour="finanzen">Finanzen</h2>
        <p>Einnahmen kommen aus abgeschlossenen Einsätzen und Transporten. Gehälter und Unterhalt laufen, solange das Spiel geöffnet ist.</p>
      </div>

      {balance < 0 && (
        <div className="versorgung-hinweis versorgung-hinweis--fehlt" role="alert">
          Dein Konto ist im Minus. Käufe sind gesperrt, bis wieder Geld da ist – Einsätze bringen weiter Einnahmen.
          Prüfe, ob Personal ohne Fahrzeug oder ungenutzte Ausbauten Kosten verursachen.
        </div>
      )}

      <div className="finanz-kacheln">
        <Kachel titel="Guthaben" wert={formatEuro(balance)} ton={balance < 0 ? 'minus' : undefined} />
        <Kachel titel="Laufende Kosten" wert={`${formatEuro(laufendeKosten.gesamt)} / Std.`} hinweis="werden minütlich abgebucht" />
        <Kachel titel="Einnahmen letzte Stunde" wert={formatEuro(einnahmenLetzteStunde)} />
        <Kachel
          titel="Bilanz (Schätzung)"
          wert={`${bilanz >= 0 ? '+' : '−'} ${formatEuro(Math.abs(bilanz))} / Std.`}
          hinweis={kreditRate > 0 ? 'Einnahmen letzte Stunde minus Kosten und Kreditrate' : 'Einnahmen letzte Stunde minus Kosten'}
          ton={bilanz >= 0 ? 'plus' : 'minus'}
        />
      </div>

      <h3 className="abschnitt-titel">Laufende Kosten je Stunde</h3>
      <ul className="finanz-posten">
        {posten.map(([name, betrag, info]) => (
          <li key={name}>
            <div>
              <strong>{name}</strong>
              <small>{info}</small>
            </div>
            <span>{formatEuro(betrag)}</span>
          </li>
        ))}
        <li className="finanz-posten__summe">
          <strong>Gesamt</strong>
          <span>{formatEuro(laufendeKosten.gesamt)}</span>
        </li>
      </ul>

      <h3 className="abschnitt-titel">Kredit</h3>
      <KreditBereich kredit={kredit} balance={balance} xp={xp} nimmKredit={nimmKredit} loeseKreditAb={loeseKreditAb} />

      <h3 className="abschnitt-titel">Vermögen &amp; Summen</h3>
      <div className="finanz-kacheln">
        <Kachel titel="Einnahmen gesamt" wert={formatEuro(einnahmen)} />
        <Kachel titel="Ausgaben gesamt" wert={formatEuro(ausgaben)} />
        <Kachel titel={`Wachen (${stationAssets.length})`} wert={formatEuro(totalStationValue)} hinweis="Kaufwert" />
        <Kachel titel={`Fahrzeuge (${vehicles.length})`} wert={formatEuro(totalVehicleValue)} hinweis="Kaufwert" />
      </div>

      <h3 className="abschnitt-titel">Buchungen</h3>
      {transactions.length === 0 ? (
        <div className="leerzustand">Noch keine Buchungen.</div>
      ) : (
        <ul className="finanz-buchungen">
          {transactions.map((tx) => (
            <li key={tx.id}>
              <div>
                <strong>{tx.label}</strong>
                <small>{new Date(tx.createdAt).toLocaleString('de-DE')}</small>
              </div>
              <span className={tx.kind === 'Einnahme' ? 'betrag--plus' : 'betrag--minus'}>
                {tx.kind === 'Einnahme' ? '+' : '−'} {formatEuro(tx.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
