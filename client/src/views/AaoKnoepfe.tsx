import { useState } from 'react';
import { waehleAaoFahrzeuge, type AaoEintrag } from '@leitstellendispo/shared';
import type { Vehicle } from '../types';

/** „?“ mit Schritt-für-Schritt-Erklärung der AAO (bei der Alarmierung und auf der AAO-Seite) */
export function AaoHilfe() {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="aao-hilfe__knopf"
        aria-expanded={offen}
        aria-label="Was ist die AAO?"
        title="Was ist die AAO?"
        onClick={() => setOffen((o) => !o)}
      >
        ?
      </button>
      {offen && (
        <div className="aao-hilfe">
          <strong>Was ist die AAO?</strong>
          <p>
            AAO heißt Alarm- und Ausrückeordnung. Das sind deine eigenen Alarm-Knöpfe: Ein Tipp wählt mehrere
            Fahrzeuge auf einmal aus, auch von verschiedenen Wachen.
          </p>
          <strong>Wie funktioniert das?</strong>
          <ol>
            <li>Jeder Knopf sagt, welche Fahrzeuge er braucht, z. B. „1× Einsatzleitwagen, 2× Löschfahrzeug, 1× Drehleiter“.</li>
            <li>Beim Antippen sucht das Spiel dafür die <strong>schnellsten freien</strong> Fahrzeuge, egal von welcher Wache.</li>
            <li>Hat ein Knopf ganze Wachen eingetragen, kommen <strong>alle freien Fahrzeuge</strong> dieser Wachen mit.</li>
            <li>Die Fahrzeuge werden nur <strong>ausgewählt</strong> (Häkchen). Alarmiert wird erst mit „Alarmieren“.</li>
            <li>Nochmal tippen wählt weitere Fahrzeuge dazu. „Leeren“ nimmt alle Häkchen wieder weg.</li>
          </ol>
          <strong>Was bedeuten ✓ und ✖?</strong>
          <p>✓ = alles frei. ✖ = gerade fehlt etwas, der Rest wird trotzdem ausgewählt. Was fehlt, steht dann darunter.</p>
          <strong>Wie stelle ich es ein?</strong>
          <ol>
            <li>Im Menü auf <strong>„AAO“</strong> gehen.</li>
            <li>„＋ Neuer Knopf“ tippen oder bei einem Knopf „Bearbeiten“.</li>
            <li>Namen und Farbe wählen und einen <strong>Reiter</strong> eintragen (z. B. „Feuerwehr“). Knöpfe mit gleichem Reiter stehen zusammen.</li>
            <li>Bei den Fahrzeugen die Anzahl eintragen. „(beliebig)“ heißt: irgendein Fahrzeug dieser Art, z. B. LF oder HLF.</li>
            <li>Optional ganze Wachen ankreuzen und dann „Speichern“.</li>
          </ol>
        </div>
      )}
    </>
  );
}

/** AAO-Knöpfe bei der Alarmierung: Reiter oben, farbige Knöpfe mit ✓/✖ */
export default function AaoKnoepfe({
  aao,
  verfuegbar,
  auswahl,
  onAuswahl,
  onMeldung,
}: {
  aao: AaoEintrag[];
  verfuegbar: Array<{ vehicle: Vehicle; anfahrtSekunden: number }>;
  auswahl: string[];
  onAuswahl: (ids: string[]) => void;
  onMeldung: (text: string) => void;
}) {
  const reiterListe = [...new Set(aao.map((e) => e.reiter.trim() || 'Allgemein'))];
  const [reiter, setReiter] = useState(reiterListe[0] ?? '');
  const aktiv = reiterListe.includes(reiter) ? reiter : reiterListe[0];
  if (aao.length === 0) {
    return (
      <div className="aao">
        <div className="aao__kopf">
          <small className="einsatz-eintrag__zeile" style={{ flex: 1 }}>Noch keine AAO-Knöpfe – im Menü unter „AAO“ eigene Züge anlegen.</small>
          <AaoHilfe />
        </div>
      </div>
    );
  }

  return (
    <div className="aao">
      <div className="aao__kopf">
        <div className="aao__reiter" role="tablist" aria-label="AAO-Reiter">
          {reiterListe.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={aktiv === name}
              className={`aao__reiter-knopf ${aktiv === name ? 'aao__reiter-knopf--aktiv' : ''}`}
              onClick={() => setReiter(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <AaoHilfe />
      </div>
      <div className="aao__knoepfe">
        {aao.filter((e) => (e.reiter.trim() || 'Allgemein') === aktiv).map((eintrag) => {
          const komplett = waehleAaoFahrzeuge(eintrag, verfuegbar).fehlt.length === 0;
          return (
            <button
              key={eintrag.id}
              type="button"
              className="aao__knopf"
              style={{ background: eintrag.farbe }}
              onClick={() => {
                const { fahrzeugIds, fehlt } = waehleAaoFahrzeuge(eintrag, verfuegbar, auswahl);
                onAuswahl([...auswahl, ...fahrzeugIds]);
                onMeldung(fehlt.length > 0
                  ? `${eintrag.name}: ${fahrzeugIds.length} ausgewählt – nicht frei: ${fehlt.join(', ')}.`
                  : `✓ ${eintrag.name} ausgewählt – jetzt alarmieren.`);
              }}
            >
              <span className="aao__status" aria-label={komplett ? 'alles frei' : 'nicht alles frei'}>{komplett ? '✓' : '✖'}</span>
              {eintrag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
