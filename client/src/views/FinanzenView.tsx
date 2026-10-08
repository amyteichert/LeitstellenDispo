import { formatEuro } from '@leitstellendispo/shared';
import type { FinanceTransaction, MapLocation, Vehicle } from '../types';

function Kachel({ titel, wert, hinweis }: { titel: string; wert: string; hinweis?: string }) {
  return (
    <div className="finanz-kachel">
      <span>{titel}</span>
      <strong>{wert}</strong>
      {hinweis && <small>{hinweis}</small>}
    </div>
  );
}

export default function FinanzenView({ balance, locations, vehicles, transactions }: { balance: number; locations: MapLocation[]; vehicles: Vehicle[]; transactions: FinanceTransaction[] }) {
  const stationAssets = locations.filter(l => l.type === 'station');
  const totalStationValue = stationAssets.reduce((s, it) => s + (it.price ?? 0), 0);
  const totalVehicleValue = vehicles.reduce((s, v) => s + (v.price ?? 0), 0);
  const einnahmen = transactions.filter((tx) => tx.kind === 'Einnahme').reduce((s, tx) => s + tx.amount, 0);
  const ausgaben = transactions.filter((tx) => tx.kind === 'Ausgabe').reduce((s, tx) => s + tx.amount, 0);

  return (
    <div>
      <h2>Finanzen</h2>

      <div className="finanz-kacheln">
        <Kachel titel="Guthaben" wert={formatEuro(balance)} />
        <Kachel titel="Einnahmen gesamt" wert={formatEuro(einnahmen)} />
        <Kachel titel="Ausgaben gesamt" wert={formatEuro(ausgaben)} />
        <Kachel titel={`Wachen (${stationAssets.length})`} wert={formatEuro(totalStationValue)} hinweis="Kaufwert" />
        <Kachel titel={`Fahrzeuge (${vehicles.length})`} wert={formatEuro(totalVehicleValue)} hinweis="Kaufwert" />
      </div>

      <h3 style={{ margin: '16px 0 8px' }}>Buchungen</h3>
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
