import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';

export default function FinanzenView({ balance, locations, vehicles }: { balance: number; locations: MapLocation[]; vehicles: Vehicle[] }) {
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
    </div>
  );
}
