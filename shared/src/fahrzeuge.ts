/**
 * Zentraler Fahrzeugkatalog: Typen, Fähigkeiten, Besatzung, Geschwindigkeit und Preis.
 * Alle anderen Stellen (Kaufen, Alarmierung, Einsatzbedarf, Fahrzeiten) lesen nur von hier.
 */
import { GAME_CONFIG } from './konfig.js';
import type { EinsatzOrganisation, Vehicle, WachenArt } from './typen.js';
import type { SonderErweiterungId } from './wachen.js';

/** Grobe Fahrzeugklasse – so denkt der Disponent („2 LF und eine DLK“). */
export type FahrzeugKategorie =
  | 'RTW' | 'NEF' | 'KTW' | 'ITW' | 'RTH' | 'LNA' | 'OrgL' | 'GW-San'
  | 'Löschfahrzeug' | 'Drehleiter' | 'Rüstwagen' | 'Einsatzleitwagen' | 'Einsatzleitwagen 2'
  | 'MTW' | 'GW-A' | 'GW-Öl' | 'Schlauchwagen' | 'GW-L2' | 'Kran' | 'GW-G' | 'GW-Mess' | 'Wasserrettung' | 'Höhenrettung';

/** Was ein Fahrzeug kann. Bewusst wenige – nur was die Spiellogik aktuell nutzt. */
export type Faehigkeit =
  | 'brandbekaempfung'
  | 'technische_hilfe'
  | 'hoehenrettung'
  | 'patientenversorgung'
  | 'patiententransport'
  | 'notarzt'
  | 'schwere_technik'
  | 'rettungsgeraet'
  | 'einsatzleitung'
  | 'intensivtransport'
  | 'luftrettung'
  | 'leitender_notarzt'
  | 'organisatorische_leitung'
  | 'sanitaetsdienst'
  | 'mannschaftstransport'
  | 'atemschutz'
  | 'oelbindung'
  | 'wasserversorgung'
  | 'logistik'
  | 'kran'
  | 'gefahrgut'
  | 'messtechnik'
  | 'wasserrettung'
  | 'absturzsicherung';

export const FAEHIGKEIT_LABELS: Record<Faehigkeit, string> = {
  brandbekaempfung: 'Brandbekämpfung',
  technische_hilfe: 'Technische Hilfeleistung',
  hoehenrettung: 'Menschenrettung über Drehleiter',
  patientenversorgung: 'Patientenversorgung',
  patiententransport: 'Patiententransport',
  notarzt: 'Notarztversorgung',
  schwere_technik: 'Schwere technische Rettung',
  rettungsgeraet: 'Hydraulisches Rettungsgerät',
  einsatzleitung: 'Einsatzleitung',
  intensivtransport: 'Intensivtransport',
  luftrettung: 'Luftrettung',
  leitender_notarzt: 'Leitender Notarzt',
  organisatorische_leitung: 'Organisatorische Leitung Rettungsdienst',
  sanitaetsdienst: 'Sanitätsdienst bei vielen Verletzten',
  mannschaftstransport: 'Mannschaftstransport',
  atemschutz: 'Atemschutz-Nachschub',
  oelbindung: 'Ölschadenbekämpfung',
  wasserversorgung: 'Wasserversorgung über lange Wege',
  logistik: 'Logistik und Nachschub',
  kran: 'Bergung schwerer Lasten',
  gefahrgut: 'Gefahrgut-Abwehr',
  messtechnik: 'Messen von Schadstoffen',
  wasserrettung: 'Wasserrettung',
  absturzsicherung: 'Spezielle Höhenrettung',
};

/** Qualifikationen des Personals – nur die, die ein Fahrzeug zwingend braucht. */
export type Qualifikation =
  | 'rettungssanitaeter'
  | 'notfallsanitaeter'
  | 'notarzt'
  | 'maschinist_dlk'
  | 'gruppenfuehrer'
  | 'zugfuehrer'
  | 'technische_hilfe'
  | 'lna'
  | 'orgl'
  | 'pilot'
  | 'gefahrgut'
  | 'wasserrettung'
  | 'hoehenretter';

export const QUALIFIKATION_LABELS: Record<Qualifikation, string> = {
  rettungssanitaeter: 'Rettungssanitäter',
  notfallsanitaeter: 'Notfallsanitäter',
  notarzt: 'Notarzt',
  maschinist_dlk: 'Maschinist Drehleiter',
  gruppenfuehrer: 'Gruppenführer',
  zugfuehrer: 'Zugführer',
  technische_hilfe: 'Technische Hilfeleistung',
  lna: 'Leitender Notarzt',
  orgl: 'Organisatorischer Leiter',
  pilot: 'Hubschrauberpilot',
  gefahrgut: 'Gefahrgut (ABC)',
  wasserrettung: 'Wasserretter',
  hoehenretter: 'Höhenretter',
};

/** Höhere Qualifikationen schließen niedrigere ein (z. B. darf ein Notfallsanitäter auch KTW fahren). */
const QUALIFIKATION_UMFASST: Partial<Record<Qualifikation, Qualifikation[]>> = {
  notfallsanitaeter: ['rettungssanitaeter'],
  notarzt: ['rettungssanitaeter'],
  zugfuehrer: ['gruppenfuehrer'],
  lna: ['notarzt', 'rettungssanitaeter'],
  orgl: ['notfallsanitaeter', 'rettungssanitaeter'],
};

/** Hat jemand mit diesen Qualifikationen die gesuchte – direkt oder über eine höhere? */
export const besitztQualifikation = (qualifikationen: Qualifikation[], gesucht: Qualifikation) =>
  qualifikationen.some((q) => q === gesucht || (QUALIFIKATION_UMFASST[q] ?? []).includes(gesucht));

export interface FahrzeugTyp {
  /** Typbezeichnung, z. B. "RTW" oder "HLF 20" */
  typ: string;
  /** Ausgeschriebener Name */
  bezeichnung: string;
  kategorie: FahrzeugKategorie;
  organisation: EinsatzOrganisation;
  wachenArt: WachenArt;
  preis: number;
  /** Durchschnittliche Geschwindigkeit mit Sonderrechten (Luftlinie) */
  geschwindigkeitKmh: number;
  /** Sollbesatzung (Personen) */
  besatzung: number;
  /** Damit darf das Fahrzeug schon ausrücken – fehlt = Standard nach Größe (siehe getMindestBesatzung) */
  mindestBesatzung?: number;
  faehigkeiten: Faehigkeit[];
  /** Jede dieser Qualifikationen muss mindestens eine Person der Besatzung haben */
  pflichtQualifikationen?: Qualifikation[];
  /** Sonderfahrzeuge, die allein kaum Einsätze schaffen, gibt es nicht als Startfahrzeug */
  keinStartfahrzeug?: boolean;
  /** Erst kaufbar, wenn der Spieler ein eigenes Krankenhaus hat */
  brauchtEigenesKrankenhaus?: boolean;
  /** Erst kaufbar, wenn die Wache diese Sonder-Erweiterung hat (z. B. Hubschrauberlandeplatz) */
  brauchtErweiterung?: SonderErweiterungId;
  /** Kurzer Text für das Fahrzeug-Lexikon: wofür man das Fahrzeug braucht */
  beschreibung: string;
  /** Fliegt Luftlinie statt Straße (Hubschrauber) */
  luftfahrzeug?: boolean;
}

/** Alle Fahrzeugtypen, die im Spiel gekauft bzw. als Startfahrzeug gewählt werden können. */
export const FAHRZEUG_TYPEN: FahrzeugTyp[] = [
  // ---- Rettungsdienst ----
  {
    typ: 'RTW', bezeichnung: 'Rettungswagen', kategorie: 'RTW', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 4000, geschwindigkeitKmh: 60, besatzung: 2, faehigkeiten: ['patientenversorgung', 'patiententransport'], pflichtQualifikationen: ['notfallsanitaeter'],
    beschreibung: 'Das Arbeitstier im Rettungsdienst: versorgt Notfallpatienten vor Ort und bringt sie ins Krankenhaus.',
  },
  {
    typ: 'NEF', bezeichnung: 'Notarzteinsatzfahrzeug', kategorie: 'NEF', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 3500, geschwindigkeitKmh: 70, besatzung: 2, faehigkeiten: ['notarzt', 'patientenversorgung'], pflichtQualifikationen: ['notarzt'],
    beschreibung: 'Bringt den Notarzt schnell zum Einsatz. Transportiert selbst keine Patienten – dafür braucht es einen RTW.',
  },
  {
    typ: 'KTW', bezeichnung: 'Krankentransportwagen', kategorie: 'KTW', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 2500, geschwindigkeitKmh: 55, besatzung: 2, faehigkeiten: ['patiententransport'], pflichtQualifikationen: ['rettungssanitaeter'],
    keinStartfahrzeug: true, brauchtEigenesKrankenhaus: true,
    beschreibung: 'Für planbare Krankentransporte ohne Notfall. Entlastet die RTW.',
  },
  {
    typ: 'ITW', bezeichnung: 'Intensivtransportwagen', kategorie: 'ITW', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 9000, geschwindigkeitKmh: 55, besatzung: 3, faehigkeiten: ['patientenversorgung', 'patiententransport', 'notarzt', 'intensivtransport'],
    pflichtQualifikationen: ['notarzt', 'notfallsanitaeter'], keinStartfahrzeug: true,
    beschreibung: 'Rollende Intensivstation mit Arzt an Bord. Kann überall einspringen, wo ein RTW gebraucht wird.',
  },
  {
    typ: 'RTH', bezeichnung: 'Rettungshubschrauber', kategorie: 'RTH', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 60000, geschwindigkeitKmh: 220, besatzung: 3, faehigkeiten: ['notarzt', 'patientenversorgung', 'luftrettung'],
    pflichtQualifikationen: ['pilot', 'notarzt'], keinStartfahrzeug: true, brauchtErweiterung: 'hubschrauberlandeplatz', luftfahrzeug: true,
    beschreibung: 'Bringt den Notarzt aus der Luft – sehr schnell, auch weit draußen. Zählt überall, wo ein NEF gebraucht wird.',
  },
  {
    typ: 'KdoW-LNA', bezeichnung: 'Kommandowagen Leitender Notarzt', kategorie: 'LNA', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 3000, geschwindigkeitKmh: 70, besatzung: 1, faehigkeiten: ['leitender_notarzt'], pflichtQualifikationen: ['lna'],
    keinStartfahrzeug: true, brauchtErweiterung: 'fuehrungsdienst',
    beschreibung: 'Der Leitende Notarzt behält bei vielen Verletzten den medizinischen Überblick.',
  },
  {
    typ: 'KdoW-OrgL', bezeichnung: 'Kommandowagen Organisatorischer Leiter', kategorie: 'OrgL', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 3000, geschwindigkeitKmh: 70, besatzung: 1, faehigkeiten: ['organisatorische_leitung'], pflichtQualifikationen: ['orgl'],
    keinStartfahrzeug: true, brauchtErweiterung: 'fuehrungsdienst',
    beschreibung: 'Organisiert bei großen Lagen Bereitstellungsraum, Abtransport und Zusammenarbeit mit der Feuerwehr.',
  },
  {
    typ: 'GW-San', bezeichnung: 'Gerätewagen Sanität', kategorie: 'GW-San', organisation: 'Rettungsdienst', wachenArt: 'Rettungswache',
    preis: 5000, geschwindigkeitKmh: 55, besatzung: 6, faehigkeiten: ['sanitaetsdienst'], pflichtQualifikationen: ['rettungssanitaeter'],
    keinStartfahrzeug: true, brauchtErweiterung: 'seg',
    beschreibung: 'Schnelleinsatzgruppe mit Material für viele Verletzte (Behandlungsplatz, Tragen, Zelte).',
  },
  // ---- Feuerwehr: Löschfahrzeuge ----
  {
    typ: 'TSF-W', bezeichnung: 'Tragkraftspritzenfahrzeug Wasser', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 3000, geschwindigkeitKmh: 55, besatzung: 6, faehigkeiten: ['brandbekaempfung'], pflichtQualifikationen: ['gruppenfuehrer'],
    beschreibung: 'Kleines, günstiges Löschfahrzeug mit Wassertank – typisch für kleine Ortsfeuerwehren.',
  },
  {
    typ: 'MLF', bezeichnung: 'Mittleres Löschfahrzeug', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 4000, geschwindigkeitKmh: 54, besatzung: 6, faehigkeiten: ['brandbekaempfung', 'technische_hilfe'], pflichtQualifikationen: ['gruppenfuehrer'],
    beschreibung: 'Wendiges Löschfahrzeug mit etwas Technik für kleinere Hilfeleistungen.',
  },
  {
    typ: 'LF 10', bezeichnung: 'Löschgruppenfahrzeug 10', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5000, geschwindigkeitKmh: 52, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe'], pflichtQualifikationen: ['gruppenfuehrer'],
    beschreibung: 'Solides Löschfahrzeug für eine ganze Gruppe – Brände und einfache technische Hilfe.',
  },
  {
    typ: 'LF 20', bezeichnung: 'Löschgruppenfahrzeug 20', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6500, geschwindigkeitKmh: 50, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe'], pflichtQualifikationen: ['gruppenfuehrer'],
    beschreibung: 'Größere Pumpe und mehr Wasser als das LF 10 – das Standard-Löschfahrzeug der Städte.',
  },
  {
    typ: 'HLF 10', bezeichnung: 'Hilfeleistungslöschgruppenfahrzeug 10', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7000, geschwindigkeitKmh: 51, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe', 'rettungsgeraet'],
    pflichtQualifikationen: ['gruppenfuehrer', 'technische_hilfe'],
    beschreibung: 'Löschen und Retten in einem: mit Schere und Spreizer für eingeklemmte Personen.',
  },
  {
    typ: 'HLF 20', bezeichnung: 'Hilfeleistungslöschgruppenfahrzeug 20', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 8000, geschwindigkeitKmh: 50, besatzung: 9, faehigkeiten: ['brandbekaempfung', 'technische_hilfe', 'rettungsgeraet'],
    pflichtQualifikationen: ['gruppenfuehrer', 'technische_hilfe'],
    beschreibung: 'Das Allround-Fahrzeug der Berufsfeuerwehr: viel Wasser und volle Rettungstechnik.',
  },
  {
    typ: 'TLF 2000', bezeichnung: 'Tanklöschfahrzeug 2000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 4500, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
    beschreibung: 'Kleine Besatzung, 2000 Liter Wasser – schnell beim Brand, aber keine technische Hilfe.',
  },
  {
    typ: 'TLF 3000', bezeichnung: 'Tanklöschfahrzeug 3000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5500, geschwindigkeitKmh: 48, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
    beschreibung: '3000 Liter Wasser an Bord – gut, wo Hydranten knapp sind.',
  },
  {
    typ: 'TLF 4000', bezeichnung: 'Tanklöschfahrzeug 4000', kategorie: 'Löschfahrzeug', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7000, geschwindigkeitKmh: 46, besatzung: 3, faehigkeiten: ['brandbekaempfung'],
    beschreibung: 'Der große Tanker mit 4000 Litern – für Wald- und Flächenbrände.',
  },
  // ---- Feuerwehr: Sonderfahrzeuge ----
  {
    typ: 'DLK 23/12', bezeichnung: 'Drehleiter mit Korb', kategorie: 'Drehleiter', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 9000, geschwindigkeitKmh: 48, besatzung: 3, faehigkeiten: ['hoehenrettung', 'brandbekaempfung'], pflichtQualifikationen: ['maschinist_dlk'],
    beschreibung: 'Rettet Menschen aus oberen Stockwerken und löscht von oben.',
  },
  {
    typ: 'RW', bezeichnung: 'Rüstwagen', kategorie: 'Rüstwagen', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7500, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['technische_hilfe', 'schwere_technik', 'rettungsgeraet'],
    pflichtQualifikationen: ['technische_hilfe'], keinStartfahrzeug: true,
    beschreibung: 'Werkzeugkiste auf Rädern: Seilwinde, Hebekissen, schweres Rettungsgerät.',
  },
  {
    typ: 'ELW 1', bezeichnung: 'Einsatzleitwagen 1', kategorie: 'Einsatzleitwagen', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6000, geschwindigkeitKmh: 60, besatzung: 3, faehigkeiten: ['einsatzleitung'], pflichtQualifikationen: ['zugfuehrer'], keinStartfahrzeug: true,
    beschreibung: 'Der Zugführer leitet von hier aus größere Einsätze.',
  },
  {
    typ: 'ELW 2', bezeichnung: 'Einsatzleitwagen 2', kategorie: 'Einsatzleitwagen 2', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 12000, geschwindigkeitKmh: 50, besatzung: 4, faehigkeiten: ['einsatzleitung'], pflichtQualifikationen: ['zugfuehrer'],
    keinStartfahrzeug: true, brauchtErweiterung: 'fuehrungsstelle',
    beschreibung: 'Mobile Führungsstelle für Großlagen mit mehreren Einsatzabschnitten. Kann auch einen ELW 1 ersetzen.',
  },
  {
    typ: 'MTW', bezeichnung: 'Mannschaftstransportwagen', kategorie: 'MTW', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 2000, geschwindigkeitKmh: 65, besatzung: 9, mindestBesatzung: 1, faehigkeiten: ['mannschaftstransport'], keinStartfahrzeug: true,
    beschreibung: 'Bringt zusätzliche Einsatzkräfte zur Einsatzstelle, z. B. bei langen Pump- oder Aufräumarbeiten.',
  },
  {
    typ: 'GW-A', bezeichnung: 'Gerätewagen Atemschutz', kategorie: 'GW-A', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5000, geschwindigkeitKmh: 55, besatzung: 2, faehigkeiten: ['atemschutz'], keinStartfahrzeug: true,
    beschreibung: 'Bringt Nachschub an Atemschutzgeräten – Pflicht bei langen Innenangriffen.',
  },
  {
    typ: 'GW-Öl', bezeichnung: 'Gerätewagen Öl', kategorie: 'GW-Öl', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 4000, geschwindigkeitKmh: 55, besatzung: 3, faehigkeiten: ['oelbindung'], keinStartfahrzeug: true,
    beschreibung: 'Bindemittel, Ölsperren und Pumpen für große Ölschäden auf Straße und Wasser.',
  },
  {
    typ: 'SW 2000', bezeichnung: 'Schlauchwagen 2000', kategorie: 'Schlauchwagen', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 5500, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['wasserversorgung'], keinStartfahrzeug: true, brauchtErweiterung: 'logistik',
    beschreibung: 'Verlegt 2 km Schlauch während der Fahrt – Wasser für Wald- und Großbrände.',
  },
  {
    typ: 'GW-L2', bezeichnung: 'Gerätewagen Logistik 2', kategorie: 'GW-L2', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6000, geschwindigkeitKmh: 52, besatzung: 3, faehigkeiten: ['logistik'], keinStartfahrzeug: true, brauchtErweiterung: 'logistik',
    beschreibung: 'Fährt Nachschub: Schläuche, Sandsäcke, Verpflegung, Ersatzmaterial.',
  },
  {
    typ: 'FwK', bezeichnung: 'Feuerwehrkran', kategorie: 'Kran', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 15000, geschwindigkeitKmh: 40, besatzung: 2, faehigkeiten: ['kran', 'schwere_technik'], pflichtQualifikationen: ['technische_hilfe'],
    keinStartfahrzeug: true, brauchtErweiterung: 'logistik',
    beschreibung: 'Hebt umgestürzte LKW, Busse und Bäume. Langsam, aber durch nichts zu ersetzen.',
  },
  {
    typ: 'GW-G', bezeichnung: 'Gerätewagen Gefahrgut', kategorie: 'GW-G', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 9000, geschwindigkeitKmh: 50, besatzung: 3, faehigkeiten: ['gefahrgut'], pflichtQualifikationen: ['gefahrgut'],
    keinStartfahrzeug: true, brauchtErweiterung: 'gefahrgut',
    beschreibung: 'Chemikalienschutzanzüge, Auffangwannen, Abdichtmaterial – für Unfälle mit gefährlichen Stoffen.',
  },
  {
    typ: 'GW-Mess', bezeichnung: 'Gerätewagen Messtechnik', kategorie: 'GW-Mess', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7000, geschwindigkeitKmh: 60, besatzung: 3, faehigkeiten: ['messtechnik'], pflichtQualifikationen: ['gefahrgut'],
    keinStartfahrzeug: true, brauchtErweiterung: 'gefahrgut',
    beschreibung: 'Misst Gase und Schadstoffe – klärt, ob es gefährlich ist und wie weit evakuiert werden muss.',
  },
  {
    typ: 'GW-Wasserrettung', bezeichnung: 'Gerätewagen Wasserrettung', kategorie: 'Wasserrettung', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 6000, geschwindigkeitKmh: 55, besatzung: 4, faehigkeiten: ['wasserrettung'], pflichtQualifikationen: ['wasserrettung'],
    keinStartfahrzeug: true, brauchtErweiterung: 'wasserrettung',
    beschreibung: 'Mit Boot und Tauchausrüstung – rettet Personen aus Flüssen, Seen und vom Eis.',
  },
  {
    typ: 'GW-Höhenrettung', bezeichnung: 'Gerätewagen Höhenrettung', kategorie: 'Höhenrettung', organisation: 'Feuerwehr', wachenArt: 'Feuerwache',
    preis: 7500, geschwindigkeitKmh: 55, besatzung: 4, faehigkeiten: ['absturzsicherung'], pflichtQualifikationen: ['hoehenretter'],
    keinStartfahrzeug: true, brauchtErweiterung: 'hoehenrettung',
    beschreibung: 'Seiltechnik für Rettungen von Kränen, Masten und aus Schächten – wo die Drehleiter nicht hinkommt.',
  },
];

export function getFahrzeugTyp(typ?: string): FahrzeugTyp | undefined {
  return FAHRZEUG_TYPEN.find((eintrag) => eintrag.typ === typ);
}

export function getFahrzeugKategorie(typ?: string): FahrzeugKategorie | null {
  return getFahrzeugTyp(typ)?.kategorie ?? null;
}

export function getFahrzeugTypenFuerWache(wachenArt: WachenArt): FahrzeugTyp[] {
  return FAHRZEUG_TYPEN.filter((eintrag) => eintrag.wachenArt === wachenArt);
}

/** Kurzform des Typs für Funkrufnamen: „LF 20“ → „LF20“, „DLK 23/12“ → „DLK“ */
export const getFunkKurzname = (typ: string) => typ.replace(/\s+\d+\/\d+$/, '').replace(/\s+/g, '');

export const FUNKRUFNAME_MAX_LAENGE = 24;

/**
 * Nächster freier Funkrufname an einer Wache: „RTW-1“, „RTW-2“ … – gezählt je Wache und Typ.
 * Lücken (verkaufte Fahrzeuge) werden wieder aufgefüllt, doppelte Namen gibt es nicht.
 */
export function getNaechsterFunkrufname(
  typ: string,
  stationId: string | undefined,
  vehicles: Array<Pick<Vehicle, 'callsign' | 'stationId'>>,
): string {
  const kurz = getFunkKurzname(typ);
  const vergeben = new Set(vehicles.filter((vehicle) => vehicle.stationId === stationId).map((vehicle) => vehicle.callsign));
  let nummer = 1;
  while (vergeben.has(`${kurz}-${nummer}`)) nummer += 1;
  return `${kurz}-${nummer}`;
}

/** Pflicht-Qualifikationen eines Typs, die in dieser Besatzung noch niemand hat */
export function getFehlendeQualifikationen(
  typ: string | undefined,
  besatzung: Array<{ qualifikationen: Qualifikation[] }>,
): Qualifikation[] {
  return (getFahrzeugTyp(typ)?.pflichtQualifikationen ?? [])
    .filter((pflicht) => !besatzung.some((person) => besitztQualifikation(person.qualifikationen, pflicht)));
}

/**
 * Warum ein Typ an dieser Wache (noch) nicht kaufbar ist – oder null, wenn er kaufbar ist.
 * Prüft Wachenart, eigenes Krankenhaus und Sonder-Erweiterung (nicht Geld und Stellplatz).
 */
export function getKaufSperre(
  typ: FahrzeugTyp,
  wache: { stationKind?: WachenArt; ausbau?: Record<string, number> },
  eigenesKrankenhaus: boolean,
): string | null {
  if (typ.wachenArt !== (wache.stationKind ?? 'Rettungswache')) return `${typ.typ} passt nicht zu einer ${wache.stationKind ?? 'Rettungswache'}.`;
  if (typ.brauchtEigenesKrankenhaus && !eigenesKrankenhaus) return 'erst mit eigenem Krankenhaus';
  if (typ.brauchtErweiterung && !(wache.ausbau?.[typ.brauchtErweiterung] ?? 0)) return 'Erweiterung nötig';
  return null;
}

/** Fahrzeugtypen, die beim Bau einer Wache als Startfahrzeug wählbar sind */
export function getStartfahrzeugTypen(wachenArt: WachenArt): FahrzeugTyp[] {
  return getFahrzeugTypenFuerWache(wachenArt).filter((eintrag) => !eintrag.keinStartfahrzeug);
}

export function hatFaehigkeit(typ: string | undefined, faehigkeit: Faehigkeit): boolean {
  return getFahrzeugTyp(typ)?.faehigkeiten.includes(faehigkeit) ?? false;
}

/** Fliegt dieser Typ (Luftlinie, keine Straßenroute)? */
export const istLuftfahrzeug = (typ?: string) => getFahrzeugTyp(typ)?.luftfahrzeug === true;

/** Geschwindigkeit eines Fahrzeugtyps (unbekannte Typen fahren mit dem Durchschnitt). */
export function getFahrzeugGeschwindigkeit(typ?: string): number {
  return getFahrzeugTyp(typ)?.geschwindigkeitKmh ?? GAME_CONFIG.averageSpeedKmh;
}

/**
 * Mit so vielen Personen darf ein Fahrzeug ausrücken – wie in echt muss nicht jeder Sitz belegt sein:
 * Gruppe (9) fährt auch als Staffel (6), Staffel (6) als 4er-Trupp, kleine Fahrzeuge mit einer Person weniger (mind. 2).
 */
export function getMindestBesatzung(typ?: string): number {
  const fahrzeugTyp = getFahrzeugTyp(typ);
  if (!fahrzeugTyp) return 1;
  if (fahrzeugTyp.mindestBesatzung !== undefined) return fahrzeugTyp.mindestBesatzung;
  const soll = fahrzeugTyp.besatzung;
  if (soll >= 9) return 6;
  if (soll >= 6) return 4;
  return Math.min(soll, Math.max(2, soll - 1));
}

/** Ist das Fahrzeug ausreichend besetzt (Mindestbesatzung + Pflicht-Qualifikationen)? Ältere Spielstände ohne Angabe gelten als besetzt. */
export function istAusreichendBesetzt(vehicle: Pick<Vehicle, 'type' | 'besatzung' | 'fehlendeQualifikation'>): boolean {
  if (vehicle.fehlendeQualifikation) return false;
  if (vehicle.besatzung === undefined) return true;
  return vehicle.besatzung >= getMindestBesatzung(vehicle.type);
}

// ---------------------------------------------------------------------------
// Fahrzeugbedarf eines Einsatzes
// ---------------------------------------------------------------------------

/**
 * Wonach ein Einsatz fragt: eine Fahrzeugklasse oder eine Fähigkeit.
 * „Technische Hilfe“ können z. B. LF und HLF leisten, ein TLF aber nicht.
 */
export type BedarfsKlasse = FahrzeugKategorie | 'Technische Hilfe' | 'Rettungsgerät' | 'Krankentransport';

/** Neue Kategorien, die ein Einsatz genau so anfordert, wie sie heißen (ein Fahrzeug = ein Platz) */
const EINFACHE_KLASSEN: Array<[FahrzeugKategorie, string]> = [
  ['RTH', 'RTH'],
  ['ITW', 'ITW'],
  ['LNA', 'LNA'],
  ['OrgL', 'OrgL'],
  ['GW-San', 'GW-San'],
  ['Einsatzleitwagen 2', 'ELW 2'],
  ['MTW', 'MTW'],
  ['GW-A', 'GW-A'],
  ['GW-Öl', 'GW-Öl'],
  ['Schlauchwagen', 'SW'],
  ['GW-L2', 'GW-L2'],
  ['Kran', 'Kran'],
  ['GW-G', 'GW-G'],
  ['GW-Mess', 'GW-Mess'],
  ['Wasserrettung', 'GW-Wasserrettung'],
  ['Höhenrettung', 'GW-Höhenrettung'],
];

interface BedarfsKlassenInfo {
  /** Anzeige, z. B. „LF/HLF (Technische Hilfe)“ */
  label: string;
  kategorien?: FahrzeugKategorie[];
  faehigkeit?: Faehigkeit;
}

export const BEDARFS_KLASSEN: Record<BedarfsKlasse, BedarfsKlassenInfo> = {
  ...(Object.fromEntries(EINFACHE_KLASSEN.map(([kategorie, label]) => [kategorie, { label, kategorien: [kategorie] }])) as
    Record<(typeof EINFACHE_KLASSEN)[number][0], BedarfsKlassenInfo>),
  /** Ein ITW kann jeden RTW ersetzen */
  RTW: { label: 'RTW', kategorien: ['RTW', 'ITW'] },
  /** Der Notarzt kann auch mit dem Hubschrauber kommen */
  NEF: { label: 'NEF', kategorien: ['NEF', 'RTH'] },
  Löschfahrzeug: { label: 'Löschfahrzeug', kategorien: ['Löschfahrzeug'] },
  Drehleiter: { label: 'Drehleiter', kategorien: ['Drehleiter'] },
  KTW: { label: 'KTW', kategorien: ['KTW'] },
  Rüstwagen: { label: 'Rüstwagen', kategorien: ['Rüstwagen'] },
  /** Ein ELW 2 kann auch einen ELW 1 ersetzen */
  Einsatzleitwagen: { label: 'ELW', kategorien: ['Einsatzleitwagen', 'Einsatzleitwagen 2'] },
  'Technische Hilfe': { label: 'LF/HLF/RW (Techn. Hilfe)', faehigkeit: 'technische_hilfe' },
  /** Schere und Spreizer für eingeklemmte Personen: nur HLF und Rüstwagen */
  Rettungsgerät: { label: 'HLF/RW (Rettungsgerät)', faehigkeit: 'rettungsgeraet' },
  /** Krankentransport kann ein KTW oder ein RTW übernehmen */
  Krankentransport: { label: 'KTW/RTW (Krankentransport)', faehigkeit: 'patiententransport' },
};

export interface FahrzeugBedarf {
  id: string;
  category: BedarfsKlasse;
  amount: number;
}

export const getBedarfsLabel = (klasse: BedarfsKlasse) => BEDARFS_KLASSEN[klasse]?.label ?? klasse;

/** Kann ein Fahrzeug dieses Typs einen Platz dieser Bedarfsklasse füllen? */
export function fahrzeugErfuelltBedarf(typ: string | undefined, klasse: BedarfsKlasse): boolean {
  const fahrzeugTyp = getFahrzeugTyp(typ);
  const info = BEDARFS_KLASSEN[klasse];
  if (!fahrzeugTyp || !info) return false;
  if (info.kategorien && !info.kategorien.includes(fahrzeugTyp.kategorie)) return false;
  if (info.faehigkeit && !fahrzeugTyp.faehigkeiten.includes(info.faehigkeit)) return false;
  return true;
}

/**
 * Ordnet Fahrzeuge den Bedarfsplätzen zu – jedes Fahrzeug füllt höchstens einen Platz.
 * (Bipartites Matching: ein LF wird z. B. nicht gleichzeitig als Löschfahrzeug und als TH-Fahrzeug gezählt,
 * wird aber dorthin verschoben, wo es gebraucht wird.)
 * Ergebnis: je Bedarf (gleiche Reihenfolge) die IDs der zugeordneten Fahrzeuge.
 */
export function ordneFahrzeugeBedarfZu(
  bedarf: FahrzeugBedarf[],
  fahrzeuge: Array<{ id: string; type?: string }>,
): string[][] {
  const plaetze = bedarf.flatMap((eintrag, index) => Array.from({ length: eintrag.amount }, () => index));
  const platzVonFahrzeug = new Map<string, number>();

  const versuche = (platz: number, besucht: Set<string>): boolean => {
    for (const fahrzeug of fahrzeuge) {
      if (besucht.has(fahrzeug.id) || !fahrzeugErfuelltBedarf(fahrzeug.type, bedarf[plaetze[platz]].category)) continue;
      besucht.add(fahrzeug.id);
      const belegt = platzVonFahrzeug.get(fahrzeug.id);
      if (belegt === undefined || versuche(belegt, besucht)) {
        platzVonFahrzeug.set(fahrzeug.id, platz);
        return true;
      }
    }
    return false;
  };

  plaetze.forEach((_, platz) => versuche(platz, new Set()));

  const ergebnis: string[][] = bedarf.map(() => []);
  for (const [fahrzeugId, platz] of platzVonFahrzeug) ergebnis[plaetze[platz]].push(fahrzeugId);
  return ergebnis;
}

/** Wie viele Plätze je Bedarf fehlen noch, wenn diese Fahrzeuge da sind? */
export function getFehlendenBedarf(
  bedarf: FahrzeugBedarf[],
  fahrzeuge: Array<{ id: string; type?: string }>,
): Array<{ category: BedarfsKlasse; anzahl: number }> {
  const zuordnung = ordneFahrzeugeBedarfZu(bedarf, fahrzeuge);
  return bedarf
    .map((eintrag, index) => ({ category: eintrag.category, anzahl: eintrag.amount - zuordnung[index].length }))
    .filter((eintrag) => eintrag.anzahl > 0);
}

export const istBedarfGedeckt = (bedarf: FahrzeugBedarf[], fahrzeuge: Array<{ id: string; type?: string }>) =>
  getFehlendenBedarf(bedarf, fahrzeuge).length === 0;

/** z. B. „1× NEF, 2× Löschfahrzeug“ */
export const formatBedarfsListe = (eintraege: Array<{ category: BedarfsKlasse; anzahl: number }>) =>
  eintraege.map((eintrag) => `${eintrag.anzahl}× ${getBedarfsLabel(eintrag.category)}`).join(', ');

/** Bedarf zusammenführen (gleiche Klassen werden addiert) – z. B. bei einer Nachforderung. */
export function ergaenzeBedarf(bedarf: FahrzeugBedarf[], zusatz: FahrzeugBedarf[]): FahrzeugBedarf[] {
  const ergebnis = bedarf.map((eintrag) => ({ ...eintrag }));
  for (const neu of zusatz) {
    const vorhanden = ergebnis.find((eintrag) => eintrag.category === neu.category);
    if (vorhanden) vorhanden.amount += neu.amount;
    else ergebnis.push({ ...neu });
  }
  return ergebnis;
}
