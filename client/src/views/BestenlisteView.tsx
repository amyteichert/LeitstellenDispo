import { useEffect, useState } from 'react';
import {
  BESTENLISTE_CONFIG,
  BESTENLISTE_KATEGORIEN,
  anzeigeName,
  getRang,
  type BestenlisteAntwort,
  type BestenlisteEintrag,
  type BestenlisteKategorie,
  type Konto,
} from '@leitstellendispo/shared';
import { KontoFehler, ladeBestenliste } from '../konto';
import ProfilBild from '../ProfilBild';
import SpielerName from '../SpielerName';

const zahl = (wert: number) => wert.toLocaleString('de-DE');

/** Hauptwert einer Zeile, passend zur Wertung */
function Wert({ eintrag, kategorie }: { eintrag: BestenlisteEintrag; kategorie: BestenlisteKategorie }) {
  const { werte } = eintrag;
  switch (kategorie) {
    case 'xp':
      return <><strong>{zahl(werte.xp)} EP</strong><small>{getRang(werte.xp).name}</small></>;
    case 'einsaetze':
      return <><strong>{zahl(werte.einsaetze)}</strong><small>Einsätze</small></>;
    case 'perfekt':
      return <><strong>{zahl(werte.perfekt)}</strong><small>{werte.einsaetze > 0 ? `${Math.round((werte.perfekt / werte.einsaetze) * 100)} % perfekt` : 'perfekt'}</small></>;
    case 'ruf':
      return <><strong>{werte.ruf} / 100</strong><small>{zahl(werte.einsaetze)} Einsätze</small></>;
    case 'fahrzeuge':
      return <><strong>{zahl(werte.fahrzeuge)} Fahrzeuge</strong><small>{werte.wachen} {werte.wachen === 1 ? 'Wache' : 'Wachen'}</small></>;
  }
}

function Zeile({ eintrag, kategorie, eigen }: { eintrag: BestenlisteEintrag; kategorie: BestenlisteKategorie; eigen: boolean }) {
  const medaille = ['🥇', '🥈', '🥉'][eintrag.platz - 1];
  return (
    <li className={`bestenliste__zeile ${eigen ? 'bestenliste__zeile--eigen' : ''}`} aria-current={eigen ? 'true' : undefined}>
      <span className="bestenliste__platz" aria-label={`Platz ${eintrag.platz}`}>{medaille ?? `${eintrag.platz}.`}</span>
      <ProfilBild konto={eintrag.konto} groesse={34} />
      <div className="bestenliste__name">
        <SpielerName konto={eintrag.konto} />
        {eintrag.konto.spitzname?.trim() && <small>{anzeigeName(eintrag.konto)}</small>}
      </div>
      <div className="bestenliste__wert"><Wert eintrag={eintrag} kategorie={kategorie} /></div>
    </li>
  );
}

export default function BestenlisteView({ konto, gast }: { konto: Konto; gast: boolean }) {
  const [kategorie, setKategorie] = useState<BestenlisteKategorie>('xp');
  const [antwort, setAntwort] = useState<BestenlisteAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (gast) return;
    let aktiv = true;
    setFehler(null);
    ladeBestenliste(kategorie)
      .then((daten) => aktiv && setAntwort(daten))
      .catch((e) => aktiv && setFehler(e instanceof KontoFehler ? e.message : 'Die Bestenliste konnte nicht geladen werden.'));
    return () => {
      aktiv = false;
    };
  }, [kategorie, gast]);

  const info = BESTENLISTE_KATEGORIEN.find((k) => k.id === kategorie)!;
  // Nur die Antwort zur gewählten Wertung zeigen (beim Umschalten nicht kurz die alte Liste)
  const aktuell = antwort?.kategorie === kategorie ? antwort : null;
  const eigenerSichtbar = aktuell?.eigener && aktuell.eintraege.some((e) => e.konto.id === konto.id);

  return (
    <div>
      <div className="seiten-kopf">
        <h2>Bestenliste</h2>
        <p>Vergleiche dich mit anderen Leitstellen. Konten, die Dev-Werkzeuge benutzt haben, zählen nicht.</p>
      </div>

      {gast ? (
        <div className="leerzustand">
          <strong>Nur mit Konto</strong>
          Als Gast spielst du nur in diesem Browser. Mit einem kostenlosen Konto kommst du in die Bestenliste.
        </div>
      ) : (
        <>
          <div className="verwalten-reiter" role="tablist" aria-label="Wertung">
            {BESTENLISTE_KATEGORIEN.map((k) => (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={kategorie === k.id}
                className={`btn ${kategorie === k.id ? 'btn--primary' : ''}`}
                onClick={() => setKategorie(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="bestenliste__info">{info.info}</p>

          {fehler ? (
            <div className="versorgung-hinweis versorgung-hinweis--fehlt" role="alert">{fehler}</div>
          ) : !aktuell ? (
            <div className="leerzustand">Lade Bestenliste …</div>
          ) : aktuell.eintraege.length === 0 ? (
            <div className="leerzustand">
              <strong>Noch niemand in dieser Wertung</strong>
              {kategorie === 'ruf' ? `Der Ruf zählt ab ${BESTENLISTE_CONFIG.rufAbEinsaetzen} Einsätzen.` : 'Schließe Einsätze ab, um hier aufzutauchen.'}
            </div>
          ) : (
            <>
              <ol className="bestenliste">
                {aktuell.eintraege.map((eintrag) => (
                  <Zeile key={eintrag.konto.id} eintrag={eintrag} kategorie={kategorie} eigen={eintrag.konto.id === konto.id} />
                ))}
              </ol>
              <p className="bestenliste__info">
                {aktuell.teilnehmer === 1 ? '1 Leitstelle' : `${zahl(aktuell.teilnehmer)} Leitstellen`} in dieser Wertung.
              </p>
            </>
          )}

          {aktuell && !eigenerSichtbar && (
            aktuell.eigener ? (
              <>
                <h3 className="abschnitt-titel">Dein Platz</h3>
                <ol className="bestenliste">
                  <Zeile eintrag={aktuell.eigener} kategorie={kategorie} eigen />
                </ol>
              </>
            ) : (
              <div className="leerzustand">
                {kategorie === 'ruf'
                  ? `Du bist noch nicht in dieser Wertung – der Ruf zählt ab ${BESTENLISTE_CONFIG.rufAbEinsaetzen} Einsätzen.`
                  : 'Du bist noch nicht in dieser Wertung. Sie wird bei jedem Speichern deines Spielstands aktualisiert.'}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
