import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';

type FinanceTransaction = {
  id: string;
  kind: 'Einnahme' | 'Ausgabe';
  label: string;
  amount: number;
  createdAt: string;
};

export default function FinanzenView({ balance, locations, vehicles, transactions }: { balance: number; locations: MapLocation[]; vehicles: Vehicle[]; transactions: FinanceTransaction[] }) {
  const stationAssets = locations.filter(l => l.type === 'station');
  const totalStationValue = stationAssets.reduce((s, it) => s + (it.price ?? 0), 0);
  const totalVehicleValue = vehicles.reduce((s, v) => s + (v.price ?? 0), 0);

  return (
    <div className="view-screen">
      <div className="screen-heading"><div><span className="eyebrow">Kontrollzentrum</span><h2>Finanzen</h2></div></div>
      <div className="finance-metrics">
        <div className="finance-card finance-card--balance"><span>Aktuelles Guthaben</span><strong>{balance} €</strong><small>Verfügbar</small></div>
        <div className="finance-card"><span>Wachen</span><strong>{stationAssets.length}</strong><small>Standorte aktiv</small></div>
        <div className="finance-card"><span>Fahrzeuge</span><strong>{vehicles.length}</strong><small>Einheiten im Fuhrpark</small></div>
        <div className="finance-card"><span>Gesamtvermögen</span><strong>{totalStationValue + totalVehicleValue} €</strong><small>Wachen + Fahrzeuge</small></div>
      </div>
      <div className="section-panel transactions-panel"><div className="panel-title"><div><span className="eyebrow">Buchungen</span><h3>Transaktionen</h3></div><span>{transactions.length}</span></div>
      <ul className="transaction-list">
        {transactions.map((tx) => (
          <li key={tx.id} className={`transaction-item transaction-item--${tx.kind === 'Einnahme' ? 'income' : 'expense'}`}>
            <div><strong>{tx.kind}</strong><span>{tx.label}</span></div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(tx.createdAt).toLocaleString('de-DE')} · {tx.amount} €</div>
          </li>
        ))}
        {transactions.length === 0 && <li>Keine Transaktionen.</li>}
      </ul></div>
    </div>
  );
}
