/**
 * Spieldaten: Großschadenslagen. Eine Lage besteht aus mehreren Einsatzabschnitten – jeder Abschnitt ist ein
 * ganz normaler Einsatz (eigene Vorlage, eigener Fahrzeugbedarf, eigene Bewertung). Abschnitte der Welle 2
 * entstehen erst, wenn die ersten Kräfte an der Schadensstelle eintreffen und die Lage erkundet haben.
 *
 * Diese Datei enthält nur Daten (keine Spiellogik), damit `einsatzVorlagen.ts` die Abschnitte finden kann,
 * ohne einen Import-Kreis zu bilden.
 */
import type { OrtsArt } from './adressen.js';
import type { Wetter } from './aufkommen.js';
import type { EinsatzVorlage } from './daten.js';
import type { BedarfsKlasse, FahrzeugBedarf } from './fahrzeuge.js';

const bedarf = (id: string, category: BedarfsKlasse) => (amount = 1): FahrzeugBedarf => ({ id, category, amount });
// Gleiche IDs wie in einsatzVorlagen.ts
const RTW = bedarf('req-rtw', 'RTW');
const NEF = bedarf('req-nef', 'NEF');
const LF = bedarf('req-lz', 'Löschfahrzeug');
const DLK = bedarf('req-dlk', 'Drehleiter');
const TH = bedarf('req-th', 'Technische Hilfe');
const RW = bedarf('req-rw', 'Rüstwagen');
const ELW = bedarf('req-elw', 'Einsatzleitwagen');
const LNA = bedarf('req-lna', 'LNA');
const ORGL = bedarf('req-orgl', 'OrgL');
const GWSAN = bedarf('req-gwsan', 'GW-San');
const GWA = bedarf('req-gwa', 'GW-A');
const GWOEL = bedarf('req-gwoel', 'GW-Öl');
const SW = bedarf('req-sw', 'Schlauchwagen');
const ELW2 = bedarf('req-elw2', 'Einsatzleitwagen 2');
const GWG = bedarf('req-gwg', 'GW-G');
const GWMESS = bedarf('req-gwmess', 'GW-Mess');
const GWL2 = bedarf('req-gwl2', 'GW-L2');

export interface GrosslagenAbschnitt {
  /** Anzeigename, z. B. „Abschnitt Patientenablage“ */
  name: string;
  /** 1 = sofort gemeldet, 2 = nach der Erkundung durch die ersten Kräfte */
  welle: 1 | 2;
  /** Der Abschnitt als normale Einsatzvorlage (ID beginnt mit `gl-`) */
  vorlage: EinsatzVorlage;
}

export interface GrosslagenVorlage {
  id: string;
  /**
   * Härte der Lage (1 = klein, 5 = brutal). Je größer die Leitstelle, desto öfter kommen die harten Lagen –
   * kleinere sind trotzdem ab und zu dabei.
   */
  stufe: number;
  /** Frühestens ab diesem Rang (Stufe der Laufbahn) */
  abRang: number;
  /** Frühestens ab so vielen Wachen */
  abWachen: number;
  /**
   * Nur bei diesem (echten) Wetter an der ersten Wache – z. B. Unwetterlagen. Fehlt = bei jedem Wetter.
   * Passt das Wetter, kommt die Lage deutlich häufiger.
   */
  wetter?: Wetter[];
  /** z. B. „Zugunglück“ */
  name: string;
  /** Kurzbeschreibung für die Einblendung */
  beschreibung: string;
  /** Wie der Mittelpunkt der Schadensstelle beschrieben wird */
  ortsArt?: OrtsArt;
  abschnitte: GrosslagenAbschnitt[];
  /** Zusätzliche Belohnung, wenn alle Abschnitte abgearbeitet sind (keiner verfallen oder abgegeben) */
  bonus: number;
  /** Zusätzliche Erfahrungspunkte für die bewältigte Lage */
  xp: number;
}

export const GROSSLAGEN_VORLAGEN: GrosslagenVorlage[] = [
  {
    id: 'unwetter-starkregen',
    stufe: 1,
    abRang: 2,
    abWachen: 1,
    // Gewitter zählt im Spiel als Sturm (siehe wetterAusMessung)
    wetter: ['regen', 'sturm'],
    name: 'Unwetterlage – Starkregen',
    beschreibung: 'Ein Gewitter mit Starkregen zieht über den Ort, Keller und Straßen laufen voll.',
    ortsArt: 'strasse',
    abschnitte: [
      {
        name: 'Keller unter Wasser',
        welle: 1,
        vorlage: {
          id: 'gl-starkregen-keller',
          stichwort: 'TH 1',
          meldebild: 'Starkregen – Keller vollgelaufen',
          organization: 'Feuerwehr',
          requiredVehicles: [LF()],
          reward: 400,
          durationSeconds: 20,
          lage: 'Wasser steht kniehoch im Keller eines Mehrfamilienhauses, Tauchpumpe läuft.',
        },
      },
      {
        name: 'Straße überflutet',
        welle: 1,
        vorlage: {
          id: 'gl-starkregen-strasse',
          stichwort: 'TH 1',
          meldebild: 'Starkregen – Unterführung überflutet',
          organization: 'Feuerwehr',
          requiredVehicles: [TH()],
          reward: 450,
          durationSeconds: 20,
          ortsArt: 'strasse',
          lage: 'PKW in der überfluteten Unterführung stecken geblieben, Fahrer sitzt auf dem Dach. Straße wird gesperrt.',
        },
      },
      {
        name: 'Tiefgarage läuft voll',
        welle: 2,
        vorlage: {
          id: 'gl-starkregen-tiefgarage',
          stichwort: 'TH 1',
          meldebild: 'Starkregen – Wasser in Tiefgarage',
          organization: 'Feuerwehr',
          requiredVehicles: [LF()],
          reward: 450,
          durationSeconds: 25,
          lage: 'Wasser läuft über die Einfahrt in die Tiefgarage, Sandsäcke und Pumpen werden eingesetzt.',
        },
      },
      {
        name: 'Baum auf Fahrbahn',
        welle: 2,
        vorlage: {
          id: 'gl-starkregen-baum',
          stichwort: 'TH 1',
          meldebild: 'Gewitter – Baum auf Fahrbahn',
          organization: 'Feuerwehr',
          requiredVehicles: [TH()],
          reward: 400,
          durationSeconds: 20,
          ortsArt: 'strasse',
          lage: 'Vom Blitz getroffener Baum liegt quer über der Straße, Motorsägentrupp arbeitet.',
        },
      },
    ],
    bonus: 1500,
    xp: 40,
  },
  {
    id: 'grossbrand-wohnanlage',
    stufe: 3,
    abRang: 4,
    abWachen: 3,
    name: 'Großbrand Wohnanlage',
    beschreibung: 'Mehrere Gebäude einer Wohnanlage brennen, Bewohner sind eingeschlossen.',
    abschnitte: [
      {
        name: 'Abschnitt Nord – Brandbekämpfung',
        welle: 1,
        vorlage: {
          id: 'gl-wohnanlage-nord',
          stichwort: 'B 4',
          meldebild: 'Großbrand Wohnanlage – Abschnitt Nord',
          organization: 'Feuerwehr',
          requiredVehicles: [LF(2), DLK(), ELW()],
          reward: 1800,
          durationSeconds: 45,
          lage: 'Dachstuhl in Vollbrand, Menschenrettung über die Drehleiter läuft. Einsatzleitung bildet Abschnitte.',
        },
      },
      {
        name: 'Abschnitt Rettungsdienst',
        welle: 1,
        vorlage: {
          id: 'gl-wohnanlage-rd',
          stichwort: 'RD 3',
          meldebild: 'Großbrand Wohnanlage – Verletzte',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(2), NEF()],
          reward: 1200,
          durationSeconds: 30,
          patienten: { anzahl: 2, zustand: 'mittel', transportWahrscheinlichkeit: 1, fachrichtung: 'innere' },
          lage: 'Zwei Bewohner mit Rauchgasvergiftung an der Patientenablage.',
        },
      },
      {
        name: 'Abschnitt Süd – Riegelstellung',
        welle: 2,
        vorlage: {
          id: 'gl-wohnanlage-sued',
          stichwort: 'B 3',
          meldebild: 'Großbrand Wohnanlage – Abschnitt Süd',
          organization: 'Feuerwehr',
          requiredVehicles: [LF(2), GWA()],
          reward: 1400,
          durationSeconds: 40,
          lage: 'Feuer droht auf das Nachbargebäude überzugreifen, Riegelstellung wird aufgebaut.',
        },
      },
      {
        name: 'Abschnitt Wasserversorgung',
        welle: 2,
        vorlage: {
          id: 'gl-wohnanlage-wasser',
          stichwort: 'B 2',
          meldebild: 'Großbrand Wohnanlage – Wasserversorgung',
          organization: 'Feuerwehr',
          requiredVehicles: [SW(), LF()],
          reward: 900,
          durationSeconds: 30,
          ortsArt: 'strasse',
          lage: 'Hydranten reichen nicht, lange Schlauchleitung vom Löschteich wird verlegt.',
        },
      },
    ],
    bonus: 5000,
    xp: 120,
  },
  {
    id: 'unwetter-sturm',
    stufe: 2,
    abRang: 3,
    abWachen: 2,
    wetter: ['sturm'],
    name: 'Unwetterlage – Orkanböen',
    beschreibung: 'Ein Sturm zieht über das Gebiet, Notrufe gehen im Minutentakt ein.',
    ortsArt: 'strasse',
    abschnitte: [
      {
        name: 'Baum auf Fahrbahn',
        welle: 1,
        vorlage: {
          id: 'gl-sturm-baum',
          stichwort: 'TH 1',
          meldebild: 'Sturm – Baum auf Fahrbahn',
          organization: 'Feuerwehr',
          requiredVehicles: [TH()],
          reward: 500,
          durationSeconds: 20,
          ortsArt: 'strasse',
          lage: 'Großer Baum blockiert beide Fahrspuren, Motorsägentrupp arbeitet.',
        },
      },
      {
        name: 'Baum auf PKW',
        welle: 1,
        vorlage: {
          id: 'gl-sturm-pkw',
          stichwort: 'TH 2',
          meldebild: 'Sturm – Baum auf PKW, Person eingeklemmt',
          organization: 'Feuerwehr',
          requiredVehicles: [RW(), LF(), RTW()],
          reward: 1300,
          durationSeconds: 35,
          ortsArt: 'strasse',
          patienten: { anzahl: 1, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
          lage: 'Fahrerin im PKW eingeklemmt, Baum wird gesichert und angehoben.',
        },
      },
      {
        name: 'Dach abgedeckt',
        welle: 2,
        vorlage: {
          id: 'gl-sturm-dach',
          stichwort: 'TH 2',
          meldebild: 'Sturm – Dach droht abzustürzen',
          organization: 'Feuerwehr',
          requiredVehicles: [DLK(), LF()],
          reward: 900,
          durationSeconds: 30,
          lage: 'Teile der Dacheindeckung lose, Gehweg wird gesperrt, Sicherung über die Drehleiter.',
        },
      },
      {
        name: 'Keller unter Wasser',
        welle: 2,
        vorlage: {
          id: 'gl-sturm-keller',
          stichwort: 'TH 1',
          meldebild: 'Starkregen – Keller unter Wasser',
          organization: 'Feuerwehr',
          requiredVehicles: [LF()],
          reward: 450,
          durationSeconds: 25,
          lage: 'Wasser steht 40 cm hoch im Keller, Tauchpumpe wird eingesetzt.',
        },
      },
    ],
    bonus: 3000,
    xp: 80,
  },
  {
    id: 'massenkarambolage',
    stufe: 4,
    abRang: 5,
    abWachen: 4,
    name: 'Massenkarambolage',
    beschreibung: 'Bei dichtem Nebel sind zahlreiche Fahrzeuge ineinander gefahren.',
    ortsArt: 'strasse',
    abschnitte: [
      {
        name: 'Abschnitt Technische Rettung',
        welle: 1,
        vorlage: {
          id: 'gl-karambolage-th',
          stichwort: 'TH 3',
          meldebild: 'Massenkarambolage – eingeklemmte Personen',
          organization: 'Feuerwehr',
          requiredVehicles: [RW(), LF(2), ELW()],
          reward: 2000,
          durationSeconds: 45,
          ortsArt: 'strasse',
          lage: 'Mehrere PKW ineinander verkeilt, zwei Personen eingeklemmt. Einsatzleitung bildet Abschnitte.',
        },
      },
      {
        name: 'Abschnitt Patientenversorgung',
        welle: 1,
        vorlage: {
          id: 'gl-karambolage-rd',
          stichwort: 'MANV',
          meldebild: 'Massenkarambolage – Verletzte',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(3), NEF(2), LNA()],
          reward: 2600,
          durationSeconds: 40,
          ortsArt: 'strasse',
          patienten: { anzahl: 3, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
          lage: 'LNA sichtet die Verletzten, drei Schwerverletzte werden versorgt.',
        },
      },
      {
        name: 'Abschnitt Transportorganisation',
        welle: 2,
        vorlage: {
          id: 'gl-karambolage-transport',
          stichwort: 'RD 3',
          meldebild: 'Massenkarambolage – weitere Verletzte',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(2), ORGL()],
          reward: 1400,
          durationSeconds: 30,
          ortsArt: 'strasse',
          patienten: { anzahl: 2, zustand: 'mittel', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
          lage: 'Weitere Verletzte in den hinteren Fahrzeugen gefunden, OrgL verteilt sie auf die Krankenhäuser.',
        },
      },
      {
        name: 'Abschnitt Betriebsstoffe',
        welle: 2,
        vorlage: {
          id: 'gl-karambolage-oel',
          stichwort: 'TH 1',
          meldebild: 'Massenkarambolage – auslaufende Betriebsstoffe',
          organization: 'Feuerwehr',
          requiredVehicles: [GWOEL(), LF()],
          reward: 800,
          durationSeconds: 30,
          ortsArt: 'strasse',
          lage: 'Diesel läuft aus einem LKW-Tank, Bindemittel wird ausgebracht.',
        },
      },
    ],
    bonus: 6000,
    xp: 140,
  },
  {
    id: 'zugunglueck',
    stufe: 4,
    abRang: 5,
    abWachen: 4,
    name: 'Zugunglück',
    beschreibung: 'Ein Regionalzug ist entgleist, viele Fahrgäste sind verletzt.',
    abschnitte: [
      {
        name: 'Abschnitt Rettung aus den Waggons',
        welle: 1,
        vorlage: {
          id: 'gl-zug-rettung',
          stichwort: 'TH 3',
          meldebild: 'Zugunglück – Rettung aus Waggons',
          organization: 'Feuerwehr',
          requiredVehicles: [RW(), LF(2), ELW()],
          reward: 2200,
          durationSeconds: 50,
          lage: 'Zwei Waggons umgestürzt, Fahrgäste werden durch die Fenster gerettet. Strecke ist gesperrt und geerdet.',
        },
      },
      {
        name: 'Abschnitt Patientenablage',
        welle: 1,
        vorlage: {
          id: 'gl-zug-ablage',
          stichwort: 'MANV',
          meldebild: 'Zugunglück – Patientenablage',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(3), NEF(), LNA()],
          reward: 2600,
          durationSeconds: 45,
          patienten: { anzahl: 3, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
          lage: 'LNA sichtet an der Patientenablage, mehrere Schwerverletzte.',
        },
      },
      {
        name: 'Abschnitt Behandlungsplatz',
        welle: 2,
        vorlage: {
          id: 'gl-zug-behandlungsplatz',
          stichwort: 'MANV',
          meldebild: 'Zugunglück – Behandlungsplatz',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(2), ORGL(), GWSAN()],
          reward: 2000,
          durationSeconds: 45,
          patienten: { anzahl: 3, zustand: 'mittel', transportWahrscheinlichkeit: 1, fachrichtung: 'unfallchirurgie' },
          lage: 'Behandlungsplatz wird aufgebaut, OrgL organisiert den Abtransport der Leichtverletzten.',
        },
      },
      {
        name: 'Abschnitt Brandschutz',
        welle: 2,
        vorlage: {
          id: 'gl-zug-brandschutz',
          stichwort: 'B 2',
          meldebild: 'Zugunglück – Brandschutz Triebwagen',
          organization: 'Feuerwehr',
          requiredVehicles: [LF(), GWA()],
          reward: 900,
          durationSeconds: 30,
          lage: 'Rauchentwicklung am Triebwagen, Atemschutztrupps sichern und kühlen.',
        },
      },
    ],
    bonus: 7000,
    xp: 150,
  },
  {
    id: 'grossbrand-chemiepark',
    stufe: 5,
    abRang: 6,
    abWachen: 6,
    name: 'Großbrand im Chemiepark',
    beschreibung: 'Eine Lagerhalle mit Gefahrstoffen brennt, eine Rauchwolke zieht über die Stadt, es gibt Verletzte.',
    abschnitte: [
      {
        name: 'Abschnitt Brandbekämpfung',
        welle: 1,
        vorlage: {
          id: 'gl-chemie-brand',
          stichwort: 'B 5',
          meldebild: 'Großbrand Chemiepark – Lagerhalle',
          organization: 'Feuerwehr',
          requiredVehicles: [LF(4), DLK(2), ELW2(), GWA()],
          reward: 4000,
          durationSeconds: 60,
          lage: 'Lagerhalle in Vollbrand, Fassade droht einzustürzen. Einsatzleitung im ELW 2 bildet Abschnitte.',
        },
      },
      {
        name: 'Abschnitt Gefahrstoffe',
        welle: 1,
        vorlage: {
          id: 'gl-chemie-gefahrstoff',
          stichwort: 'ABC 3',
          meldebild: 'Großbrand Chemiepark – Gefahrstoffaustritt',
          organization: 'Feuerwehr',
          requiredVehicles: [GWG(), GWMESS(), LF(2)],
          reward: 3200,
          durationSeconds: 55,
          lage: 'Fässer mit unbekanntem Inhalt beschädigt, Messtrupps erkunden die Rauchwolke. Bevölkerung wird gewarnt.',
        },
      },
      {
        name: 'Abschnitt Patientenablage',
        welle: 1,
        vorlage: {
          id: 'gl-chemie-ablage',
          stichwort: 'MANV',
          meldebild: 'Großbrand Chemiepark – Verletzte Mitarbeiter',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(4), NEF(2), LNA(), ORGL()],
          reward: 3600,
          durationSeconds: 50,
          patienten: { anzahl: 4, zustand: 'schwer', transportWahrscheinlichkeit: 1, fachrichtung: 'innere' },
          lage: 'Vier Mitarbeiter mit Rauchgas- und Verätzungsverletzungen, LNA sichtet.',
        },
      },
      {
        name: 'Abschnitt Riegelstellung Nachbarhalle',
        welle: 2,
        vorlage: {
          id: 'gl-chemie-riegel',
          stichwort: 'B 4',
          meldebild: 'Großbrand Chemiepark – Nachbarhalle gefährdet',
          organization: 'Feuerwehr',
          requiredVehicles: [LF(3), DLK()],
          reward: 2400,
          durationSeconds: 45,
          lage: 'Funkenflug auf das Dach der Nachbarhalle, Wasserwerfer kühlen die Wand.',
        },
      },
      {
        name: 'Abschnitt Wasserversorgung',
        welle: 2,
        vorlage: {
          id: 'gl-chemie-wasser',
          stichwort: 'B 2',
          meldebild: 'Großbrand Chemiepark – Wasserversorgung',
          organization: 'Feuerwehr',
          requiredVehicles: [SW(2), LF(), GWL2()],
          reward: 1800,
          durationSeconds: 40,
          ortsArt: 'strasse',
          lage: 'Löschwasser reicht nicht, Förderstrecke vom Hafenbecken wird aufgebaut.',
        },
      },
      {
        name: 'Abschnitt Behandlungsplatz',
        welle: 2,
        vorlage: {
          id: 'gl-chemie-behandlung',
          stichwort: 'MANV',
          meldebild: 'Großbrand Chemiepark – Anwohner mit Atembeschwerden',
          organization: 'Rettungsdienst',
          requiredVehicles: [RTW(2), GWSAN()],
          reward: 1800,
          durationSeconds: 40,
          patienten: { anzahl: 3, zustand: 'mittel', transportWahrscheinlichkeit: 0.7, fachrichtung: 'innere' },
          lage: 'Anwohner melden sich mit Atembeschwerden, Behandlungsplatz am Rand der Rauchwolke.',
        },
      },
    ],
    bonus: 12000,
    xp: 250,
  },
];

/** Alle Abschnitte als Einsatzvorlagen – damit Lagemeldung, Patienten usw. über die Vorlagen-ID gefunden werden */
export const GROSSLAGEN_ABSCHNITT_VORLAGEN: EinsatzVorlage[] = GROSSLAGEN_VORLAGEN.flatMap((lage) => lage.abschnitte.map((a) => a.vorlage));

export const findeGrosslagenVorlage = (id: string): GrosslagenVorlage | undefined =>
  GROSSLAGEN_VORLAGEN.find((lage) => lage.id === id);
