import { useEffect, useState } from 'react';
import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';
import { getFmsStatus, getFmsStatusLabel } from './FahrzeugeView';
import { getAvailableVehicleCategories, VEHICLE_CATALOG, type VehicleCatalogCategory } from '../vehicleCatalog';
import { getAvailableUpgrades, getUpgradeDefinition, getUpgradePrice, UPGRADE_CATALOG } from '../upgradeCatalog';
import { formatCurrency } from '../utils/formatCurrency';

const formatPrice = formatCurrency;

const isStationOwned = (station: MapLocation) => Boolean(station.owned ?? station.isOwned ?? ((station.purchasePrice === 0 || station.price === 0) || station.id === 'rettungswache-zentrum' || station.id === 'rettungswache-sued'));

const getDistanceKm = (from: { lat: number; lng: number } | null, station: MapLocation) => {
  if (!from) return Number.POSITIVE_INFINITY;
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const stationLat = station.latitude ?? station.coords[0];
  const stationLng = station.longitude ?? station.coords[1];
  const dLat = toRad(stationLat - from.lat);
  const dLng = toRad(stationLng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(stationLat);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
};

export default function WachenView({
  locations,
  selectedId,
  setSelectedId,
  vehicles,
  stationKindFilter,
  balance,
  onPurchaseStation,
  onPurchaseVehicle,
  onPurchaseUpgrade,
}: {
  locations: MapLocation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  vehicles: Vehicle[];
  stationKindFilter?: 'Rettungswache' | 'Feuerwache';
  balance: number;
  onPurchaseStation: (stationId: string) => boolean;
  onPurchaseVehicle: (stationId: string, type: string, callsign: string) => boolean;
  onPurchaseUpgrade: (stationId: string, upgradeId: string) => boolean;
}) {
  const allStations = locations.filter((l) => l.type === 'station' && (!stationKindFilter || (l.stationKind ?? l.kind ?? 'Rettungswache') === stationKindFilter));
  const ownedStations = allStations.filter((station) => isStationOwned(station));
  const catalogStations = allStations.filter((station) => !isStationOwned(station));
  const [stationTab, setStationTab] = useState<'meine' | 'katalog'>('meine');
  const [purchaseCategory, setPurchaseCategory] = useState<VehicleCatalogCategory>('Löschfahrzeuge');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseCallsign, setPurchaseCallsign] = useState('');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [stationPurchaseError, setStationPurchaseError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [stationQuery, setStationQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('Alle');
  const [kindFilter, setKindFilter] = useState<'Alle' | 'Rettungswache' | 'Feuerwache'>('Alle');
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Aufenthalt & Personal': true,
    'Ausbildung & Betrieb': true,
    Erweiterungen: true,
  });

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setUserPosition({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setUserPosition(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const stationOptions = Array.from(new Set(allStations.map((station) => station.state).filter((value): value is string => Boolean(value))));
  const activeStations = stationTab === 'meine' ? ownedStations : catalogStations;
  const filteredStations = activeStations
    .filter((station) => {
      const query = stationQuery.trim().toLowerCase();
      const matchesQuery = !query || [station.name, station.city, station.address, station.details, station.postalCode, station.state, station.stationKind ?? station.kind ?? 'Rettungswache'].join(' ').toLowerCase().includes(query);
      const matchesKind = kindFilter === 'Alle' || (station.stationKind ?? station.kind ?? 'Rettungswache') === kindFilter;
      const matchesState = stateFilter === 'Alle' || station.state === stateFilter;
      return matchesQuery && matchesKind && matchesState;
    })
    .sort((a, b) => {
      const aDistance = getDistanceKm(userPosition, a);
      const bDistance = getDistanceKm(userPosition, b);
      if (aDistance === bDistance) return 0;
      if (Number.isFinite(aDistance) && Number.isFinite(bDistance)) return aDistance - bDistance;
      return Number.isFinite(aDistance) ? -1 : 1;
    });

  const selected = locations.find((l) => l.id === selectedId && l.type === 'station') ?? filteredStations[0] ?? allStations[0];

  useEffect(() => {
    if (filteredStations.length > 0 && !filteredStations.some((station) => station.id === selectedId)) {
      setSelectedId(filteredStations[0].id);
    }
  }, [filteredStations, selectedId, setSelectedId]);

  const selectedCapacity = selected?.vehicleCapacity ?? (selected?.stationKind === 'Feuerwache' ? 3 : 2);
  const selectedVehicleCount = selected ? vehicles.filter((vehicle) => vehicle.stationId === selected.id).length : 0;
  const hasFreeVehicleSlot = selectedVehicleCount < selectedCapacity;
  const activeUpgrade = selected ? getUpgradeDefinition('vehicle-capacity') : undefined;
  const upgradeLevel = selected?.upgradeLevels?.['vehicle-capacity'] ?? 0;
  const nextUpgradeLevel = upgradeLevel + 1;
  const upgradePrice = activeUpgrade ? getUpgradePrice(activeUpgrade, nextUpgradeLevel) : undefined;
  const availableCategories = selected ? getAvailableVehicleCategories(selected.stationKind ?? 'Rettungswache') : [];
  const activeCategory = availableCategories.includes(purchaseCategory) ? purchaseCategory : availableCategories[0];
  const upgradeGroups: Array<{ title: string; ids: string[] }> = [
    { title: 'Aufenthalt & Personal', ids: ['aufenthaltsraum', 'ruheraume', 'fitnessraum', 'personalbereiche', 'kuche'] },
    { title: 'Ausbildung & Betrieb', ids: ['ausbildungsbereich', 'werkstatt'] },
    { title: 'Erweiterungen', ids: ['lagerkapazitaet', 'erweiterungen'] },
  ];

  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(purchaseCategory)) {
      setPurchaseCategory(availableCategories[0]);
    }
  }, [availableCategories, purchaseCategory]);

  if (selected && upgradeOpen) {
    const availableUpgrades = getAvailableUpgrades(selected.stationKind ?? 'Rettungswache');
    const renderUpgradeCard = (upgrade: (typeof UPGRADE_CATALOG)[number]) => {
      const isAvailable = availableUpgrades.some((item) => item.id === upgrade.id);
      const nextPrice = upgrade.id === 'vehicle-capacity' ? upgradePrice : undefined;
      const canUpgrade = isAvailable && nextPrice !== undefined && balance >= nextPrice;
      const isUnlocked = upgrade.id === 'ausbildungsbereich' && (selected.upgradeLevels?.[upgrade.id] ?? 0) > 0;
      if (upgrade.id === 'ausbildungsbereich') {
        const unlockPrice = upgrade.priceByNextLevel?.[1];
        const canUnlock = !isUnlocked && unlockPrice !== undefined && balance >= unlockPrice;
        return (
          <article className={`upgrade-card${isUnlocked ? ' upgrade-card--completed' : isAvailable ? '' : ' upgrade-card--disabled'}`} key={upgrade.id}>
            <span className="upgrade-card__category">{upgrade.category}</span>
            <h3>{upgrade.name}</h3>
            {!isUnlocked ? (
              <>
                <p>Hier kann später Personal ausgebildet werden.</p>
                <div className="upgrade-price">{unlockPrice !== undefined ? formatPrice(unlockPrice) : 'Preis nicht verfügbar'}</div>
                <button className="btn btn--primary upgrade-action" type="button" disabled={!canUnlock} onClick={() => {
                  const success = onPurchaseUpgrade(selected.id, upgrade.id);
                  if (!success) setUpgradeError(unlockPrice === undefined ? 'Freischaltung nicht verfügbar.' : balance < unlockPrice ? 'Nicht genügend Guthaben für die Freischaltung.' : 'Die Freischaltung konnte nicht durchgeführt werden.');
                  else setUpgradeError(null);
                }}>{balance < (unlockPrice ?? 0) ? 'Guthaben nicht ausreichend' : 'Freischalten'}</button>
                <span className="upgrade-locked-state">Gesperrt</span>
              </>
            ) : (
              <>
                <p>Hier können künftig Ausbildungen für Einsatzkräfte durchgeführt werden.</p>
                <div className="upgrade-status-banner">Ausbildungsbereich freigeschaltet</div>
              </>
            )}
          </article>
        );
      }
      return (
        <article className={`upgrade-card${isAvailable ? '' : ' upgrade-card--disabled'}`} key={upgrade.id}>
          <span className="upgrade-card__category">{upgrade.category}</span>
          <h3>{upgrade.name}</h3>
          <p>{upgrade.description}</p>
          {upgrade.id === 'vehicle-capacity' && <>
            <div className="upgrade-capacity"><strong>{selectedVehicleCount} / {selectedCapacity}</strong><span>Fahrzeuge</span><small>Nächste Stufe: {selectedCapacity} → {selectedCapacity + 1} Stellplätze</small></div>
            <div className="upgrade-price">{nextPrice !== undefined ? formatPrice(nextPrice) : 'Maximale Stufe erreicht'}</div>
            <button className="btn btn--primary upgrade-action" type="button" disabled={!canUpgrade} onClick={() => { const success = onPurchaseUpgrade(selected.id, upgrade.id); if (!success) setUpgradeError(nextPrice === undefined ? 'Keine weitere Ausbaustufe verfügbar.' : balance < nextPrice ? 'Nicht genügend Guthaben für diesen Ausbau.' : 'Der Ausbau konnte nicht durchgeführt werden.'); else setUpgradeError(null); }}>{!isAvailable ? 'Bald verfügbar' : nextPrice === undefined ? 'Maximale Stufe erreicht' : balance < nextPrice ? 'Guthaben nicht ausreichend' : 'Stellplatz erweitern'}</button>
          </>}
          {upgrade.id !== 'vehicle-capacity' && <span className="upgrade-coming-soon">Für eine spätere Ausbaustufe vorbereitet</span>}
        </article>
      );
    };

    return (
      <div className="view-screen upgrade-screen">
        <div className="screen-heading">
          <div><span className="eyebrow">Standortausbau</span><h2>Wache upgraden</h2><p className="vehicle-shop-context"><strong>{selected.name}</strong> · {selected.stationKind ?? 'Rettungswache'}</p></div>
          <button className="btn vehicle-shop-back" type="button" onClick={() => { setUpgradeOpen(false); setUpgradeError(null); }}>Zur Wache</button>
        </div>
        <div className="vehicle-shop-toolbar upgrade-summary"><span>Ausbauzustand <strong>Stufe {upgradeLevel}</strong></span><span>Guthaben <strong>{formatPrice(balance)}</strong></span></div>
        {upgradeError && <p className="vehicle-shop-error" role="alert">{upgradeError}</p>}
        <div className="upgrade-list">
          <div className="upgrade-grid">{renderUpgradeCard(UPGRADE_CATALOG.find((upgrade) => upgrade.id === 'vehicle-capacity')!)}</div>
          <div className="upgrade-groups">
            {upgradeGroups.map((group) => {
              const isExpanded = expandedGroups[group.title] ?? true;
              const groupIds = new Set(group.ids);
              const groupUpgrades = UPGRADE_CATALOG.filter((upgrade) => groupIds.has(upgrade.id));
              return (
                <section className="upgrade-group" key={group.title}>
                  <button className="upgrade-group__toggle" type="button" aria-expanded={isExpanded} onClick={() => setExpandedGroups((previous) => ({ ...previous, [group.title]: !(previous[group.title] ?? true) }))}>
                    <span className="upgrade-group__label-wrapper"><span>{group.title}</span><span className="upgrade-group__chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span></span>
                    <span className="upgrade-group__count">{groupUpgrades.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="upgrade-group__content">
                      <div className="upgrade-grid">{groupUpgrades.map((upgrade) => renderUpgradeCard(upgrade))}</div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (selected && purchaseOpen && activeCategory) {
    const catalog = VEHICLE_CATALOG[activeCategory];
    return (
      <div className="view-screen vehicle-shop-screen">
        <div className="screen-heading">
          <div><span className="eyebrow">Fuhrpark erweitern</span><h2>Fahrzeug kaufen</h2><p className="vehicle-shop-context">Neue Einheit für <strong>{selected.name}</strong></p></div>
          <button className="btn vehicle-shop-back" type="button" onClick={() => { setPurchaseError(null); setPurchaseOpen(false); setPurchaseCategory('Löschfahrzeuge'); }}>Zur Wache</button>
        </div>
        <div className="vehicle-shop-toolbar">
          <nav className="vehicle-shop-categories" aria-label="Fahrzeugkategorien">
            {availableCategories.map((category) => <button key={category} className={activeCategory === category ? 'active' : ''} type="button" onClick={() => setPurchaseCategory(category)}>{category}</button>)}
          </nav>
          <span className="vehicle-shop-balance">Stellplätze <strong>{selectedVehicleCount} / {selectedCapacity}</strong> · Guthaben <strong>{formatPrice(balance)}</strong></span>
        </div>
        {purchaseError && <p className="vehicle-shop-error" role="alert">{purchaseError}</p>}
        <div className="vehicle-shop-grid">
          {catalog.map((entry) => {
            const affordable = balance >= entry.price;
            const canPurchase = affordable && hasFreeVehicleSlot;
            return <article className="vehicle-shop-card" key={entry.type}>
              <div className="vehicle-shop-card__top"><span className={`vehicle-shop-organization vehicle-shop-organization--${entry.organization === 'Feuerwehr' ? 'fire' : 'rescue'}`}>{entry.organization}</span><span className="vehicle-shop-price">{formatPrice(entry.price)}</span></div>
              <h3>{entry.type}</h3>
              <p>{entry.description}</p>
              <div className="vehicle-shop-card__footer">
                <label className="vehicle-shop-callsign"><span>Funkrufname</span><input value={purchaseCallsign} onChange={(event) => setPurchaseCallsign(event.target.value)} placeholder={`${entry.type}-1`} /></label>
                <button className="btn btn--primary vehicle-shop-buy" type="button" disabled={!canPurchase} onClick={() => {
                  if (!isStationOwned(selected)) {
                    setPurchaseError('Wache gehört dir nicht. Bitte zuerst die Wache kaufen.');
                    return;
                  }
                  if (!hasFreeVehicleSlot) {
                    setPurchaseError('Keine freien Stellplätze in dieser Wache verfügbar.');
                    return;
                  }
                  if (!affordable) {
                    setPurchaseError(`Für ${entry.type} sind ${formatPrice(entry.price)} nötig, aber nur ${formatPrice(balance)} verfügbar.`);
                    return;
                  }
                  const purchased = onPurchaseVehicle(selected.id, entry.type, purchaseCallsign.trim() || `${entry.type}-${vehicles.filter((vehicle) => vehicle.type === entry.type).length + 1}`);
                  if (!purchased) setPurchaseError(`Der Kauf von ${entry.type} konnte nicht abgeschlossen werden.`);
                  else { setPurchaseError(null); setPurchaseCallsign(''); }
                }}>{!hasFreeVehicleSlot ? 'Keine freien Stellplätze' : affordable ? 'Fahrzeug kaufen' : 'Guthaben nicht ausreichend'}</button>
              </div>
            </article>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="view-screen">
      <div className="screen-heading">
        <div><span className="eyebrow">Standortnetz</span><h2>Wachen</h2></div>
        <span className="screen-count">{filteredStations.length} Standorte</span>
      </div>
      <div className="station-layout">
        <div className="section-panel station-list-panel">
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className={`btn ${stationTab === 'meine' ? 'btn--primary' : ''}`} onClick={() => setStationTab('meine')}>Meine Wachen</button>
              <button type="button" className={`btn ${stationTab === 'katalog' ? 'btn--primary' : ''}`} onClick={() => setStationTab('katalog')}>Wachenkatalog</button>
            </div>
            <input value={stationQuery} onChange={(event) => setStationQuery(event.target.value)} placeholder="Name, Ort, Adresse, Postleitzahl" aria-label="Wachensuche" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as 'Alle' | 'Rettungswache' | 'Feuerwache')}>
                <option value="Alle">Alle Wachentypen</option>
                <option value="Rettungswache">Rettungswache</option>
                <option value="Feuerwache">Feuerwache</option>
              </select>
              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
                <option value="Alle">Alle Bundesländer</option>
                {stationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <ul className="station-list">
            {filteredStations.map((station) => (
              <li key={station.id}>
                <button
                  className={`station-card ${station.stationKind === 'Feuerwache' ? 'station-card--fire' : 'station-card--rescue'} ${selectedId === station.id ? 'station-card--active' : ''}`}
                  type="button"
                  onClick={() => setSelectedId(station.id)}
                >
                  <strong>{station.name}</strong>
                  <span className={`station-badge station-badge--${station.stationKind === 'Feuerwache' ? 'fire' : 'rescue'}`}>{station.stationKind ?? station.kind ?? 'Rettungswache'}</span>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>{isStationOwned(station) ? 'Eigene Wache' : `Kaufbar · ${formatPrice(station.purchasePrice ?? station.price ?? 0)}`}</span>
                  <div>{station.address ?? station.details}</div>
                  {userPosition && Number.isFinite(getDistanceKm(userPosition, station)) && <small>{getDistanceKm(userPosition, station).toFixed(1)} km entfernt</small>}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="section-panel station-detail-panel">
          {selected ? (
            <div className={`station-detail ${selected.stationKind === 'Feuerwache' ? 'station-detail--fire' : ''}`}>
              <h3>{selected.name}</h3>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" className={`btn ${stationTab === 'meine' ? 'btn--primary' : ''}`} onClick={() => setStationTab('meine')}>Meine Wachen</button>
                <button type="button" className={`btn ${stationTab === 'katalog' ? 'btn--primary' : ''}`} onClick={() => setStationTab('katalog')}>Wachenkatalog</button>
              </div>

              {!isStationOwned(selected) && (
                <div style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid rgba(148,163,184,0.4)', borderRadius: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Preis</span>
                    <strong>{formatPrice(selected.purchasePrice ?? selected.price ?? 0)}</strong>
                  </div>
                  <button type="button" className="btn btn--primary" onClick={() => {
                    const success = onPurchaseStation(selected.id);
                    if (!success) {
                      setStationPurchaseError(balance < (selected.purchasePrice ?? selected.price ?? 0) ? 'Nicht genügend Geld für diesen Kauf.' : 'Dieser Standort ist bereits vergriffen oder konnte nicht gekauft werden.');
                    } else {
                      setStationPurchaseError(null);
                    }
                  }}>
                    Wache kaufen
                  </button>
                  {stationPurchaseError && <p className="vehicle-shop-error" role="alert">{stationPurchaseError}</p>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" className={`btn ${selected.stationKind === 'Feuerwache' ? 'btn--primary' : ''}`} onClick={() => setStationTab('meine')}>Fuhrpark</button>
                <button type="button" className={`btn ${selected.stationKind === 'Feuerwache' ? '' : 'btn--primary'}`} onClick={() => setUpgradeOpen(true)}>Wachenausbau</button>
              </div>

              <div className="station-facts">
                <p><span>Besitz</span><strong>{isStationOwned(selected) ? 'Eigene Wache' : 'Kaufbar'}</strong></p>
                <p><span>Wachentyp</span><strong>{selected.stationKind ?? selected.kind ?? 'Rettungswache'}</strong></p>
                <p><span>Fahrzeuge</span><strong>{selectedVehicleCount} / {selectedCapacity}</strong></p>
                <p><span>Standort</span><strong>{selected.address ?? selected.details}</strong></p>
                <p><span>Ort</span><strong>{selected.city ?? 'Stuttgart'}, {selected.postalCode ?? '70173'}</strong></p>
                <p><span>Bundesland</span><strong>{selected.state ?? 'Baden-Württemberg'}</strong></p>
                <p><span>Koordinaten</span><strong>{(selected.latitude ?? selected.coords[0]).toFixed(4)}, {(selected.longitude ?? selected.coords[1]).toFixed(4)}</strong></p>
              </div>

              <h4>Fahrzeuge</h4>
              <ul className="station-vehicles">
                {vehicles.filter((vehicle) => vehicle.stationId === selected.id).map((vehicle) => (
                  <li className={vehicle.type === 'RTW' ? 'station-vehicle--rescue' : 'station-vehicle--fire'} key={vehicle.id}><strong>{vehicle.callsign ?? vehicle.name}</strong><span>{vehicle.type ?? '–'}</span><small className={`fms-badge fms-badge--${getFmsStatus(vehicle)}`}>[{getFmsStatus(vehicle)}] {getFmsStatusLabel(vehicle)}</small></li>
                ))}
                {vehicles.filter((vehicle) => vehicle.stationId === selected.id).length === 0 && <li>Noch keine Fahrzeuge vorhanden.</li>}
              </ul>

              {isStationOwned(selected) && (
                <button className="btn btn--primary station-buy-vehicle" type="button" onClick={() => { setPurchaseError(null); setPurchaseOpen(true); }}>Fahrzeug kaufen</button>
              )}
            </div>
          ) : (
            <p>Keine Wache ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
