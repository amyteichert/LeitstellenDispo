import { useEffect, useMemo, useState } from 'react';
import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';

type IncidentStatus = 'Offen' | 'Fahrzeuge alarmiert' | 'In Bearbeitung' | 'Abgeschlossen';

type Incident = {
  id: string;
  type: string;
  organization: 'Rettungsdienst' | 'Feuerwehr';
  status: IncidentStatus;
  coords: [number, number];
  address: string;
  generatedByStationId: string;
  generatedByStationName: string;
  requiredVehicles: Array<{ id: string; category: 'RTW' | 'Löschfahrzeug'; amount: number }>;
  alarmedVehicles: Array<{ vehicleId: string; distanceKm: number; etaSeconds: number; arrivalAt: number }>;
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
};

const getVehicleCategory = (type?: string) => {
  if (!type) return null;
  if (type === 'RTW') return 'RTW';
  if (['LF 10', 'LF 20', 'TLF 2000', 'TLF 3000', 'TLF 4000'].includes(type)) return 'Löschfahrzeug';
  return null;
};

const haversineKm = (from: [number, number], to: [number, number]) => {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRadians(from[0]);
  const lat2 = toRadians(to[0]);
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

const formatEtaLabel = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${totalSeconds} Sek.`;
};

type CompletedIncidentHistoryEntry = Incident & {
  completedAt: number;
  totalDurationSeconds: number;
};

export default function EinsaetzeView({
  incidents,
  completedIncidentHistory,
  vehicles,
  locations,
  selectedIncidentId,
  setSelectedIncidentId,
  alarmIncidentVehicles,
  triggerTestIncident,
  nowMs,
  stats,
}: {
  incidents: Incident[];
  completedIncidentHistory: CompletedIncidentHistoryEntry[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  alarmIncidentVehicles: (incidentId: string, selectedVehicleIds: string[]) => void;
  triggerTestIncident: () => void;
  nowMs: number;
  stats: { total: number; rettungsdienst: number; feuerwehr: number; earned: number };
}) {
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Aktive' | 'Abgeschlossen'>('Aktive');

  useEffect(() => {
    setSelectedVehicleIds([]);
  }, [selectedIncidentId]);

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId)
      ?? completedIncidentHistory.find((incident) => incident.id === selectedIncidentId)
      ?? (activeTab === 'Aktive' ? incidents[0] ?? null : completedIncidentHistory[0] ?? null),
    [incidents, completedIncidentHistory, selectedIncidentId, activeTab],
  );

  const availableVehiclesForSelectedIncident = useMemo(() => {
    if (!selectedIncident || selectedIncident.status === 'Abgeschlossen') return [] as Vehicle[];

    return vehicles.filter((vehicle) => {
      if (vehicle.status !== 'Einsatzbereit') return false;
      const category = getVehicleCategory(vehicle.type);
      if (!category) return false;
      return selectedIncident.requiredVehicles.some((requirement) => requirement.category === category);
    }).sort((a, b) => {
      const aCoords = a.stationId ? locations.find((loc) => loc.id === a.stationId)?.coords : undefined;
      const bCoords = b.stationId ? locations.find((loc) => loc.id === b.stationId)?.coords : undefined;
      if (!aCoords || !bCoords) return 0;
      return haversineKm(aCoords, selectedIncident.coords) - haversineKm(bCoords, selectedIncident.coords);
    });
  }, [selectedIncident, vehicles, locations]);

  const visibleIncidents = incidents.filter((incident) => incident.status !== 'Abgeschlossen');
  const completedList = useMemo(
    () => [...completedIncidentHistory].sort((a, b) => b.completedAt - a.completedAt),
    [completedIncidentHistory],
  );

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((current) =>
      current.includes(vehicleId) ? current.filter((id) => id !== vehicleId) : [...current, vehicleId],
    );
  };

  const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div>
      <h2>Einsätze</h2>
      <div style={{ marginBottom: 12 }}>
        <button className="btn btn--primary" type="button" onClick={triggerTestIncident}>Test-Einsatz erzeugen</button>
      </div>

      <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 8 }}>
        <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Abgeschlossen</div>
          <strong>{stats.total}</strong>
        </div>
        <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>RD</div>
          <strong>{stats.rettungsdienst}</strong>
        </div>
        <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>FW</div>
          <strong>{stats.feuerwehr}</strong>
        </div>
        <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Verdient</div>
          <strong>{stats.earned} €</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(0, 1.4fr)', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className={`btn ${activeTab === 'Aktive' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Aktive')}>Aktive Einsätze</button>
            <button type="button" className={`btn ${activeTab === 'Abgeschlossen' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Abgeschlossen')}>Abgeschlossen</button>
          </div>

          {activeTab === 'Aktive' ? (
            <>
              {visibleIncidents.length === 0 && <p>Keine offenen Einsätze.</p>}
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
                {visibleIncidents.map((incident) => (
                  <li key={incident.id}>
                    <button
                      type="button"
                      className={`view-menu-item ${selectedIncident?.id === incident.id ? 'active' : ''}`}
                      onClick={() => setSelectedIncidentId(incident.id)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      <strong>{incident.type}</strong>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {incident.organization} · {incident.status} · {incident.generatedByStationName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {incident.reward} € · {incident.alarmedVehicles.length} alarmiert
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {completedList.length === 0 && <p>Keine abgeschlossenen Einsätze.</p>}
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
                {completedList.map((incident) => (
                  <li key={incident.id}>
                    <button
                      type="button"
                      className={`view-menu-item ${selectedIncident?.id === incident.id ? 'active' : ''}`}
                      onClick={() => setSelectedIncidentId(incident.id)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      <strong>{incident.type}</strong>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {incident.organization} · Abgeschlossen · {incident.generatedByStationName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {incident.reward} € · {formatDateTime(incident.completedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          {selectedIncident ? (
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
              <h3>{selectedIncident.type}</h3>
              <p><strong>Status:</strong> {selectedIncident.status}</p>
              <p><strong>Organisation:</strong> {selectedIncident.organization}</p>
              <p><strong>Adresse:</strong> {selectedIncident.address}</p>
              <p><strong>Erzeugt durch:</strong> {selectedIncident.generatedByStationName}</p>
              <p><strong>Belohnung:</strong> {selectedIncident.reward} €</p>

              {selectedIncident.status === 'Abgeschlossen' && (
                <>
                  <p><strong>Abschlusszeit:</strong> {formatDateTime(selectedIncident.completedAt ?? nowMs)}</p>
                  <p><strong>Einsatzdauer:</strong> {formatEtaLabel(selectedIncident.totalDurationSeconds ?? selectedIncident.durationSeconds)}</p>
                </>
              )}

              <h4>Benötigte Fahrzeuge</h4>
              <ul>
                {selectedIncident.requiredVehicles.map((requirement) => (
                  <li key={requirement.id}>{requirement.amount} × {requirement.category}</li>
                ))}
              </ul>

              <h4>Eingesetzte Fahrzeuge</h4>
              {selectedIncident.alarmedVehicles.length === 0 ? (
                <p>Keine Fahrzeuge eingesetzt.</p>
              ) : (
                <ul>
                  {selectedIncident.alarmedVehicles.map((assignment) => {
                    const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
                    const callSign = vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
                    const durationLabel = selectedIncident.status === 'Abgeschlossen'
                      ? `– ${callSign}`
                      : `– ${assignment.distanceKm.toFixed(1)} km – ${assignment.arrivalAt > nowMs ? `Ankunft in ${formatEtaLabel((assignment.arrivalAt - nowMs) / 1000)}` : 'angekommen'}`;

                    return (
                      <li key={assignment.vehicleId}>
                        {callSign}{durationLabel}
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedIncident.status !== 'Abgeschlossen' ? (
                <>
                  <h4>Verfügbare passende Fahrzeuge</h4>
                  {availableVehiclesForSelectedIncident.length === 0 ? (
                    <p>Aktuell kein geeignetes Fahrzeug verfügbar.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
                      {availableVehiclesForSelectedIncident.map((vehicle) => {
                        const vehicleStation = vehicle.stationId ? locations.find((loc) => loc.id === vehicle.stationId) : undefined;
                        const distanceKm = vehicleStation ? haversineKm(vehicleStation.coords, selectedIncident.coords) : 0;
                        const etaSeconds = Math.max(1, Math.round((distanceKm / 54) * 3600));
                        const checked = selectedVehicleIds.includes(vehicle.id);
                        return (
                          <li key={vehicle.id}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleVehicle(vehicle.id)} />
                              <span>
                                {vehicle.callsign ?? vehicle.name} – {vehicle.type} – {distanceKm.toFixed(1)} km – ca. {formatEtaLabel(etaSeconds)}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {selectedIncident.status === 'Offen' && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        className="btn btn--primary"
                        type="button"
                        onClick={() => alarmIncidentVehicles(selectedIncident.id, selectedVehicleIds)}
                        disabled={selectedVehicleIds.length === 0}
                      >
                        Alarmieren
                      </button>
                    </div>
                  )}

                  {selectedIncident.status === 'In Bearbeitung' && selectedIncident.processingEndsAt && (
                    <p><strong>Einsatz wird bearbeitet – noch</strong> {Math.max(0, Math.ceil((selectedIncident.processingEndsAt - Date.now()) / 1000))} Sek.</p>
                  )}
                </>
              ) : null}
            </div>
          ) : (
            <p>Kein Einsatz ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
