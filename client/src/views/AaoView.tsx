import { useState } from 'react';
import {
  AAO_KATEGORIE,
  AAO_KATEGORIEN,
  FAHRZEUG_TYPEN,
  getAaoFahrzeugLabel,
  type AaoEintrag,
} from '@leitstellendispo/shared';
import type { MapLocation } from '../types';
import { AaoHilfe } from './AaoKnoepfe';

/** Reiter, die immer zur Auswahl stehen – weitere kann man frei eintragen */
const STANDARD_REITER = ['Feuerwehr', 'Rettungsdienst'];

/**
 * Fahrzeuge im Formular, nach Organisation getrennt: erst „(beliebig)“ je Kategorie, dann die Typen.
 * Kategorien mit nur einem gleichnamigen Typ (RTW, NEF, KTW) stehen nur einmal da.
 */
const FAHRZEUG_GRUPPEN = [...new Set(FAHRZEUG_TYPEN.map((typ) => typ.organisation))].map((organisation) => {
  const typen = FAHRZEUG_TYPEN.filter((typ) => typ.organisation === organisation);
  const kategorien = AAO_KATEGORIEN.filter((kategorie) => {
    const zugehoerig = typen.filter((typ) => typ.kategorie === kategorie);
    return zugehoerig.length > 0 && !(zugehoerig.length === 1 && zugehoerig[0].typ === kategorie);
  });
  return {
    organisation,
    schluessel: [...kategorien.map((kategorie) => `${AAO_KATEGORIE}${kategorie}`), ...typen.map((typ) => typ.typ)],
  };
});
const ALLE_SCHLUESSEL = FAHRZEUG_GRUPPEN.flatMap((gruppe) => gruppe.schluessel);

const neuerEintrag = (): AaoEintrag => ({
  id: `aao-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
  name: '',
  farbe: '#dc2626',
  reiter: 'Feuerwehr',
  fahrzeuge: {},
  wachen: [],
});

const beschreibe = (eintrag: AaoEintrag, wachen: MapLocation[]) => [
  ...Object.entries(eintrag.fahrzeuge).filter(([, n]) => n > 0).map(([key, n]) => `${n}× ${getAaoFahrzeugLabel(key)}`),
  ...eintrag.wachen.map((id) => `ganze Wache ${wachen.find((w) => w.id === id)?.name ?? '(gelöscht)'}`),
].join(', ') || 'noch nichts eingestellt';

/** Seite „AAO“: eigene Alarm-Knöpfe anlegen, bearbeiten und löschen */
export default function AaoView({
  aao,
  setAao,
  wachen,
}: {
  aao: AaoEintrag[];
  setAao: (liste: AaoEintrag[]) => void;
  wachen: MapLocation[];
}) {
  const [bearbeitet, setBearbeitet] = useState<AaoEintrag | null>(null);
  const reiterListe = [...new Set(aao.map((e) => e.reiter.trim() || 'Allgemein'))];
  const reiterVorschlaege = [...new Set([...STANDARD_REITER, ...reiterListe])];

  const speichern = () => {
    if (!bearbeitet || !bearbeitet.name.trim()) return;
    const eintrag = { ...bearbeitet, name: bearbeitet.name.trim(), reiter: bearbeitet.reiter.trim() || 'Allgemein' };
    setAao(aao.some((e) => e.id === eintrag.id) ? aao.map((e) => (e.id === eintrag.id ? eintrag : e)) : [...aao, eintrag]);
    setBearbeitet(null);
  };

  const verschiebe = (id: string, richtung: -1 | 1) => {
    const index = aao.findIndex((e) => e.id === id);
    const ziel = index + richtung;
    if (index < 0 || ziel < 0 || ziel >= aao.length) return;
    const neu = [...aao];
    [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
    setAao(neu);
  };

  if (bearbeitet) {
    const setze = (teil: Partial<AaoEintrag>) => setBearbeitet({ ...bearbeitet, ...teil });
    return (
      <div className="aao-seite">
        <div className="wachen-kopf">
          <h2>{aao.some((e) => e.id === bearbeitet.id) ? 'AAO-Knopf bearbeiten' : 'Neuer AAO-Knopf'}</h2>
          <AaoHilfe />
        </div>
        <section className="einsatz-abschnitt aao-formular">
          <label className="field">
            <span>Name</span>
            <input value={bearbeitet.name} maxLength={40} placeholder="z. B. Löschzug Nord" onChange={(e) => setze({ name: e.target.value })} />
          </label>
          <label className="field">
            <span>Reiter</span>
            <input value={bearbeitet.reiter} maxLength={30} list="aao-reiter" placeholder="z. B. Rettungsdienst" onChange={(e) => setze({ reiter: e.target.value })} />
            <datalist id="aao-reiter">{reiterVorschlaege.map((r) => <option key={r} value={r} />)}</datalist>
            <span className="aao-formular__reiter">
              {reiterVorschlaege.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`btn btn--klein ${bearbeitet.reiter.trim() === r ? 'btn--primary' : ''}`}
                  onClick={() => setze({ reiter: r })}
                >
                  {r}
                </button>
              ))}
            </span>
          </label>
          <label className="field aao-formular__farbe">
            <span>Farbe</span>
            <input type="color" value={bearbeitet.farbe} onChange={(e) => setze({ farbe: e.target.value })} />
          </label>
        </section>

        <section className="einsatz-abschnitt">
          <h4>Fahrzeuge</h4>
          <p className="einsatz-eintrag__zeile">Anzahl eintragen. „(beliebig)“ = irgendein Fahrzeug dieser Art, sonst genau dieser Typ.</p>
          {FAHRZEUG_GRUPPEN.map(({ organisation, schluessel }) => (
          <div key={organisation}>
          <h5 className="aao-formular__gruppe">{organisation}</h5>
          <div className="aao-formular__fahrzeuge">
            {[
              ...schluessel,
              // Früher gespeicherte Schlüssel, die es im Formular nicht mehr gibt (z. B. „RTW (beliebig)“), bleiben sichtbar
              ...(organisation === FAHRZEUG_GRUPPEN[FAHRZEUG_GRUPPEN.length - 1].organisation
                ? Object.keys(bearbeitet.fahrzeuge).filter((key) => !ALLE_SCHLUESSEL.includes(key))
                : []),
            ].map((key) => (
              <label key={key} className="aao-formular__fahrzeug">
                <span>{getAaoFahrzeugLabel(key)}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  inputMode="numeric"
                  value={bearbeitet.fahrzeuge[key] ?? 0}
                  onChange={(e) => {
                    const anzahl = Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0)));
                    const { [key]: _alt, ...rest } = bearbeitet.fahrzeuge;
                    setze({ fahrzeuge: anzahl > 0 ? { ...rest, [key]: anzahl } : rest });
                  }}
                />
              </label>
            ))}
          </div>
          </div>
          ))}
        </section>

        <section className="einsatz-abschnitt">
          <h4>Ganze Wachen (optional)</h4>
          <p className="einsatz-eintrag__zeile">Alle freien Fahrzeuge der angekreuzten Wachen kommen mit.</p>
          {wachen.length === 0 && <p className="einsatz-eintrag__zeile">Du hast noch keine Wache.</p>}
          <ul className="fahrzeug-auswahl">
            {wachen.map((wache) => (
              <li key={wache.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={bearbeitet.wachen.includes(wache.id)}
                    onChange={() => setze({
                      wachen: bearbeitet.wachen.includes(wache.id)
                        ? bearbeitet.wachen.filter((id) => id !== wache.id)
                        : [...bearbeitet.wachen, wache.id],
                    })}
                  />
                  <span>{wache.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" disabled={!bearbeitet.name.trim()} onClick={speichern}>Speichern</button>
          <button type="button" className="btn" onClick={() => setBearbeitet(null)}>Abbrechen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aao-seite">
      <div className="wachen-kopf">
        <h2>AAO <AaoHilfe /></h2>
        <button type="button" className="btn btn--primary" onClick={() => setBearbeitet(neuerEintrag())}>＋ Neuer Knopf</button>
      </div>
      <p className="einsatz-eintrag__zeile">Deine Alarm-Knöpfe. Sie erscheinen bei der Alarmierung auf der Karte und unter „Einsätze“.</p>
      {aao.length === 0 && (
        <div className="leerzustand">
          <strong>Noch keine Knöpfe</strong>
          Tippe auf „＋ Neuer Knopf“.
        </div>
      )}
      {reiterListe.map((reiter) => (
        <section key={reiter} className="einsatz-abschnitt">
          <h4>{reiter}</h4>
          <ul className="aao-liste">
            {aao.filter((e) => (e.reiter.trim() || 'Allgemein') === reiter).map((eintrag) => (
              <li key={eintrag.id}>
                <span className="aao__knopf aao__knopf--vorschau" style={{ background: eintrag.farbe }}>{eintrag.name}</span>
                <small>{beschreibe(eintrag, wachen)}</small>
                <span className="aao-liste__aktionen">
                  <button type="button" className="btn btn--klein" aria-label={`${eintrag.name} nach oben`} onClick={() => verschiebe(eintrag.id, -1)}>↑</button>
                  <button type="button" className="btn btn--klein" aria-label={`${eintrag.name} nach unten`} onClick={() => verschiebe(eintrag.id, 1)}>↓</button>
                  <button type="button" className="btn btn--klein" onClick={() => setBearbeitet(eintrag)}>Bearbeiten</button>
                  <button
                    type="button"
                    className="btn btn--klein"
                    aria-label={`${eintrag.name} löschen`}
                    onClick={() => {
                      if (window.confirm(`AAO-Knopf „${eintrag.name}“ löschen?`)) setAao(aao.filter((e) => e.id !== eintrag.id));
                    }}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
