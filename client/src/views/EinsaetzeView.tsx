import { useEffect, useMemo, useState } from 'react';
import { isFmsAlarmable } from '@leitstellendispo/shared';
import type { MapLocation, StationStaffMember } from '../types';
import type { Vehicle } from './FahrzeugeView';
import { getVehicleCatalogEntry, vehicleMeetsRequirement, type VehicleRequirement } from '../vehicleCatalog';
import { selectCrewForVehicle } from '../stationState';
import { formatCurrency } from '../utils/formatCurrency';

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
  requiredVehicles: VehicleRequirement[];
  alarmedVehicles: Array<{ vehicleId: string; distanceKm: number; etaSeconds: number; arrivalAt: number }>;
  reward: number;
  durationSeconds: number;
  createdAt: number;
  processingStartedAt?: number;
  processingEndsAt?: number;
  completedAt?: number;
  totalDurationSeconds?: number;
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
  staffMembers,
  selectedIncidentId,
  setSelectedIncidentId,
  alarmIncidentVehicles,
  triggerTestIncident,
  nowMs,
  stats,
  initialTab,
}: {
  incidents: Incident[];
  completedIncidentHistory: CompletedIncidentHistoryEntry[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  staffMembers: StationStaffMember[];
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  alarmIncidentVehicles: (incidentId: string, selectedVehicleIds: string[]) => { success: boolean; error?: string };
  triggerTestIncident: () => void;
  nowMs: number;
  stats: { total: number; rettungsdienst: number; feuerwehr: number; earned: number };
  initialTab?: 'Aktive' | 'Abgeschlossen';
}) {
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Aktive' | 'Abgeschlossen'>(initialTab ?? 'Aktive');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (!selectedIncident || selectedIncident.status === 'Abgeschlossen') return [] as Array<{ vehicle: Vehicle; reason: string | null }>; 

    const alarmedVehicleIds = new Set(selectedIncident.alarmedVehicles.map((a) => a.vehicleId));
    const ownedStationIds = new Set(locations.filter((location) => location.type === 'station' && Boolean(location.owned ?? location.isOwned)).map((location) => location.id));

    return vehicles
      .filter((vehicle) => {
        if (alarmedVehicleIds.has(vehicle.id)) return false;
        if (!vehicle.stationId || !ownedStationIds.has(vehicle.stationId)) return false;
        return true;
      })
      .map((vehicle) => {
        const station = locations.find((location) => location.id === vehicle.stationId && location.type === 'station');
        const requiredCrewCount = Math.max(vehicle.crewRequired ?? getVehicleCatalogEntry(vehicle.type)?.technical.crewRequired ?? 1, 1);
        const stationStaff = staffMembers.filter((member) => member.stationId === vehicle.stationId && !member.inTraining && !member.assignedVehicleId);
        let reason: string | null = null;

        if (!station || !(station.owned ?? station.isOwned)) {
          reason = 'Fahrzeug gehört nicht zu einer eigenen Wache.';
        } else if (!isFmsAlarmable(vehicle.fmsStatus ?? 2, vehicle.previousOperationalStatus)) {
          reason = 'Fahrzeug ist derzeit nicht einsatzbereit.';
        } else if (stationStaff.length < requiredCrewCount) {
          reason = `Nur ${stationStaff.length}/${requiredCrewCount} verfügbare Einsatzkräfte in ${station.name}.`;
        } else {
          const requiredQualifications = getVehicleCatalogEntry(vehicle.type)?.technical.requiredQualifications ?? [];
          const crewSelection = selectCrewForVehicle(station, vehicle.type, new Set(), staffMembers, requiredCrewCount);
          if (requiredQualifications.length > 0 && (!crewSelection || crewSelection.length < requiredCrewCount)) {
            reason = `Qualifikation fehlt: ${requiredQualifications.join(', ')}`;
          }
        }

        return { vehicle, reason };
      })
      .sort((a, b) => {
        const aCoords = a.vehicle.stationId ? locations.find((loc) => loc.id === a.vehicle.stationId)?.coords : undefined;
        const bCoords = b.vehicle.stationId ? locations.find((loc) => loc.id === b.vehicle.stationId)?.coords : undefined;
        if (!aCoords || !bCoords) return 0;
        return haversineKm(aCoords, selectedIncident.coords) - haversineKm(bCoords, selectedIncident.coords);
      });
  }, [selectedIncident, vehicles, locations, staffMembers]);

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
    <div className="view-screen view-screen--incidents">
      <div className="screen-heading">
        <div><span className="eyebrow">Leitstellenbetrieb</span><h2>Einsätze</h2></div>
        <button className="btn btn--primary" type="button" onClick={triggerTestIncident}>＋ Test-Einsatz erzeugen</button>
      </div>
      <div className="incident-stats">
        <div className="metric-card metric-card--red">
          <div style={{ fontSize: 12, color: '#6b7280' }}>Abgeschlossen</div>
          <strong>{stats.total}</strong>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: 12, color: '#6b7280' }}>RD</div>
          <strong>{stats.rettungsdienst}</strong>
        </div>
        <div className="metric-card">
          <div style={{ fontSize: 12, color: '#6b7280' }}>FW</div>
          <strong>{stats.feuerwehr}</strong>
        </div>
        <div className="metric-card metric-card--money">
          <div style={{ fontSize: 12, color: '#6b7280' }}>Verdient</div>
          <strong>{formatCurrency(stats.earned)}</strong>
        </div>
      </div>

      <div className="incident-layout">
        <div className="section-panel incident-list-panel">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className={`btn ${activeTab === 'Aktive' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Aktive')}>Aktive Einsätze</button>
            <button type="button" className={`btn ${activeTab === 'Abgeschlossen' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Abgeschlossen')}>Abgeschlossen</button>
          </div>

          {activeTab === 'Aktive' ? (
            <>
              {visibleIncidents.length === 0 && <p>Keine offenen Einsätze.</p>}
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8, maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', minHeight: 0 }}>
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
                        {incident.organization} · {incident.generatedByStationName}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>
                        {formatCurrency(incident.reward)} · {incident.alarmedVehicles.length} alarmiert
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {completedList.length === 0 && <p>Keine abgeschlossenen Einsätze.</p>}
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8, maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', minHeight: 0 }}>
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
                        {formatCurrency(incident.reward)} · {formatDateTime(incident.completedAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="section-panel incident-detail-panel">
          {selectedIncident ? (
            <div className="incident-detail">
              <h3>{selectedIncident.type}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 12, color: '#9ca3af' }}>
                <div><strong>Status:</strong> {selectedIncident.status}</div>
                <div><strong>Belohnung:</strong> {formatCurrency(selectedIncident.reward)}</div>
              </div>

              {selectedIncident.status !== 'Abgeschlossen' && (
                <div style={{ padding: 8, backgroundColor: '#1f2937', borderRadius: 4, marginBottom: 12, fontSize: 12 }}>
                  <div style={{ marginBottom: 6 }}><strong>Anforderungen</strong></div>
                  {selectedIncident.requiredVehicles.map((requirement) => {
                    const alarmedCount = new Set(
                      selectedIncident.alarmedVehicles
                        .map((a) => vehicles.find((v) => v.id === a.vehicleId))
                        .filter((v) => v && vehicleMeetsRequirement(v.type, requirement))
                        .map((v) => v!.id)
                    ).size;
                    const missing = Math.max(0, requirement.amount - alarmedCount);
                    const status = missing === 0 ? '✓' : `${missing}×`;
                    return (
                      <div key={requirement.id} style={{ display: 'flex', justifyContent: 'space-between', color: missing > 0 ? '#f87171' : '#86efac' }}>
                        <span>{requirement.label}</span>
                        <span>{status} ({alarmedCount}/{requirement.amount})</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <h4>Eingesetzte Fahrzeuge ({selectedIncident.alarmedVehicles.length})</h4>
              {selectedIncident.alarmedVehicles.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af' }}>Keine Fahrzeuge eingesetzt.</p>
              ) : (
                <ul style={{ fontSize: 12, lineHeight: 1.6 }}>
                  {selectedIncident.alarmedVehicles.map((assignment) => {
                    const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
                    const callSign = vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
                    const status = selectedIncident.status === 'Abgeschlossen'
                      ? 'abgeschlossen'
                      : assignment.arrivalAt > nowMs
                        ? `Ankunft in ${formatEtaLabel((assignment.arrivalAt - nowMs) / 1000)}`
                        : 'vor Ort';

                    return (
                      <li key={assignment.vehicleId} style={{ color: assignment.arrivalAt > nowMs ? '#fbbf24' : '#10b981' }}>
                        {callSign} – {status}
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedIncident.status !== 'Abgeschlossen' ? (
                <>
                  <h4>Verfügbare Fahrzeuge</h4>
                  {availableVehiclesForSelectedIncident.length === 0 ? (
                    <p>Aktuell kein Fahrzeug verfügbar.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
                      {availableVehiclesForSelectedIncident.map(({ vehicle, reason }) => {
                        const vehicleStation = vehicle.stationId ? locations.find((loc) => loc.id === vehicle.stationId) : undefined;
                        const distanceKm = vehicleStation ? haversineKm(vehicleStation.coords, selectedIncident.coords) : 0;
                        const etaSeconds = Math.max(1, Math.round((distanceKm / 54) * 3600));
                        const checked = selectedVehicleIds.includes(vehicle.id);
                        const isRequired = selectedIncident.requiredVehicles.some((req) => vehicleMeetsRequirement(vehicle.type, req));
                        const isDisabled = Boolean(reason);
                        return (
                          <li key={vehicle.id}>
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 12,
                              padding: isRequired ? '10px 12px' : '8px 10px',
                              backgroundColor: isDisabled ? 'rgba(148, 163, 184, 0.08)' : isRequired ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.05)',
                              border: isDisabled ? '1px solid rgba(251, 191, 36, 0.2)' : isRequired ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(107, 114, 128, 0.15)',
                              borderRadius: '4px',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              opacity: isDisabled ? 0.7 : 1,
                              transition: 'all 0.2s'
                            }}>
                              <input type="checkbox" checked={checked} onChange={() => !isDisabled && toggleVehicle(vehicle.id)} disabled={isDisabled} style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }} />
                              <span style={{ fontSize: 13, fontWeight: isRequired ? 500 : 400, color: isRequired ? '#fff' : '#d1d5db', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span>{vehicle.callsign ?? vehicle.name} – {vehicle.type}</span>
                                <small style={{ color: '#9ca3af' }}>{vehicleStation?.name ?? 'Unbekannte Wache'} · {distanceKm.toFixed(1)} km · ca. {formatEtaLabel(etaSeconds)}</small>
                                {reason && <small style={{ color: '#fbbf24' }}>{reason}</small>}
                              </span>
                              {isRequired && !isDisabled && <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#86efac', padding: '2px 6px', borderRadius: '3px', fontSize: 12, fontWeight: 500 }}>Benötigt</span>}
                              {!isRequired && !isDisabled && <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(107, 114, 128, 0.2)', color: '#d1d5db', padding: '2px 6px', borderRadius: '3px', fontSize: 12, fontWeight: 400 }}>Zusätzlich</span>}
                              {isDisabled && <span style={{ marginLeft: 'auto', backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '2px 6px', borderRadius: '3px', fontSize: 12, fontWeight: 500 }}>Nicht verfügbar</span>}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {selectedIncident.status === 'Offen' && (
                    <div style={{ marginTop: 12 }}>
                      {errorMessage && (
                        <div style={{ marginBottom: 8, padding: '8px 12px', backgroundColor: '#991b1b', color: '#fca5a5', borderRadius: 4, fontSize: 14 }}>
                          {errorMessage}
                        </div>
                      )}
                      <button
                        className="btn btn--primary"
                        type="button"
                        onClick={() => {
                          const result = alarmIncidentVehicles(selectedIncident.id, selectedVehicleIds);
                          if (result.success) {
                            setErrorMessage(null);
                            setSelectedVehicleIds([]);
                          } else {
                            setErrorMessage(result.error ?? 'Unbekannter Fehler');
                          }
                        }}
                        disabled={selectedVehicleIds.length === 0}
                      >
                        Alarmieren
                      </button>
                    </div>
                  )}

                  {(selectedIncident.status === 'Fahrzeuge alarmiert' || selectedIncident.status === 'In Bearbeitung') && (
                    <div style={{ marginTop: 12 }}>
                      {errorMessage && (
                        <div style={{ marginBottom: 8, padding: '8px 12px', backgroundColor: '#991b1b', color: '#fca5a5', borderRadius: 4, fontSize: 14 }}>
                          {errorMessage}
                        </div>
                      )}
                      <button
                        className="btn btn--primary"
                        type="button"
                        onClick={() => {
                          const result = alarmIncidentVehicles(selectedIncident.id, selectedVehicleIds);
                          if (result.success) {
                            setErrorMessage(null);
                            setSelectedVehicleIds([]);
                          } else {
                            setErrorMessage(result.error ?? 'Unbekannter Fehler');
                          }
                        }}
                        disabled={selectedVehicleIds.length === 0}
                      >
                        Weitere Kräfte alarmieren
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
