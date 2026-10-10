import { useEffect, useMemo, useState } from 'react';
import {
  EINSATZ_STATUS_LABELS,
  FMS_STATUS,
  PATIENTEN_STATUS_LABELS,
  PATIENTEN_ZUSTAND_LABELS,
  erstelleAlarmVorschlag,
  formatBedarfsListe,
  formatEinsatzTitel,
  getBedarfsLabel,
  getEinsatzVersorgung,
  getVerfuegbareFahrzeugeFuerEinsatz,
  istAusreichendBesetzt,
  getMeldungKey,
  getVerborgeneMeldungen,
  type FunkSpruch,
  istWichtigeMeldung,
  type AbgeschlossenerSpielEinsatz,
  type EinsatzMeldung,
  type SpielEinsatz,
  getBearbeitungsMs,
} from '@leitstellendispo/shared';
import EinsatzAbgabe from './EinsatzAbgabe';
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

const formatUhrzeit = (zeit: number) => new Date(zeit).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const MELDUNG_SYMBOL: Record<NonNullable<EinsatzMeldung['art']>, string> = {
  eskalation: '⚠',
  nachforderung: '📣',
  entwarnung: '↩',
  lage: '📍',
  patient: '🩺',
  abschluss: '✓',
};

/** Was macht ein dem Einsatz zugeteiltes Fahrzeug gerade? */
const beschreibeZuteilung = (incident: SpielEinsatz, assignment: SpielEinsatz['alarmedVehicles'][number], nowMs: number) => {
  if (assignment.freigegebenAt !== undefined) return 'entlassen – Rückfahrt zur Wache';
  const transport = incident.patienten?.find((p) => p.transport?.fahrzeugId === assignment.vehicleId)?.transport;
  if (transport && nowMs >= transport.startAt) {
    return nowMs < transport.ankunftAt
      ? `Transport → ${transport.krankenhausName} (Ankunft in ${formatEtaLabel((transport.ankunftAt - nowMs) / 1000)})`
      : `Übergabe in ${transport.krankenhausName}`;
  }
  if (assignment.arrivalAt > nowMs) return `${assignment.distanceKm.toFixed(1)} km – Ankunft in ${formatEtaLabel((assignment.arrivalAt - nowMs) / 1000)}`;
  return 'vor Ort';
};

export default function EinsaetzeView({
  incidents,
  completedIncidentHistory,
  vehicles,
  locations,
  selectedIncidentId,
  setSelectedIncidentId,
  alarmIncidentVehicles,
  gibEinsatzAb,
  markiereMeldungGelesen,
  triggerTestIncident,
  nowMs,
  stats,
  funk,
  onSprechaufforderung,
}: {
  funk: FunkSpruch[];
  onSprechaufforderung: (sprechwunschId: string) => void;
  incidents: SpielEinsatz[];
  completedIncidentHistory: AbgeschlossenerSpielEinsatz[];
  vehicles: Vehicle[];
  locations: MapLocation[];
  selectedIncidentId: string | null;
  setSelectedIncidentId: (id: string | null) => void;
  alarmIncidentVehicles: (incidentId: string, selectedVehicleIds: string[]) => void;
  gibEinsatzAb: (incidentId: string) => void;
  markiereMeldungGelesen: (incidentId: string) => void;
  /** Nur für Team-Rollen gesetzt – ohne wird der Test-Knopf nicht angezeigt */
  triggerTestIncident?: () => void | Promise<void>;
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

  const kannAlarmieren = selectedIncident?.status === 'offen' || selectedIncident?.status === 'alarmiert';

  const passendeFahrzeuge = useMemo(
    () => (selectedIncident && kannAlarmieren ? getVerfuegbareFahrzeugeFuerEinsatz(selectedIncident, { incidents, vehicles, locations }) : []),
    [selectedIncident, kannAlarmieren, vehicles, locations, incidents],
  );

  // Häkchen bei Fahrzeugen entfernen, die inzwischen nicht mehr verfügbar sind
  useEffect(() => {
    setSelectedVehicleIds((current) => {
      const verfuegbar = current.filter((id) => passendeFahrzeuge.some((eintrag) => eintrag.vehicle.id === id));
      return verfuegbar.length === current.length ? current : verfuegbar;
    });
  }, [passendeFahrzeuge]);

  // Alarmierungsvorschlag: deckt den noch fehlenden Bedarf mit den schnellsten freien Fahrzeugen
  const alarmVorschlag = useMemo(
    () => (selectedIncident ? erstelleAlarmVorschlag(selectedIncident, { incidents, vehicles, locations }) : { fahrzeugIds: [], nichtVerfuegbar: [] }),
    [selectedIncident, vehicles, locations, incidents],
  );

  const versorgung = selectedIncident ? getEinsatzVersorgung(selectedIncident, vehicles, nowMs) : null;
  // Fahrzeuge an der Wache, die nur wegen fehlender Besatzung nicht alarmierbar sind
  const unbesetzteAnWache = vehicles.filter((vehicle) => vehicle.stationId && (vehicle.status ?? 'Einsatzbereit') === 'Einsatzbereit'
    && !vehicle.rueckfahrt && !istAusreichendBesetzt(vehicle)).length;

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

  const hatWichtigeMeldung = selectedIncident?.meldungen.some(istWichtigeMeldung) ?? false;
  const verborgeneMeldungen = useMemo(() => getVerborgeneMeldungen(funk), [funk]);

  return (
    <div>
      <h2>Einsätze</h2>
      {triggerTestIncident && (
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn--secondary" type="button" onClick={() => void triggerTestIncident()}>🧪 Test-Einsatz erzeugen</button>
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
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

      {!locations.some((location) => location.type === 'station') && (
        <div className="leerzustand">
          <strong>Noch keine Wache – noch keine Notrufe</strong>
          Baue zuerst auf der Karte deine erste Wache. Danach gehen die Notrufe aus der Umgebung bei dir ein.
        </div>
      )}
      <div className="einsatz-layout" data-tour="einsatz-liste">
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
                  const { abdeckung, ausreichendAlarmiert } = getEinsatzVersorgung(incident, vehicles, nowMs);
                  const benoetigt = abdeckung.reduce((summe, eintrag) => summe + eintrag.amount, 0);
                  const vorOrt = abdeckung.reduce((summe, eintrag) => summe + eintrag.vorOrt, 0);
                  const alarmiert = abdeckung.reduce((summe, eintrag) => summe + eintrag.alarmiert, 0);
                  const unterversorgt = (incident.status === 'offen' || incident.status === 'alarmiert') && !ausreichendAlarmiert;
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
                        <span className="einsatz-eintrag__zeile">📍 {incident.address}</span>
                        <span className="einsatz-eintrag__zeile">
                          {incident.organization} · Fahrzeuge {alarmiert}/{benoetigt} alarmiert, {vorOrt} vor Ort · {incident.reward} €
                          {unterversorgt && <strong style={{ color: 'var(--color-primary-text)' }}> · Kräfte fehlen!</strong>}
                        </span>
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
                      <span className="einsatz-eintrag__zeile">📍 {incident.address}</span>
                      <span className="einsatz-eintrag__zeile">{incident.organization} · {incident.reward} €{incident.bewertung?.bonus ? ` + ${incident.bewertung.bonus} € Bonus` : ''} · {formatDateTime(incident.completedAt)}</span>
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
                <div>
                  <h3>{formatEinsatzTitel(selectedIncident)}</h3>
                  <div className="einsatz-eintrag__zeile" style={{ fontSize: '0.95rem', marginTop: 2 }}>📍 {selectedIncident.address}</div>
                </div>
                <span className={`status-badge status-badge--${selectedIncident.status}`}>{EINSATZ_STATUS_LABELS[selectedIncident.status]}</span>
              </div>

              {selectedIncident.meldungen.length > 0 && (
                <div className="einsatz-meldungen" style={hatWichtigeMeldung ? undefined : { background: 'var(--color-surface-raised)', borderLeftColor: 'var(--color-border-strong)' }}>
                  <h4>{hatWichtigeMeldung ? '⚠ Lagemeldungen' : 'Lagemeldungen'}</h4>
                  <ul>
                    {[...selectedIncident.meldungen].reverse().map((meldung, index) => {
                      const sprechwunsch = verborgeneMeldungen.get(getMeldungKey(selectedIncident.id, meldung));
                      return sprechwunsch ? (
                        <li key={`${meldung.zeit}-${index}`} data-art="sprechwunsch">
                          <span className="meldung-zeit">{formatUhrzeit(meldung.zeit)}</span>
                          📻 <strong>{sprechwunsch.von}</strong> hat Sprechwunsch (Status 5).{' '}
                          <button type="button" className="btn btn--primary" onClick={() => onSprechaufforderung(sprechwunsch.id)}>
                            Sprechaufforderung
                          </button>
                        </li>
                      ) : (
                        <li key={`${meldung.zeit}-${index}`} data-art={meldung.art ?? 'eskalation'}>
                          <span className="meldung-zeit">{formatUhrzeit(meldung.zeit)}</span>
                          {MELDUNG_SYMBOL[meldung.art ?? 'eskalation']} {meldung.text}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {rueckmeldung && <div className="aktion-rueckmeldung" role="status">{rueckmeldung}</div>}

              {versorgung && kannAlarmieren && (
                !versorgung.ausreichendAlarmiert ? (
                  <div className="versorgung-hinweis versorgung-hinweis--fehlt">
                    <strong>Nicht ausreichend versorgt.</strong> Es fehlen: {formatBedarfsListe(versorgung.fehlendAlarmiert)}.
                  </div>
                ) : !versorgung.ausreichendVorOrt ? (
                  <div className="versorgung-hinweis versorgung-hinweis--unterwegs">
                    Alle benötigten Fahrzeuge sind alarmiert – noch auf Anfahrt: {formatBedarfsListe(versorgung.fehlendVorOrt)}.
                  </div>
                ) : null
              )}

              {selectedIncident.status === 'in_bearbeitung' && selectedIncident.processingEndsAt && selectedIncident.processingStartedAt && (
                <div className="bearbeitung-fortschritt">
                  <span>
                    <strong>{selectedIncident.organization === 'Rettungsdienst' || selectedIncident.patienten?.length ? 'Patientenversorgung vor Ort' : 'Einsatz wird abgearbeitet'}</strong>
                    {' '}– noch {formatEtaLabel((selectedIncident.processingEndsAt - nowMs) / 1000)}
                  </span>
                  <div className="bearbeitung-fortschritt__balken">
                    <span style={{ width: `${Math.min(100, Math.max(0, ((nowMs - selectedIncident.processingStartedAt) / (selectedIncident.processingEndsAt - selectedIncident.processingStartedAt)) * 100))}%` }} />
                  </div>
                </div>
              )}

              <section className="einsatz-abschnitt">
                {selectedIncident.meldungUnklar && selectedIncident.erstesEintreffenAt === undefined ? (
                  <>
                    <h4>Empfohlene Kräfte</h4>
                    <div className="versorgung-hinweis versorgung-hinweis--unterwegs">
                      ❓ <strong>Meldung unklar.</strong> Die Lage kann sich vor Ort als größer oder kleiner herausstellen.
                    </div>
                  </>
                ) : (
                  <h4>Fahrzeugbedarf</h4>
                )}
                <ul className="bedarf-liste">
                  {(versorgung?.abdeckung ?? []).map((eintrag, index) => {
                    const fertig = selectedIncident.status === 'transport' || selectedIncident.status === 'abgeschlossen';
                    const klasse = fertig || eintrag.vorOrt >= eintrag.amount
                      ? 'bedarf-chip--erfuellt'
                      : eintrag.alarmiert >= eintrag.amount ? 'bedarf-chip--unterwegs' : 'bedarf-chip--fehlt';
                    return (
                      <li key={`${eintrag.category}-${index}`} className={`bedarf-chip ${klasse}`}>
                        {getBedarfsLabel(eintrag.category)}: {eintrag.alarmiert}/{eintrag.amount}
                        {!fertig && eintrag.alarmiert > 0 && <small> ({eintrag.vorOrt} vor Ort)</small>}
                        {klasse === 'bedarf-chip--erfuellt' ? ' ✓' : ''}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {selectedIncident.patienten && selectedIncident.patienten.length > 0 && (
                <section className="einsatz-abschnitt">
                  <h4>Patienten ({selectedIncident.patienten.length})</h4>
                  <ul className="patienten-liste">
                    {selectedIncident.patienten.map((patient, index) => (
                      <li key={patient.id}>
                        <span>
                          <strong>Patient {index + 1}</strong> –{' '}
                          <span className={`patient-zustand--${patient.zustand}`}>{PATIENTEN_ZUSTAND_LABELS[patient.zustand]}</span>
                        </span>
                        <small>
                          {PATIENTEN_STATUS_LABELS[patient.status]}
                          {patient.transport ? ` · Ziel: ${patient.transport.krankenhausName}` : ''}
                          {patient.status === 'transport' && patient.transport ? ` · Ankunft in ${formatEtaLabel((patient.transport.ankunftAt - nowMs) / 1000)}` : ''}
                        </small>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {kannAlarmieren ? (
                <section className="einsatz-abschnitt">
                  <h4>Verfügbare Fahrzeuge</h4>
                  {passendeFahrzeuge.length === 0 ? (
                    <div className="leerzustand">
                      <strong>Aktuell kein geeignetes Fahrzeug verfügbar.</strong>
                      Warte, bis Fahrzeuge zurück an der Wache sind, oder kaufe unter „Wachen“ weitere Fahrzeuge.
                    </div>
                  ) : (
                    <ul className="fahrzeug-auswahl">
                      {passendeFahrzeuge.map(({ vehicle, station, distanzKm, anfahrtSekunden, passend }) => (
                        <li key={vehicle.id} style={passend ? undefined : { opacity: 0.75 }}>
                          <label>
                            <input type="checkbox" checked={selectedVehicleIds.includes(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} />
                            <span>
                              <strong>{vehicle.callsign ?? vehicle.name}</strong> – {vehicle.type}
                              <small>
                                {distanzKm.toFixed(1)} km · ca. {formatEtaLabel(anfahrtSekunden)} · {station?.name ?? ''}
                                {!passend && ' · zählt nicht zum Bedarf'}
                              </small>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}

                  {unbesetzteAnWache > 0 && (
                    <p className="einsatz-eintrag__zeile">
                      {unbesetzteAnWache} Fahrzeug(e) ohne vollständige Besatzung sind nicht alarmierbar (Wachen › Verwalten › Personal).
                    </p>
                  )}

                  {alarmVorschlag.nichtVerfuegbar.length > 0 && (
                    <div className="versorgung-hinweis versorgung-hinweis--fehlt">
                      Kein freies Fahrzeug für: {formatBedarfsListe(alarmVorschlag.nichtVerfuegbar)}.
                    </div>
                  )}

                  {/* Nur ein Hinweis – auswählen muss der Disponent selbst */}
                  {alarmVorschlag.fahrzeugIds.length > 0 && (
                    <div className="versorgung-hinweis versorgung-hinweis--unterwegs">
                      💡 <strong>Vorschlag:</strong>{' '}
                      {alarmVorschlag.fahrzeugIds
                        .map((id) => vehicles.find((vehicle) => vehicle.id === id))
                        .map((vehicle) => vehicle?.callsign ?? vehicle?.name ?? 'Fahrzeug')
                        .join(', ')}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                  <EinsatzAbgabe incident={selectedIncident} vehicles={vehicles} onAbgeben={() => gibEinsatzAb(selectedIncident.id)} />
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
                      const fms = vehicle?.status ? FMS_STATUS[vehicle.status] : undefined;
                      return (
                        <li key={assignment.vehicleId}>
                          <strong>{callSign}</strong>
                          {selectedIncident.status !== 'abgeschlossen' && (
                            <span> – {fms !== undefined ? `S${fms} · ` : ''}{beschreibeZuteilung(selectedIncident, assignment, nowMs)}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <dl className="einsatz-infos">
                <div><dt>Organisation</dt><dd>{selectedIncident.organization}</dd></div>
                <div><dt>Einsatzort</dt><dd>{selectedIncident.address}</dd></div>
                <div><dt>Eingegangen</dt><dd>{formatUhrzeit(selectedIncident.createdAt)}</dd></div>
                <div><dt>Wachbereich</dt><dd>{selectedIncident.generatedByStationName}</dd></div>
                <div><dt>{selectedIncident.bewertung ? 'Grundgeld' : 'Belohnung'}</dt><dd>{selectedIncident.reward} €</dd></div>
                {selectedIncident.bewertung && (
                  <>
                    <div><dt>Bewertung</dt><dd>{selectedIncident.bewertung.punkte} / 100 Punkte</dd></div>
                    <div>
                      <dt>Fahrzeugwahl</dt>
                      <dd>
                        {selectedIncident.bewertung.wahlPunkte ?? '–'} / 50
                        {selectedIncident.bewertung.besteAnfahrtSekunden !== undefined
                          && ` (bestes freies Fahrzeug: ${formatEtaLabel(selectedIncident.bewertung.besteAnfahrtSekunden)})`}
                      </dd>
                    </div>
                    <div>
                      <dt>Hilfsfrist</dt>
                      <dd>{selectedIncident.bewertung.fristPunkte ?? '–'} / 50 (Anfahrt {formatEtaLabel(selectedIncident.bewertung.anfahrtSekunden)})</dd>
                    </div>
                    <div><dt>Leistungsbonus</dt><dd>+{selectedIncident.bewertung.bonus} €</dd></div>
                    <div>
                      <dt>Ruf</dt>
                      <dd>
                        {selectedIncident.bewertung.rufAenderung > 0 ? '+' : ''}{selectedIncident.bewertung.rufAenderung}
                        {' '}(vorher {selectedIncident.bewertung.rufVorher})
                      </dd>
                    </div>
                  </>
                )}
                {selectedIncident.status === 'abgeschlossen' && (
                  <>
                    <div><dt>Abschlusszeit</dt><dd>{formatDateTime(selectedIncident.completedAt ?? nowMs)}</dd></div>
                    <div><dt>Einsatzdauer</dt><dd>{formatEtaLabel(selectedIncident.totalDurationSeconds ?? getBearbeitungsMs(selectedIncident) / 1000)}</dd></div>
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
