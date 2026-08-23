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
    <div>
      <h2>Finanzen</h2>
      <p>Guthaben: <strong>{balance} €</strong></p>

      <h3>Vermögensübersicht</h3>
      <ul>
        <li>Wachen gesamt: {stationAssets.length} — Wert: {totalStationValue} €</li>
        <li>Fahrzeuge gesamt: {vehicles.length} — Wert: {totalVehicleValue} €</li>
      </ul>

      <h3>Transaktionsverlauf</h3>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {transactions.map((tx) => (
          <li key={tx.id} style={{ background: '#fff', padding: 10, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
            <div><strong>{tx.kind}</strong> — {tx.label}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{new Date(tx.createdAt).toLocaleString('de-DE')} · {tx.amount} €</div>
          </li>
        ))}
        {transactions.length === 0 && <li>Keine Transaktionen.</li>}
      </ul>
    </div>
  );
}
