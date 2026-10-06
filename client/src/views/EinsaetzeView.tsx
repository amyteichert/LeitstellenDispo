import { useEffect, useMemo, useState } from 'react';
import {
  EINSATZ_STATUS_LABELS,
  formatEinsatzTitel,
  getBedarfsAbdeckung,
  getFahrzeitSekunden,
  getFahrzeugKategorie,
  haversineKm,
  istFahrzeugVerfuegbar,
  type AbgeschlossenerSpielEinsatz,
  type SpielEinsatz,
} from '@leitstellendispo/shared';
import type { MapLocation, Vehicle } from '../types';

const formatEtaLabel = (seconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds >= 60) {
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${totalSeconds} Sek.`;
};

export default function EinsaetzeView({
  incidents,
  completedIncidentHistory,
  vehicles,
  locations,
  selectedIncidentId,
  setSelectedIncidentId,
  alarmIncidentVehicles,
  markiereMeldungGelesen,
  triggerTestIncident,
  nowMs,
  stats,
}: {
  incidents: SpielEinsatz[];
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  alarmIncidentVehicles: (incidentId: string, selectedVehicleIds: string[]) => void;
  markiereMeldungGelesen: (incidentId: string) => void;
  triggerTestIncident: () => void;
  nowMs: number;
  stats: { total: number; rettungsdienst: number; feuerwehr: number; earned: number };
}) {
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'Aktive' | 'Abgeschlossen'>('Aktive');
  const [rueckmeldung, setRueckmeldung] = useState<string | null>(null);

  // Rückmeldung nach einer Aktion nach ein paar Sekunden wieder ausblenden
  useEffect(() => {
    if (!rueckmeldung) return;
    const timeout = setTimeout(() => setRueckmeldung(null), 4000);
    return () => clearTimeout(timeout);
  }, [rueckmeldung]);

  useEffect(() => {
    setSelectedVehicleIds([]);
    setRueckmeldung(null);
  }, [selectedIncidentId]);

  const selectedIncident = useMemo(
    () => incidents.find((incident) => incident.id === selectedIncidentId)
      ?? completedIncidentHistory.find((incident) => incident.id === selectedIncidentId)
      ?? (activeTab === 'Aktive' ? incidents[0] ?? null : completedIncidentHistory[0] ?? null),
    [incidents, completedIncidentHistory, selectedIncidentId, activeTab],
  );

  // Neue Lagemeldung gilt als gelesen, sobald der Einsatz hier angezeigt wird
  useEffect(() => {
    if (selectedIncident && 'neueMeldung' in selectedIncident && selectedIncident.neueMeldung) {
      markiereMeldungGelesen(selectedIncident.id);
    }
  }, [selectedIncident]);

  const availableVehiclesForSelectedIncident = useMemo(() => {
    if (!selectedIncident || selectedIncident.status === 'abgeschlossen') return [] as Vehicle[];

    return vehicles.filter((vehicle) => {
      if (!istFahrzeugVerfuegbar(vehicle, incidents)) return false;
      const category = getFahrzeugKategorie(vehicle.type);
      if (!category) return false;
      return selectedIncident.requiredVehicles.some((requirement) => requirement.category === category);
    }).sort((a, b) => {
      const aCoords = a.stationId ? locations.find((loc) => loc.id === a.stationId)?.coords : undefined;
      const bCoords = b.stationId ? locations.find((loc) => loc.id === b.stationId)?.coords : undefined;
      if (!aCoords || !bCoords) return 0;
      return haversineKm(aCoords, selectedIncident.coords) - haversineKm(bCoords, selectedIncident.coords);
    });
  }, [selectedIncident, vehicles, locations, incidents]);

  // Häkchen bei Fahrzeugen entfernen, die inzwischen nicht mehr verfügbar sind
  useEffect(() => {
    setSelectedVehicleIds((current) => {
      const verfuegbar = current.filter((id) => availableVehiclesForSelectedIncident.some((vehicle) => vehicle.id === id));
      return verfuegbar.length === current.length ? current : verfuegbar;
    });
  }, [availableVehiclesForSelectedIncident]);

  const kannAlarmieren = selectedIncident?.status === 'offen' || selectedIncident?.status === 'alarmiert';

  // Wie viele Fahrzeuge je Kategorie sind dem Einsatz bereits zugeteilt?
  const abdeckung = selectedIncident ? getBedarfsAbdeckung(selectedIncident, vehicles) : [];
  const getAlarmierteAnzahl = (category: string) => abdeckung.find((eintrag) => eintrag.category === category)?.alarmiert ?? 0;

  // Alarmierungsvorschlag: je Anforderung die nächstgelegenen freien Fahrzeuge, die noch fehlen
  const alarmVorschlag = useMemo(() => {
    if (!selectedIncident || !kannAlarmieren) return [] as string[];
    return selectedIncident.requiredVehicles.flatMap((requirement) => {
      const fehlend = Math.max(0, requirement.amount - getAlarmierteAnzahl(requirement.category));
      return availableVehiclesForSelectedIncident
        .filter((vehicle) => getFahrzeugKategorie(vehicle.type) === requirement.category)
        .slice(0, fehlend)
        .map((vehicle) => vehicle.id);
    });
  }, [selectedIncident, kannAlarmieren, availableVehiclesForSelectedIncident, vehicles]);

  const alarmieren = () => {
    if (!selectedIncident) return;
    alarmIncidentVehicles(selectedIncident.id, selectedVehicleIds);
    // Rückmeldung nur zur Anzeige: welche Fahrzeuge wurden alarmiert?
    const namen = selectedVehicleIds.map((id) => {
      const vehicle = vehicles.find((item) => item.id === id);
      return vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
    });
    setRueckmeldung(`✓ ${namen.join(', ')} ${namen.length === 1 ? 'wurde' : 'wurden'} alarmiert.`);
    setSelectedVehicleIds([]);
  };

  const visibleIncidents = incidents.filter((incident) => incident.status !== 'abgeschlossen');
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
        <div style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Abgeschlossen</div>
          <strong>{stats.total}</strong>
        </div>
        <div style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>RD</div>
          <strong>{stats.rettungsdienst}</strong>
        </div>
        <div style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>FW</div>
          <strong>{stats.feuerwehr}</strong>
        </div>
        <div style={{ background: 'var(--color-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Verdient</div>
          <strong>{stats.earned} €</strong>
        </div>
      </div>

      <div className="einsatz-layout">
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button type="button" className={`btn ${activeTab === 'Aktive' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Aktive')}>
              Aktive Einsätze ({visibleIncidents.length})
            </button>
            <button type="button" className={`btn ${activeTab === 'Abgeschlossen' ? 'btn--primary' : ''}`} onClick={() => setActiveTab('Abgeschlossen')}>Abgeschlossen</button>
          </div>

          {activeTab === 'Aktive' ? (
            <>
              {visibleIncidents.length === 0 && (
                <div className="leerzustand">
                  <strong>Keine aktiven Einsätze</strong>
                  Neue Einsätze gehen automatisch ein – du hörst einen Gong und siehst eine Einblendung.
                </div>
              )}
              <ul className="einsatz-liste">
                {visibleIncidents.map((incident) => {
                  const abdeckungEintrag = getBedarfsAbdeckung(incident, vehicles);
                  const benoetigt = abdeckungEintrag.reduce((summe, eintrag) => summe + eintrag.amount, 0);
                  const zugeteilt = abdeckungEintrag.reduce((summe, eintrag) => summe + Math.min(eintrag.alarmiert, eintrag.amount), 0);
                  return (
                    <li key={incident.id}>
                      <button
                        type="button"
                        className={`einsatz-eintrag einsatz-eintrag--${incident.status} ${selectedIncident?.id === incident.id ? 'einsatz-eintrag--aktiv' : ''}`}
                        onClick={() => setSelectedIncidentId(incident.id)}
                      >
                        <span className="einsatz-eintrag__kopf">
                          <strong>{formatEinsatzTitel(incident)}</strong>
                          <span className={`status-badge status-badge--${incident.status}`}>{EINSATZ_STATUS_LABELS[incident.status]}</span>
                        </span>
                        {incident.neueMeldung && <span className="neue-meldung-badge" style={{ marginLeft: 0, width: 'fit-content' }}>⚠ Neue Meldung</span>}
                        <span className="einsatz-eintrag__zeile">{incident.organization} · {incident.address}</span>
                        <span className="einsatz-eintrag__zeile">Fahrzeuge {zugeteilt}/{benoetigt} · {incident.reward} €</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              {completedList.length === 0 && (
                <div className="leerzustand">
                  <strong>Noch keine abgeschlossenen Einsätze</strong>
                  Abgeschlossene Einsätze und deine Einnahmen erscheinen hier.
                </div>
              )}
              <ul className="einsatz-liste">
                {completedList.map((incident) => (
                  <li key={incident.id}>
                    <button
                      type="button"
                      className={`einsatz-eintrag einsatz-eintrag--abgeschlossen ${selectedIncident?.id === incident.id ? 'einsatz-eintrag--aktiv' : ''}`}
                      onClick={() => setSelectedIncidentId(incident.id)}
                    >
                      <span className="einsatz-eintrag__kopf">
                        <strong>{formatEinsatzTitel(incident)}</strong>
                        <span className="status-badge status-badge--abgeschlossen">Abgeschlossen</span>
                      </span>
                      <span className="einsatz-eintrag__zeile">{incident.organization} · {incident.generatedByStationName}</span>
                      <span className="einsatz-eintrag__zeile">{incident.reward} € · {formatDateTime(incident.completedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          {selectedIncident ? (
            <div className="einsatz-details">
              <div className="einsatz-details__kopf">
                <h3>{formatEinsatzTitel(selectedIncident)}</h3>
                <span className={`status-badge status-badge--${selectedIncident.status}`}>{EINSATZ_STATUS_LABELS[selectedIncident.status]}</span>
              </div>

              {selectedIncident.meldungen.length > 0 && (
                <div className="einsatz-meldungen">
                  <h4>⚠ Lagemeldungen</h4>
                  <ul>
                    {[...selectedIncident.meldungen].reverse().map((meldung) => (
                      <li key={meldung.zeit}>
                        <span>{new Date(meldung.zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span> {meldung.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rueckmeldung && <div className="aktion-rueckmeldung" role="status">{rueckmeldung}</div>}

              {selectedIncident.status === 'in_bearbeitung' && selectedIncident.processingEndsAt && selectedIncident.processingStartedAt && (
                <div className="bearbeitung-fortschritt">
                  <span><strong>Einsatz wird bearbeitet</strong> – noch {Math.max(0, Math.ceil((selectedIncident.processingEndsAt - Date.now()) / 1000))} Sek.</span>
                  <div className="bearbeitung-fortschritt__balken">
                    <span style={{ width: `${Math.min(100, Math.max(0, ((nowMs - selectedIncident.processingStartedAt) / (selectedIncident.processingEndsAt - selectedIncident.processingStartedAt)) * 100))}%` }} />
                  </div>
                </div>
              )}

              <section className="einsatz-abschnitt">
                <h4>Fahrzeugbedarf</h4>
                <ul className="bedarf-liste">
                  {selectedIncident.requiredVehicles.map((requirement) => {
                    const alarmiert = Math.min(getAlarmierteAnzahl(requirement.category), requirement.amount);
                    const erfuellt = alarmiert >= requirement.amount;
                    return (
                      <li key={requirement.id} className={`bedarf-chip ${erfuellt ? 'bedarf-chip--erfuellt' : 'bedarf-chip--fehlt'}`}>
                        {requirement.category}: {alarmiert}/{requirement.amount} {erfuellt ? '✓' : ''}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {kannAlarmieren ? (
                <section className="einsatz-abschnitt">
                  <h4>Verfügbare passende Fahrzeuge</h4>
                  {availableVehiclesForSelectedIncident.length === 0 ? (
                    <div className="leerzustand">
                      <strong>Aktuell kein geeignetes Fahrzeug verfügbar.</strong>
                      Warte, bis Fahrzeuge zurück an der Wache sind, oder kaufe unter „Wachen“ weitere Fahrzeuge.
                    </div>
                  ) : (
                    <ul className="fahrzeug-auswahl">
                      {availableVehiclesForSelectedIncident.map((vehicle) => {
                        const vehicleStation = vehicle.stationId ? locations.find((loc) => loc.id === vehicle.stationId) : undefined;
                        const distanceKm = vehicleStation ? haversineKm(vehicleStation.coords, selectedIncident.coords) : 0;
                        const etaSeconds = vehicleStation ? getFahrzeitSekunden(vehicleStation.coords, selectedIncident.coords) : 1;
                        const checked = selectedVehicleIds.includes(vehicle.id);
                        return (
                          <li key={vehicle.id}>
                            <label>
                              <input type="checkbox" checked={checked} onChange={() => toggleVehicle(vehicle.id)} />
                              <span>
                                <strong>{vehicle.callsign ?? vehicle.name}</strong> – {vehicle.type}
                                <small>{distanceKm.toFixed(1)} km · ca. {formatEtaLabel(etaSeconds)} · {vehicleStation?.name ?? ''}</small>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => setSelectedVehicleIds(alarmVorschlag)}
                      disabled={alarmVorschlag.length === 0}
                    >
                      Vorschlag
                    </button>
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={alarmieren}
                      disabled={selectedVehicleIds.length === 0}
                    >
                      {selectedIncident.status === 'alarmiert' ? 'Nachalarmieren' : 'Alarmieren'}
                      {selectedVehicleIds.length > 0 ? ` (${selectedVehicleIds.length})` : ''}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="einsatz-abschnitt">
                <h4>Eingesetzte Fahrzeuge</h4>
                {selectedIncident.alarmedVehicles.length === 0 ? (
                  <p className="einsatz-eintrag__zeile">Noch keine Fahrzeuge alarmiert.</p>
                ) : (
                  <ul className="einsatz-fahrzeuge">
                    {selectedIncident.alarmedVehicles.map((assignment) => {
                      const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
                      const callSign = vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug';
                      const durationLabel = selectedIncident.status === 'abgeschlossen'
                        ? ''
                        : `${assignment.distanceKm.toFixed(1)} km – ${assignment.arrivalAt > nowMs ? `Ankunft in ${formatEtaLabel((assignment.arrivalAt - nowMs) / 1000)}` : 'angekommen'}`;

                      return (
                        <li key={assignment.vehicleId}>
                          <strong>{callSign}</strong> {durationLabel && <span>– {durationLabel}</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <dl className="einsatz-infos">
                <div><dt>Organisation</dt><dd>{selectedIncident.organization}</dd></div>
                <div><dt>Adresse</dt><dd>{selectedIncident.address}</dd></div>
                <div><dt>Erzeugt durch</dt><dd>{selectedIncident.generatedByStationName}</dd></div>
                <div><dt>Belohnung</dt><dd>{selectedIncident.reward} €</dd></div>
                {selectedIncident.status === 'abgeschlossen' && (
                  <>
                    <div><dt>Abschlusszeit</dt><dd>{formatDateTime(selectedIncident.completedAt ?? nowMs)}</dd></div>
                    <div><dt>Einsatzdauer</dt><dd>{formatEtaLabel(selectedIncident.totalDurationSeconds ?? selectedIncident.durationSeconds)}</dd></div>
                  </>
                )}
              </dl>
            </div>
          ) : (
            <div className="leerzustand">
              <strong>Kein Einsatz ausgewählt</strong>
              Wähle links einen Einsatz aus, um Details zu sehen und Fahrzeuge zu alarmieren.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
