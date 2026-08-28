import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';
import { getFmsStatus } from './FahrzeugeView';
import { formatCurrency } from '../utils/formatCurrency';
import { isFmsAlarmable } from '@leitstellendispo/shared';
import type { VehicleRequirement } from '../vehicleCatalog';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

type Incident = {
  id: string;
  type: string;
  organization: 'Rettungsdienst' | 'Feuerwehr';
  status: string;
  coords: [number, number];
  address: string;
  requiredVehicles: VehicleRequirement[];
};

type Activity = { id: string; kind: 'Einnahme' | 'Ausgabe'; label: string; amount: number; createdAt: string };
type CompletedIncident = { id: string; type: string; organization: 'Rettungsdienst' | 'Feuerwehr'; completedAt: number; reward: number };
const overviewIcon = (color: string) => L.divIcon({ className: 'command-map-marker', html: `<span style="background:${color}"></span>`, iconSize: [14, 14], iconAnchor: [7, 7] });
function MiniMapClickHandler({ onOpenMap }: { onOpenMap: () => void }) {
  useMapEvents({ click: onOpenMap });
  return null;
}

export default function LeitstelleView({
  incidents,
  locations,
  vehicles,
  balance,
  activities,
  completedIncidents,
  onOpenIncidents,
  onOpenCompletedIncident,
  onOpenActiveIncidents,
  onOpenWachen,
  onOpenRescue,
  onOpenFire,
  onOpenVehicles,
  onOpenFinances,
  onOpenMap,
  onOpenStation,
}: {
  incidents: Incident[];
  locations: MapLocation[];
  vehicles: Vehicle[];
  balance: number;
  activities: Activity[];
  completedIncidents: CompletedIncident[];
  onOpenIncidents: (id: string) => void;
  onOpenCompletedIncident: (id: string) => void;
  onOpenActiveIncidents: () => void;
  onOpenWachen: () => void;
  onOpenRescue: () => void;
  onOpenFire: () => void;
  onOpenVehicles: () => void;
  onOpenFinances: () => void;
  onOpenMap: () => void;
  onOpenStation: (id: string) => void;
}) {
  const stations = locations.filter((location) => location.type === 'station');
  const activeIncidents = incidents.filter((incident) => incident.status !== 'Abgeschlossen');
  const rescueStations = stations.filter((station) => station.stationKind !== 'Feuerwache').length;
  const fireStations = stations.filter((station) => station.stationKind === 'Feuerwache').length;
  const availableVehicles = vehicles.filter((vehicle) => isFmsAlarmable(getFmsStatus(vehicle), vehicle.previousOperationalStatus)).length;
  const inUseVehicles = vehicles.filter((vehicle) => [3, 4].includes(getFmsStatus(vehicle))).length;
  const fmsStatusCounts = [1, 2, 3, 4, 5, 6].map((status) => `${status}: ${vehicles.filter((vehicle) => getFmsStatus(vehicle) === status).length}`).join(' · ');
  const rescueVehicles = vehicles.filter((vehicle) => vehicle.type === 'RTW');
  const fireVehicles = vehicles.filter((vehicle) => vehicle.type !== 'RTW');
  const recentActivities = [
    ...activities.map((activity) => ({ ...activity, timestamp: new Date(activity.createdAt).getTime(), onClick: onOpenFinances })),
    ...completedIncidents.map((incident) => ({ id: incident.id, kind: 'Einnahme' as const, label: `${incident.type} abgeschlossen`, amount: incident.reward, timestamp: incident.completedAt, onClick: () => onOpenCompletedIncident(incident.id) })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 4);
  const mapCenter = stations[0]?.coords ?? [48.775, 9.185] as [number, number];

  return (
    <div className="view-screen command-screen">
      <div className="screen-heading command-heading">
        <div><span className="eyebrow">Zentrale Übersicht</span><h2>Leitstelle</h2></div>
        <span className="command-live"><i /> System aktiv</span>
      </div>

      <div className="command-metrics">
        <button className="command-metric command-metric--red" type="button" onClick={onOpenActiveIncidents}><span>Aktive Einsätze</span><strong>{activeIncidents.length}</strong><small>Offene Vorgänge</small></button>
        <button className="command-metric command-metric--blue" type="button" onClick={onOpenRescue}><span>Rettungsdienst</span><strong>{rescueStations}</strong><small>Wachen im Netz</small></button>
        <button className="command-metric command-metric--fire" type="button" onClick={onOpenFire}><span>Feuerwehr</span><strong>{fireStations}</strong><small>Wachen im Netz</small></button>
        <button className="command-metric command-metric--green" type="button" onClick={onOpenFinances}><span>Guthaben</span><strong>{formatCurrency(balance)}</strong><small>Verfügbar</small></button>
      </div>

      <div className="command-layout">
        <section className="command-panel command-mini-map">
              <div className="panel-title"><div><span className="eyebrow">Orientierung</span><h3>Standorte &amp; Lage</h3></div><span>{stations.length + activeIncidents.length} Marker</span></div>
              <div className="command-map-frame">
                <MapContainer center={mapCenter} zoom={11} zoomControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} className="command-map">
                  <MiniMapClickHandler onOpenMap={onOpenMap} />
                  <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {stations.map((station) => (
                    <Marker key={station.id} position={station.coords} icon={overviewIcon(station.stationKind === 'Feuerwache' ? '#c41e3a' : '#4aa9df')} eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event); onOpenStation(station.id); } }} />
                  ))}
                  {activeIncidents.map((incident) => (
                    <Marker key={incident.id} position={incident.coords} icon={overviewIcon(incident.organization === 'Feuerwehr' ? '#c41e3a' : '#4aa9df')} eventHandlers={{ click: (event) => { L.DomEvent.stopPropagation(event); onOpenIncidents(incident.id); } }} />
                  ))}
                </MapContainer>
                <span className="command-map-hint">Karte öffnen</span>
              </div>
        </section>

        <section className="command-panel command-incidents" onClick={onOpenActiveIncidents}>
          <div className="panel-title"><div><span className="eyebrow">Live-Lage</span><h3>Aktuelle Einsätze</h3></div><span className="command-live-indicator"><i /> LIVE</span></div>
          {activeIncidents.length === 0 ? <p className="command-empty">Keine offenen Einsätze.</p> : (
            <div className="command-incident-list">
              {activeIncidents.map((incident) => (
                <button className="command-incident" type="button" key={incident.id} onClick={(event) => { event.stopPropagation(); onOpenIncidents(incident.id); }}>
                  <span className={`org-mark org-mark--${incident.organization === 'Feuerwehr' ? 'fire' : 'rescue'}`} />
                  <span className="command-incident__body"><strong>{incident.type}</strong><small>{incident.address}</small><small>{incident.requiredVehicles.map((requirement) => `${requirement.amount} × ${requirement.label}`).join(' · ')}</small></span>
                  <span className="command-incident__status">{incident.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <button className="command-panel command-resources command-panel--interactive" type="button" onClick={onOpenWachen}>
          <div className="panel-title"><div><span className="eyebrow">Einheiten</span><h3>Wachen &amp; Ressourcen</h3></div></div>
          <div className="resource-list">
            <div><span>Wachen gesamt</span><strong>{stations.length}</strong></div>
            <div><span>Fahrzeuge gesamt</span><strong>{vehicles.length}</strong></div>
            <div className="resource-list__positive"><span>Fahrzeuge verfügbar</span><strong>{availableVehicles}</strong></div>
          </div>
          <div className="resource-bar"><span style={{ width: `${vehicles.length ? (availableVehicles / vehicles.length) * 100 : 0}%` }} /></div>
        </button>

        <button className="command-panel command-fleet-summary command-panel--interactive" type="button" onClick={onOpenVehicles}>
          <div className="panel-title"><div><span className="eyebrow">Fuhrpark</span><h3>Verfügbarkeit</h3></div></div>
          <div className="fleet-summary"><strong>{availableVehicles} / {vehicles.length}</strong><span>Einheiten<br />einsatzbereit</span></div>
          <div className="fleet-summary__types"><span><i className="org-mark org-mark--rescue" /> Rettungsdienst <b>{rescueVehicles.filter((vehicle) => isFmsAlarmable(getFmsStatus(vehicle), vehicle.previousOperationalStatus)).length} verfügbar · {rescueVehicles.filter((vehicle) => [3, 4].includes(getFmsStatus(vehicle))).length} gebunden</b></span><span><i className="org-mark org-mark--fire" /> Feuerwehr <b>{fireVehicles.filter((vehicle) => isFmsAlarmable(getFmsStatus(vehicle), vehicle.previousOperationalStatus)).length} verfügbar · {fireVehicles.filter((vehicle) => [3, 4].includes(getFmsStatus(vehicle))).length} gebunden</b></span></div>
          <div className="fleet-summary__types"><span>Im Einsatz <b>{inUseVehicles}</b></span><span>FMS <b>{fmsStatusCounts}</b></span></div>
        </button>

        <section className="command-panel command-activity">
          <div className="panel-title"><div><span className="eyebrow">Verlauf</span><h3>Letzte Aktivitäten</h3></div></div>
          {recentActivities.length === 0 ? <p className="command-empty">Noch keine Aktivitäten.</p> : (
            <div className="activity-list">
              {recentActivities.map((activity) => (
                <button className="activity-row" type="button" key={activity.id} onClick={activity.onClick}><span className={`activity-dot activity-dot--${activity.kind === 'Einnahme' ? 'income' : 'expense'}`} /><span><strong>{activity.label}</strong><small>{new Date(activity.timestamp).toLocaleString('de-DE')}</small></span><b className={activity.kind === 'Einnahme' ? 'positive' : ''}>{activity.kind === 'Einnahme' ? '+' : '-'}{formatCurrency(activity.amount)}</b></button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}