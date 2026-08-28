import { useEffect, useState } from 'react';
import type { MapLocation } from '../types';
import type { Vehicle } from './FahrzeugeView';
import { getFmsStatus, getFmsStatusLabel } from './FahrzeugeView';
import { getAvailableVehicleCategories, VEHICLE_CATALOG, type VehicleCatalogCategory } from '../vehicleCatalog';
import { getAvailableUpgrades, getUpgradeDefinition, getUpgradePrice, UPGRADE_CATALOG } from '../upgradeCatalog';
import { formatCurrency } from '../utils/formatCurrency';

const formatPrice = formatCurrency;

export default function WachenView({
  locations,
  selectedId,
  setSelectedId,
  vehicles,
  stationKindFilter,
  balance,
  onPurchaseVehicle,
  onPurchaseUpgrade,
}: {
  locations: MapLocation[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  vehicles: Vehicle[];
  stationKindFilter?: 'Rettungswache' | 'Feuerwache';
  balance: number;
  onPurchaseVehicle: (stationId: string, type: string, callsign: string) => boolean;
  onPurchaseUpgrade: (stationId: string, upgradeId: string) => boolean;
}) {
  const stations = locations.filter((l) => l.type === 'station' && (!stationKindFilter || (l.stationKind ?? 'Rettungswache') === stationKindFilter));
  const selected = locations.find((l) => l.id === selectedId && l.type === 'station');
  const [purchaseCategory, setPurchaseCategory] = useState<VehicleCatalogCategory>('Löschfahrzeuge');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseCallsign, setPurchaseCallsign] = useState('');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const availableCategories = selected ? getAvailableVehicleCategories(selected.stationKind ?? 'Rettungswache') : [];
  const activeCategory = availableCategories.includes(purchaseCategory) ? purchaseCategory : availableCategories[0];
  const selectedCapacity = selected?.vehicleCapacity ?? (selected?.stationKind === 'Feuerwache' ? 3 : 2);
  const selectedVehicleCount = selected ? vehicles.filter((vehicle) => vehicle.stationId === selected.id).length : 0;
  const hasFreeVehicleSlot = selectedVehicleCount < selectedCapacity;
  const activeUpgrade = selected ? getUpgradeDefinition('vehicle-capacity') : undefined;
  const upgradeLevel = selected?.upgradeLevels?.['vehicle-capacity'] ?? 0;
  const nextUpgradeLevel = upgradeLevel + 1;
  const upgradePrice = activeUpgrade ? getUpgradePrice(activeUpgrade, nextUpgradeLevel) : undefined;
  const upgradeGroups: Array<{ title: string; ids: string[] }> = [
    { title: 'Aufenthalt & Personal', ids: ['aufenthaltsraum', 'ruheraume', 'fitnessraum', 'personalbereiche', 'kuche'] },
    { title: 'Ausbildung & Betrieb', ids: ['ausbildungsbereich', 'werkstatt'] },
    { title: 'Erweiterungen', ids: ['lagerkapazitaet', 'erweiterungen'] },
  ];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Aufenthalt & Personal': true,
    'Ausbildung & Betrieb': true,
    Erweiterungen: true,
  });

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
                  const purchased = onPurchaseVehicle(selected.id, entry.type, purchaseCallsign.trim() || `${entry.type}-${vehicles.filter((vehicle) => vehicle.type === entry.type).length + 1}`);
                  if (!purchased) setPurchaseError(`Für ${entry.type} reicht das Guthaben nicht aus.`);
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
      <div className="screen-heading"><div><span className="eyebrow">Standortnetz</span><h2>Wachen</h2></div><span className="screen-count">{stations.length} Standorte</span></div>
      <div className="station-layout">
        <div className="section-panel station-list-panel">
          <ul className="station-list">
            {stations.map((s) => (
              <li key={s.id}>
                <button
                  className={`station-card ${s.stationKind === 'Feuerwache' ? 'station-card--fire' : 'station-card--rescue'} ${selectedId === s.id ? 'station-card--active' : ''}`}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                >
                  <strong>{s.name}</strong>
                  <span className={`station-badge station-badge--${s.stationKind === 'Feuerwache' ? 'fire' : 'rescue'}`}>{s.stationKind ?? 'Rettungswache'}</span>
                  <div>{s.description}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="section-panel station-detail-panel">
          {selected ? (
            <div className={`station-detail ${selected.stationKind === 'Feuerwache' ? 'station-detail--fire' : ''}`}>
              <h3>{selected.name}</h3>
              <div className="station-facts">
                <p><span>Wachentyp</span><strong>{selected.stationKind ?? 'Rettungswache'}</strong></p>
                <p><span>Fahrzeuge</span><strong>{selectedVehicleCount} / {selectedCapacity}</strong></p>
                <p><span>Standort</span><strong>{selected.details}</strong></p>
                <p><span>Koordinaten</span><strong>{selected.coords[0].toFixed(4)}, {selected.coords[1].toFixed(4)}</strong></p>
              </div>

              <h4>Fahrzeuge</h4>
              <ul className="station-vehicles">
                {vehicles.filter(v => v.stationId === selected.id).map(v => (
                  <li className={v.type === 'RTW' ? 'station-vehicle--rescue' : 'station-vehicle--fire'} key={v.id}><strong>{v.callsign ?? v.name}</strong><span>{v.type ?? '–'}</span><small className={`fms-badge fms-badge--${getFmsStatus(v)}`}>[{getFmsStatus(v)}] {getFmsStatusLabel(v)}</small></li>
                ))}
                {vehicles.filter(v => v.stationId === selected.id).length === 0 && <li>Noch keine Fahrzeuge vorhanden.</li>}
              </ul>
              <button className="btn btn--primary station-buy-vehicle" type="button" onClick={() => { setPurchaseError(null); setPurchaseOpen(true); }}>Fahrzeug kaufen</button>
              <button className="btn station-upgrade-button" type="button" onClick={() => { setUpgradeError(null); setUpgradeOpen(true); }}>Wache upgraden</button>
            </div>
          ) : (
            <p>Keine Wache ausgewählt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
