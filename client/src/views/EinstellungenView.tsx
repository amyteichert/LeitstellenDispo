import { useEffect, useState } from 'react';
import { APP_VERSION } from '@leitstellendispo/shared';
import type { MapLocation } from '../types';
import { formatCurrency } from '../utils/formatCurrency';

export default function EinstellungenView({
  defaultView,
  balance,
  onSetBalance,
  locations,
  onUpdateStationUpgradeLevel,
  onResetGame,
}: {
  defaultView?: string;
  balance: number;
  onSetBalance: (nextBalance: number, label: string, kind?: 'Einnahme' | 'Ausgabe') => boolean;
  locations: MapLocation[];
  onUpdateStationUpgradeLevel: (stationId: string, upgradeId: string, nextLevel: number) => boolean;
  onResetGame: () => Promise<boolean>;
}) {
  const [local, setLocal] = useState(defaultView ?? 'Karte');
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [customBalance, setCustomBalance] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const stationOptions = locations.filter((location) => location.type === 'station');
  const [selectedStationId, setSelectedStationId] = useState(stationOptions[0]?.id ?? '');

  useEffect(() => {
    if (!stationOptions.some((station) => station.id === selectedStationId)) {
      setSelectedStationId(stationOptions[0]?.id ?? '');
    }
  }, [selectedStationId, stationOptions]);

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  const selectedStation = stationOptions.find((station) => station.id === selectedStationId) ?? stationOptions[0];
  const hasTrainingUnlock = selectedStation ? (selectedStation.upgradeLevels?.['ausbildungsbereich'] ?? 0) > 0 : false;
  const isDeveloperEnabled = import.meta.env.DEV;

  const handleBalanceAction = (nextBalance: number, label: string, kind: 'Einnahme' | 'Ausgabe' = 'Einnahme') => {
    const success = onSetBalance(nextBalance, label, kind);
    if (success) setStatusMessage(label.replace(/^Entwicklermodus:\s*/, ''));
  };

  return (
    <div className="view-screen settings-screen">
      <div className="screen-heading"><div><span className="eyebrow">System</span><h2>Einstellungen</h2></div></div>
      <div className="section-panel settings-card">
        <label style={{ display: 'block', marginBottom: 8 }}>
          Standardansicht beim Start
        </label>
        <select value={local} onChange={(e) => setLocal(e.target.value)}>
          <option>Leitstelle</option>
          <option>Karte</option>
          <option>Wachen</option>
          <option>Fahrzeuge</option>
          <option>Einsätze</option>
        </select>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Hinweis: Diese Einstellung ist derzeit nur UI-seitig vorbereitet.</p>

        {isDeveloperEnabled && (
          <div className="developer-panel" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #3d434c' }}>
            <div className="developer-heading">Entwicklermodus – nur für interne Tests</div>
            {!developerOpen ? (
              <button className="btn btn--primary" type="button" onClick={() => setDeveloperOpen(true)}>Entwicklermodus öffnen</button>
            ) : (
              <div className="developer-tools">
                <div className="developer-section">
                  <div className="developer-title">Geld</div>
                  <div className="developer-money-actions">
                    {[10000, 100000, 1000000].map((value) => (
                      <button key={value} className="btn btn--secondary" type="button" onClick={() => handleBalanceAction(balance + value, `${formatCurrency(value)} erhalten`, 'Einnahme')}>
                        +{formatCurrency(value)}
                      </button>
                    ))}
                    <button className="btn btn--secondary" type="button" onClick={() => handleBalanceAction(0, 'Guthaben auf 0 € gesetzt', 'Ausgabe')}>Geld auf 0 € setzen</button>
                  </div>
                  <div className="developer-custom-balance">
                    <label htmlFor="developer-balance-input">Guthaben setzen</label>
                    <div className="developer-balance-row">
                      <input id="developer-balance-input" type="number" min="0" step="1000" value={customBalance} onChange={(e) => setCustomBalance(e.target.value)} placeholder="Betrag in €" />
                      <button className="btn btn--primary" type="button" onClick={() => {
                        const nextValue = Number(customBalance);
                        if (!Number.isFinite(nextValue) || nextValue < 0) return;
                        const nextLabel = `Guthaben auf ${formatCurrency(nextValue)} gesetzt`;
                        handleBalanceAction(nextValue, nextLabel, nextValue >= balance ? 'Einnahme' : 'Ausgabe');
                        setCustomBalance('');
                      }}>Übernehmen</button>
                    </div>
                  </div>
                  {statusMessage && <div className="developer-status" role="status">{statusMessage}</div>}
                </div>

                <div className="developer-section">
                  <div className="developer-title">Wachen</div>
                  {stationOptions.length > 0 && (
                    <>
                      <select value={selectedStationId} onChange={(e) => setSelectedStationId(e.target.value)}>
                        {stationOptions.map((station) => (
                          <option key={station.id} value={station.id}>{station.name}</option>
                        ))}
                      </select>
                      {selectedStation && (
                        <div className="developer-station-actions">
                          {selectedStation.upgradeLevels?.['ausbildungsbereich'] !== undefined && (
                            <>
                              <button className="btn btn--secondary" type="button" onClick={() => onUpdateStationUpgradeLevel(selectedStation.id, 'ausbildungsbereich', 1)} disabled={hasTrainingUnlock}>
                                Ausbildungsbereich freischalten
                              </button>
                              <button className="btn btn--secondary" type="button" onClick={() => onUpdateStationUpgradeLevel(selectedStation.id, 'ausbildungsbereich', 0)} disabled={!hasTrainingUnlock}>
                                Ausbildungsbereich wieder sperren
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="developer-section developer-section--danger">
                  <div className="developer-title">Spielstand zurücksetzen</div>
                  {!confirmReset ? (
                    <button className="btn btn--danger" type="button" onClick={() => setConfirmReset(true)}>Spielstand zurücksetzen</button>
                  ) : (
                    <div className="developer-reset-confirm">
                      <p>Dieser Schritt setzt den aktuellen Spielstand zurück. Fortfahren?</p>
                      <div className="developer-reset-actions">
                        <button className="btn btn--danger" type="button" onClick={async () => {
                          const ok = await onResetGame();
                          if (ok) setConfirmReset(false);
                        }}>Ja, zurücksetzen</button>
                        <button className="btn btn--secondary" type="button" onClick={() => setConfirmReset(false)}>Abbrechen</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #3d434c' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8f98a3', marginBottom: 8 }}>
            Über LeitstellenDispo
          </div>
          <div style={{ color: '#e5e8eb', fontSize: 14 }}>
            Version: {APP_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
}
