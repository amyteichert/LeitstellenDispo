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

const FAHRZEUG_SCHLUESSEL = [
  ...AAO_KATEGORIEN.map((kategorie) => `${AAO_KATEGORIE}${kategorie}`),
  ...FAHRZEUG_TYPEN.map((typ) => typ.typ),
];

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
            <input value={bearbeitet.reiter} maxLength={30} list="aao-reiter" placeholder="z. B. Feuerwehr" onChange={(e) => setze({ reiter: e.target.value })} />
            <datalist id="aao-reiter">{reiterListe.map((r) => <option key={r} value={r} />)}</datalist>
          </label>
          <label className="field aao-formular__farbe">
            <span>Farbe</span>
            <input type="color" value={bearbeitet.farbe} onChange={(e) => setze({ farbe: e.target.value })} />
          </label>
        </section>

        <section className="einsatz-abschnitt">
          <h4>Fahrzeuge</h4>
          <p className="einsatz-eintrag__zeile">Anzahl eintragen. „(beliebig)“ = irgendein Fahrzeug dieser Art, sonst genau dieser Typ.</p>
          <div className="aao-formular__fahrzeuge">
            {FAHRZEUG_SCHLUESSEL.map((key) => (
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
