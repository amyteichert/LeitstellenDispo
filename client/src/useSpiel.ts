import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_CONFIG,
  RUF_CONFIG,
  LAUFBAHN_START,
  RAENGE,
  findeNeueErfolge,
  getEinsatzXp,
  getRang,
  istFahrzeugFreigeschaltet,
  istPerfekterEinsatz,
  type Erfolg,
  type Koordinaten,
  type Laufbahn,
  type Rang,
  bucheLaufendeKosten,
  getLaufendeKosten,
  rechneLaufendeKostenAb,
  getWachenPreis,
  rechneEinsaetzeAb,
  getBelegteStellplaetze,
  getStellplaetze,
  getStellplatzPreis,
  hatFreienStellplatz,
  mitStellplatzErweiterung,
  mitWachenAnpassung,
  mitSonderErweiterung,
  getSonderErweiterung,
  getKaufSperre,
  istLogoFarbe,
  besetzeAutomatisch,
  erzeugeBesatzungFuer,
  bereinigePersonal,
  ladeAao,
  type AaoEintrag,
  type GrafikAuswahl,
  getPersonalDerWache,
  getPersonalLimit,
  getRuheraumPreis,
  kannUmbesetzen,
  mitRuheraumAusbau,
  synchronisiereBesatzung,
  QUALIFIKATION_LABELS,
  getNaechsterRaumPreis,
  getRaumUpgradePreis,
  hatAusbildungsbereich,
  istInAusbildung,
  mitNeuemRaum,
  mitRaumUpgrade,
  schliesseLehrgaengeAb,
  starteLehrgang,
  ZUFRIEDENHEITS_AUSBAUTEN,
  erzeugeAlarmDurchsage,
  erzeugeMeldungsFunk,
  erzeugeStatusFunk,
  fuegeFunkHinzu,
  getMeldungKey,
  getStatusStand,
  quittiereSprechwunsch,
  type FunkSpruch,
  erhoeheStress,
  getZufriedenheitsAusbauPreis,
  mitZufriedenheitsAusbau,
  FUNKRUFNAME_MAX_LAENGE,
  getFunkKurzname,
  getNaechsterFunkrufname,
  brauchtNeueBewerber,
  mitNeuenBewerbern,
  getNeuWuerfelnAb,
  ohneBewerber,
  getBewerberFaktor,
  getZufriedenheit,
  pruefeKuendigungen,
  type Kuendigung,
  type ZufriedenheitsAusbau,
  type AbgeschlossenerLehrgang,
  type Bewerber,
  type Mitarbeiter,
  type Qualifikation,
  alarmiereFahrzeuge,
  rueckalarmiereAlle,
  rueckalarmiereFahrzeug,
  zaehleRettungswachen,
  berechneSpielTick,
  createNeuesSpiel,
  entferneWache,
  erzeugeZufallsEinsatz,
  hatEigenesKrankenhaus,
  EIGENES_KRANKENHAUS,
  FACHRICHTUNGEN,
  KRANKENHAUS_RUF,
  mitNeuerPflegekraft,
  mitFachrichtung,
  mitNotaufnahmePlatz,
  pruefeNotaufnahmePlatz,
  NOTAUFNAHME,
  mitNotaufnahme,
  pruefePflegekraft,
  pruefeFachrichtung,
  pruefeKrankenhausBau,
  type Fachrichtung,
  deutscheZeit,
  einsatzIntervallMs,
  entstehtEinsatz,
  maxOffeneEinsaetze,
  type AufkommenKontext,
  type Wetter,
  formatEinsatzTitel,
  getFahrzeugTyp,
  type AbgeschlossenerSpielEinsatz,
  type Adresse,
  type Krankenhaus,
  type SpielEinsatz,
  type StationKind,
} from '@leitstellendispo/shared';
import { getEinstellungen } from './einstellungen';
import { bestaetigeKorrekturen, holeSchichtzulage, ladeKorrekturen } from './konto';
import type { FinanceTransaction, MapLocation, Vehicle } from './types';
import { SPIELSTAND_VERSION, spielstandSpeicher, type Spielstand } from './spielstand';
import { aufStrasseSetzen } from './strassenSnap';
import { spieleFanfare, spieleKasse } from './ton';

/** Ein gerade bezahlter Einsatz – für die kurze „+ €“-Einblendung auf der Karte */
export interface Belohnung {
  id: string;
  coords: Koordinaten;
  betrag: number;
  xp: number;
  zeit: number;
}

/** So lange bleibt eine Belohnung auf der Karte stehen */
export const BELOHNUNG_ANZEIGE_MS = 2500;

export interface NeueWache {
  name: string;
  stationKind: StationKind;
  coords: [number, number];
  details: string;
  startFahrzeugTyp: string;
  funkrufname: string;
  /** Strukturierte Adresse aus der Adresssuche (fehlt bei Klick auf die Karte) */
  adresse?: Adresse;
}

interface UseSpielOptionen {
  /** Wird aufgerufen, nachdem ein Spielstand geladen oder ein neues Spiel gestartet wurde */
  onSpielstandAngewendet?: (spielstand: Spielstand) => void;
  /** Wird aufgerufen, wenn Einsätze abgeschlossen wurden */
  onEinsaetzeAbgeschlossen?: (einsatzIds: string[]) => void;
  /** Aktuelles Wetter am Ort der ersten Wache (beeinflusst das Einsatzaufkommen) */
  wetter?: Wetter;
  /** Wird aufgerufen, wenn nie alarmierte Einsätze nach langer Zeit verschwunden sind */
  onEinsaetzeVerfallen?: (einsatzIds: string[]) => void;
}

/**
 * Spielzustand und Spielablauf (Laden/Speichern, Zeit, Einsatzerzeugung, Spiel-Tick) samt Aktionen.
 * Die eigentliche Logik steckt in reinen Funktionen in `@leitstellendispo/shared` (später auch auf dem Server nutzbar).
 */
export function useSpiel(optionen: UseSpielOptionen = {}) {
  const optionenRef = useRef(optionen);
  optionenRef.current = optionen;

  const [startSpiel] = useState(createNeuesSpiel);
  const [locations, setLocations] = useState<MapLocation[]>(startSpiel.locations);
  const [vehicles, setVehicles] = useState<Vehicle[]>(startSpiel.vehicles);
  const [balance, setBalance] = useState<number>(startSpiel.balance);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>(startSpiel.transactions);
  const [incidents, setIncidents] = useState<SpielEinsatz[]>(startSpiel.incidents);
  const [completedIncidentHistory, setCompletedIncidentHistory] = useState<AbgeschlossenerSpielEinsatz[]>(startSpiel.completedIncidentHistory);
  const [krankenhaeuser, setKrankenhaeuser] = useState<Krankenhaus[]>(startSpiel.krankenhaeuser);
  const [ruf, setRuf] = useState<number>(startSpiel.ruf ?? RUF_CONFIG.start);
  const [personal, setPersonal] = useState<Mitarbeiter[]>(startSpiel.personal ?? []);
  const [laufbahn, setLaufbahn] = useState<Laufbahn>(startSpiel.laufbahn ?? LAUFBAHN_START);
  const [belohnungen, setBelohnungen] = useState<Belohnung[]>([]);
  const [befoerderung, setBefoerderung] = useState<Rang | null>(null);
  const [erfolgsMeldungen, setErfolgsMeldungen] = useState<Erfolg[]>([]);
  // Für die Abrechnung im Tick immer den aktuellsten Ruf verwenden
  const rufRef = useRef(ruf);
  rufRef.current = ruf;
  const [nowMs, setNowMs] = useState(Date.now());
  // Erst nach dem Laden wird gespeichert und werden Einsätze erzeugt (sonst würde ein leerer Stand den gespeicherten überschreiben)
  const [spielstandGeladen, setSpielstandGeladen] = useState(false);
  // Laden fehlgeschlagen (z. B. Server weg): Dann wird auch nichts gespeichert, damit der echte Stand erhalten bleibt
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const addTransaction = (kind: FinanceTransaction['kind'], label: string, amount: number) => {
    setTransactions((cur) => [{
      id: `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      kind,
      label,
      amount,
      createdAt: new Date().toISOString(),
    }, ...cur]);
  };

  /** Legt ein Fahrzeug an. Die Besatzung ergibt sich aus dem zugewiesenen Personal (neu = leer). */
  const addVehicle = (v: Omit<Vehicle, 'id'>): Vehicle => {
    const id = `fahrzeug-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const fahrzeug: Vehicle = { ...v, id, status: v.status ?? 'Einsatzbereit' };
    setVehicles((cur) => [...cur, fahrzeug]);
    return fahrzeug;
  };

  // Laufende Kosten (Gehälter, Unterhalt): minütlich abbuchen, aber nur solange das Spiel offen ist
  const [kostenAbgerechnetBis, setKostenAbgerechnetBis] = useState<number | undefined>(undefined);
  const laufendeKosten = useMemo(
    () => getLaufendeKosten({ locations, vehicles, personal, krankenhaeuser }),
    [locations, vehicles, personal, krankenhaeuser],
  );
  useEffect(() => {
    if (!spielstandGeladen) return;
    const ergebnis = rechneLaufendeKostenAb(laufendeKosten.gesamt, kostenAbgerechnetBis, nowMs);
    if (ergebnis.abgerechnetBis === kostenAbgerechnetBis) return;
    setKostenAbgerechnetBis(ergebnis.abgerechnetBis);
    if (ergebnis.betrag > 0) {
      setBalance((cur) => cur - ergebnis.betrag);
      setTransactions((cur) => bucheLaufendeKosten(cur, ergebnis.betrag, nowMs));
    }
  }, [spielstandGeladen, nowMs, laufendeKosten.gesamt, kostenAbgerechnetBis]);

  // Fällige Lehrgänge abschließen (auch solche, die während das Spiel geschlossen war, geendet haben)
  const [ausbildungsAbschluesse, setAusbildungsAbschluesse] = useState<AbgeschlossenerLehrgang[]>([]);
  useEffect(() => {
    const ergebnis = schliesseLehrgaengeAb(locations, personal, nowMs);
    if (ergebnis.abgeschlossen.length === 0) return;
    setLocations(ergebnis.locations);
    setPersonal(ergebnis.personal);
    setAusbildungsAbschluesse((current) => [...ergebnis.abgeschlossen, ...current].slice(0, 10));
  }, [locations, personal, nowMs]);

  // Stündlich: Kündigt jemand wegen niedriger Zufriedenheit? (nur unter 40 %)
  const [kuendigungen, setKuendigungen] = useState<Kuendigung[]>([]);
  useEffect(() => {
    if (!spielstandGeladen) return;
    const unterwegs = (fahrzeugId: string) => {
      const fahrzeug = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
      return fahrzeug ? !kannUmbesetzen(fahrzeug) : false;
    };
    const ergebnis = pruefeKuendigungen(locations, personal, unterwegs, nowMs);
    if (ergebnis.locations !== locations) setLocations(ergebnis.locations);
    if (ergebnis.personal !== personal) setPersonal(ergebnis.personal);
    if (ergebnis.kuendigungen.length > 0) setKuendigungen((current) => [...ergebnis.kuendigungen, ...current].slice(0, 20));
  }, [spielstandGeladen, locations, personal, vehicles, nowMs]);

  // Korrekturen des Teams (z. B. nach einem Bug): abholen, einbuchen, bestätigen – beim Laden und jede Minute.
  // Bereits eingebuchte IDs werden gemerkt, damit nichts doppelt gebucht wird, falls die Bestätigung hängt.
  // Die Schichtzulage kommt auf demselben Weg: der Server legt sie höchstens einmal pro Tag als Korrektur an.
  const eingebuchteKorrekturen = useRef(new Set<number>());
  const [schichtzulage, setSchichtzulage] = useState<{ betrag: number; serie: number; morgen: number } | null>(null);
  const [willkommen, setWillkommen] = useState(false);
  useEffect(() => {
    if (!spielstandGeladen) return;
    let abgebrochen = false;
    const holen = async () => {
      const zulage = await holeSchichtzulage();
      if (!abgebrochen && zulage?.erhalten) setSchichtzulage({ betrag: zulage.betrag, serie: zulage.serie, morgen: zulage.morgen });
      const korrekturen = (await ladeKorrekturen()).filter((k) => !eingebuchteKorrekturen.current.has(k.id));
      if (abgebrochen || korrekturen.length === 0) return;
      for (const korrektur of korrekturen) {
        eingebuchteKorrekturen.current.add(korrektur.id);
        if (korrektur.guthabenAenderung !== 0) {
          setBalance((cur) => cur + korrektur.guthabenAenderung);
          const label = korrektur.art === 'schichtzulage' ? korrektur.grund : `Korrektur durch das Team – ${korrektur.grund}`;
          addTransaction(korrektur.guthabenAenderung > 0 ? 'Einnahme' : 'Ausgabe', label, Math.abs(korrektur.guthabenAenderung));
        }
        if (korrektur.rufNeu !== null) setRuf(korrektur.rufNeu);
      }
      await bestaetigeKorrekturen(korrekturen.map((k) => k.id));
    };
    void holen();
    const interval = setInterval(() => void holen(), 60_000);
    return () => {
      abgebrochen = true;
      clearInterval(interval);
    };
  }, [spielstandGeladen]);

  // Bewerber: Abgelaufene (oder noch fehlende) Bewerber-Listen der Wachen erneuern (alle 24 Std.)
  useEffect(() => {
    if (!spielstandGeladen) return;
    if (!locations.some((location) => location.type === 'station' && brauchtNeueBewerber(location, nowMs))) return;
    setLocations((current) => current.map((location) => (
      location.type === 'station' && brauchtNeueBewerber(location, nowMs)
        ? mitNeuenBewerbern(location, nowMs, getBewerberFaktor(getZufriedenheit(location, nowMs)))
        : location
    )));
  }, [spielstandGeladen, locations, nowMs]);

  /** Spieler würfelt die Bewerber einer Wache selbst neu – höchstens alle 12 Std. */
  const wuerfleBewerberNeu = (wacheId: string): string | null => {
    const wache = locations.find((location) => location.id === wacheId && location.type === 'station');
    if (!wache) return 'Wache nicht gefunden.';
    const jetzt = Date.now();
    const ab = getNeuWuerfelnAb(wache);
    if (jetzt < ab) {
      return `Neue Bewerber kannst du erst wieder am ${new Date(ab).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr anfordern.`;
    }
    setLocations((current) => current.map((location) => (
      location.id === wacheId ? mitNeuenBewerbern(location, jetzt, getBewerberFaktor(getZufriedenheit(location, jetzt)), true) : location
    )));
    return null;
  };

  // ---- Funkverkehr: Statuswechsel und neue Lagemeldungen erkennen ----
  const [funk, setFunk] = useState<FunkSpruch[]>(startSpiel.funk ?? []);
  // Eigene Alarm-Knöpfe (AAO)
  const [aao, setAao] = useState<AaoEintrag[]>(() => ladeAao(startSpiel.aao));
  // Gewählte Fahrzeuggrafiken je Typ
  const [grafiken, setGrafiken] = useState<GrafikAuswahl>(startSpiel.grafiken ?? {});
  const statusStand = useRef<Map<string, number> | null>(null);
  const bekannteMeldungen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!spielstandGeladen) return;
    const stand = getStatusStand(vehicles);
    // Erster Durchlauf nach dem Laden: nur merken, nicht funken
    if (statusStand.current) {
      const neue = erzeugeStatusFunk(statusStand.current, vehicles, Date.now());
      if (neue.length > 0) setFunk((current) => fuegeFunkHinzu(current, neue));
    }
    statusStand.current = stand;
  }, [spielstandGeladen, vehicles]);

  useEffect(() => {
    if (!spielstandGeladen) return;
    // Abgeschlossene Einsätze mitprüfen – ihre letzte Meldung (z. B. Übergabe) kommt im selben Schritt wie der Abschluss
    const einsaetze = [...incidents, ...completedIncidentHistory.slice(0, 10)];
    const alle = einsaetze.flatMap((einsatz) => einsatz.meldungen.map((meldung) => ({ einsatz, meldung, key: getMeldungKey(einsatz.id, meldung) })));
    if (bekannteMeldungen.current) {
      const neue = alle
        .filter(({ key }) => !bekannteMeldungen.current!.has(key))
        .map(({ einsatz, meldung }) => erzeugeMeldungsFunk(einsatz, meldung, vehicles));
      if (neue.length > 0) setFunk((current) => fuegeFunkHinzu(current, neue));
      alle.forEach(({ key }) => bekannteMeldungen.current!.add(key));
    } else {
      bekannteMeldungen.current = new Set(alle.map(({ key }) => key));
    }
  }, [spielstandGeladen, incidents, completedIncidentHistory]);

  /** Sprechaufforderung an ein Fahrzeug mit Sprechwunsch (Status 5). */
  const gibSprechaufforderung = (sprechwunschId: string) => {
    setFunk((current) => quittiereSprechwunsch(current, sprechwunschId, Date.now()));
  };

  // Personal gehört immer zur Wache seines Fahrzeugs (repariert falsch zugeordnete alte Spielstände)
  useEffect(() => {
    setPersonal((current) => bereinigePersonal(current, vehicles));
  }, [personal, vehicles]);

  // Besatzung der Fahrzeuge immer aus dem Personal ableiten
  useEffect(() => {
    setVehicles((current) => synchronisiereBesatzung(current, personal));
  }, [personal, vehicles]);

  const spielstandAnwenden = (spielstand: Spielstand) => {
    setBalance(spielstand.balance);
    setTransactions(spielstand.transactions);
    setLocations(spielstand.locations);
    setVehicles(spielstand.vehicles);
    setIncidents(spielstand.incidents);
    setCompletedIncidentHistory(spielstand.completedIncidentHistory);
    setKrankenhaeuser(spielstand.krankenhaeuser);
    setRuf(spielstand.ruf ?? RUF_CONFIG.start);
    setLaufbahn(spielstand.laufbahn ?? LAUFBAHN_START);
    setPersonal(spielstand.personal ?? []);
    setFunk(spielstand.funk ?? []);
    setAao(ladeAao(spielstand.aao));
    setGrafiken(spielstand.grafiken ?? {});
    setKostenAbgerechnetBis(spielstand.kostenAbgerechnetBis);
    // Nach dem Laden neu einlesen, ohne alte Meldungen und Status nochmal zu funken
    statusStand.current = null;
    bekannteMeldungen.current = null;
    optionenRef.current.onSpielstandAngewendet?.(spielstand);
  };

  // Spielstand beim Start laden
  useEffect(() => {
    let abgebrochen = false;
    spielstandSpeicher.laden().then(
      (spielstand) => {
        if (abgebrochen) return;
        if (spielstand) spielstandAnwenden(spielstand);
        else setWillkommen(true); // Erstes Spiel: Startguthaben begrüßen
        setSpielstandGeladen(true);
      },
      (error: unknown) => {
        if (abgebrochen) return;
        console.error(error);
        setLadeFehler('Dein Spielstand konnte nicht geladen werden. Bitte prüfe, ob der Server läuft, und lade die Seite neu.');
      },
    );
    return () => {
      abgebrochen = true;
    };
  }, []);

  // Spielstand automatisch speichern (kurz verzögert, damit nicht bei jeder Kleinigkeit geschrieben wird)
  useEffect(() => {
    if (!spielstandGeladen) return;
    const timeout = setTimeout(() => {
      spielstandSpeicher.speichern({
        version: SPIELSTAND_VERSION,
        gespeichertAm: new Date().toISOString(),
        balance,
        transactions,
        locations,
        vehicles,
        incidents,
        completedIncidentHistory,
        krankenhaeuser,
        ruf,
        laufbahn,
        personal,
        funk,
        kostenAbgerechnetBis,
        aao,
        grafiken,
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [spielstandGeladen, balance, transactions, locations, vehicles, incidents, completedIncidentHistory, krankenhaeuser, ruf, laufbahn, personal, funk, kostenAbgerechnetBis, aao, grafiken]);

  // Spielzeit
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Neue Einsätze in regelmäßigen Abständen
  // Neue Einsätze: Häufigkeit und Art nach deutscher Uhrzeit, Wochentag, Wachenzahl und Wetter.
  // Eigener Sekundentakt mit Refs – sonst würde jede Fahrzeugbewegung den Takt neu starten.
  const eigenesKrankenhaus = hatEigenesKrankenhaus(krankenhaeuser);
  const erzeugungRef = useRef({ locations, vehicles, wetter: 'klar' as Wetter, krankenhaeuser, xp: laufbahn.xp });
  erzeugungRef.current = { locations, vehicles, wetter: optionen.wetter ?? 'klar', krankenhaeuser, xp: laufbahn.xp };
  /** Einsatzort auf die nächste Straße verschieben (nicht im Wasser/Wald), solange noch niemand alarmiert ist. */
  const strasseNachziehen = (einsatz: SpielEinsatz) => {
    if (einsatz.verlegung) return;
    void aufStrasseSetzen(einsatz.coords).then((coords) => {
      if (coords === einsatz.coords) return;
      setIncidents((current) => current.map((incident) => (incident.id === einsatz.id && incident.alarmedVehicles.length === 0
        ? { ...incident, coords }
        : incident)));
    });
  };

  useEffect(() => {
    if (!spielstandGeladen) return;
    let zuletzt = Date.now();
    const interval = setInterval(() => {
      const jetzt = Date.now();
      const vergangen = jetzt - zuletzt;
      zuletzt = jetzt;
      const { locations: orte, vehicles: fahrzeuge, wetter, krankenhaeuser: kliniken, xp } = erzeugungRef.current;
      const wachen = orte.filter((location) => location.type === 'station').length;
      if (wachen === 0) return;
      const kontext: AufkommenKontext = { ...deutscheZeit(jetzt), wachen, wetter };
      // Einsatztempo aus den Einstellungen: kürzerer Abstand = mehr Einsätze
      if (!entstehtEinsatz(Math.min(vergangen, 5000), einsatzIntervallMs(kontext) / getEinstellungen().einsatzTempo)) return;
      let neuerEinsatz: SpielEinsatz | undefined;
      setIncidents((current) => {
        if (current.filter((incident) => incident.status !== 'abgeschlossen').length >= maxOffeneEinsaetze(wachen)) return current;
        const ergebnis = erzeugeZufallsEinsatz(orte, fahrzeuge, jetzt, kontext, kliniken, (typ) => istFahrzeugFreigeschaltet(typ, xp));
        if (!('einsatz' in ergebnis)) return current;
        neuerEinsatz = ergebnis.einsatz;
        return [ergebnis.einsatz, ...current];
      });
      const erzeugt = neuerEinsatz as SpielEinsatz | undefined;
      if (erzeugt) strasseNachziehen(erzeugt);
    }, 1000);
    return () => clearInterval(interval);
  }, [spielstandGeladen]);

  // Spiel-Tick: Ankunft, Lagemeldungen, Bearbeitung, Eskalation, Transport, Abschluss, Rückfahrt
  useEffect(() => {
    const ergebnis = berechneSpielTick({ vehicles, incidents, locations, krankenhaeuser }, nowMs);
    if (!ergebnis.geaendert) return;

    setVehicles(ergebnis.vehicles);
    setIncidents(ergebnis.incidents);
    if (ergebnis.krankenhaeuser) setKrankenhaeuser(ergebnis.krankenhaeuser);

    if (ergebnis.abgeschlossen.length > 0) {
      // Grundgeld gibt es immer, dazu ein Leistungsbonus abhängig von Anfahrt und Ruf
      const abrechnung = rechneEinsaetzeAb(ergebnis.abgeschlossen, rufRef.current);
      rufRef.current = abrechnung.ruf;
      setRuf(abrechnung.ruf);
      setCompletedIncidentHistory((current) => [
        ...[...abrechnung.einsaetze].reverse(),
        ...current,
      ].slice(0, GAME_CONFIG.completedIncidentHistoryLimit));
      const summe = abrechnung.einsaetze.reduce((sum, incident) => sum + incident.reward + (incident.bewertung?.bonus ?? 0), 0);
      setBalance((cur) => cur + summe);
      // Laufbahn: Erfahrungspunkte je Einsatz, dazu die kurze „+ €“-Einblendung auf der Karte
      const xpJeEinsatz = abrechnung.einsaetze.map((incident) => getEinsatzXp(incident));
      const perfekt = abrechnung.einsaetze.filter((incident) => istPerfekterEinsatz(incident.bewertung)).length;
      setLaufbahn((cur) => ({
        ...cur,
        xp: cur.xp + xpJeEinsatz.reduce((a, b) => a + b, 0),
        einsaetze: cur.einsaetze + abrechnung.einsaetze.length,
        perfekt: cur.perfekt + perfekt,
      }));
      const angezeigtAb = Date.now();
      setBelohnungen((cur) => [
        ...cur.filter((b) => angezeigtAb - b.zeit < BELOHNUNG_ANZEIGE_MS),
        ...abrechnung.einsaetze.map((incident, i) => ({
          id: `${incident.id}-${angezeigtAb}`,
          coords: incident.coords,
          betrag: incident.reward + (incident.bewertung?.bonus ?? 0),
          xp: xpJeEinsatz[i],
          zeit: angezeigtAb,
        })),
      ]);
      spieleKasse();
      abrechnung.einsaetze.forEach((incident) => {
        addTransaction('Einnahme', `${incident.organization} – ${formatEinsatzTitel(incident)} abgeschlossen`, incident.reward);
        if (incident.bewertung && incident.bewertung.bonus > 0) {
          addTransaction('Einnahme', `Leistungsbonus – ${formatEinsatzTitel(incident)}`, incident.bewertung.bonus);
        }
      });
      optionenRef.current.onEinsaetzeAbgeschlossen?.(ergebnis.abgeschlossen.map((incident) => incident.id));
    }
    if (ergebnis.verfallen.length > 0) {
      optionenRef.current.onEinsaetzeVerfallen?.(ergebnis.verfallen.map((incident) => incident.id));
    }
  }, [incidents, vehicles, nowMs, locations, krankenhaeuser]);

  const completedIncidentStats = useMemo(() => {
    const total = completedIncidentHistory.length;
    const rettungsdienst = completedIncidentHistory.filter((incident) => incident.organization === 'Rettungsdienst').length;
    const feuerwehr = completedIncidentHistory.filter((incident) => incident.organization === 'Feuerwehr').length;
    const earned = completedIncidentHistory.reduce((sum, incident) => sum + incident.reward + (incident.bewertung?.bonus ?? 0), 0);
    return { total, rettungsdienst, feuerwehr, earned };
  }, [completedIncidentHistory]);

  // ---- Aktionen ----

  /** Benennt ein Fahrzeug um (Funkrufname). Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const benenneFahrzeugUm = (fahrzeugId: string, name: string): string | null => {
    const neu = name.trim();
    if (!neu) return 'Der Funkrufname darf nicht leer sein.';
    if (neu.length > FUNKRUFNAME_MAX_LAENGE) return `Höchstens ${FUNKRUFNAME_MAX_LAENGE} Zeichen.`;
    if (!vehicles.some((vehicle) => vehicle.id === fahrzeugId)) return 'Fahrzeug nicht gefunden.';
    setVehicles((current) => current.map((vehicle) => (vehicle.id === fahrzeugId ? { ...vehicle, callsign: neu } : vehicle)));
    return null;
  };

  /** Kauft ein Fahrzeug für eine Wache. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const buyVehicle = (stationId: string, typ: string): string | null => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    const fahrzeugTyp = getFahrzeugTyp(typ);
    if (!station || !fahrzeugTyp) return 'Wache oder Fahrzeugtyp nicht gefunden.';
    if (fahrzeugTyp.wachenArt !== (station.stationKind ?? 'Rettungswache')) {
      return `${typ} passt nicht zu einer ${station.stationKind ?? 'Rettungswache'}.`;
    }
    if (fahrzeugTyp.brauchtEigenesKrankenhaus && !eigenesKrankenhaus) {
      return `Den ${typ} gibt es erst, wenn du ein eigenes Krankenhaus gebaut hast.`;
    }
    if (!istFahrzeugFreigeschaltet(typ, laufbahn.xp)) {
      return `Den ${typ} kannst du erst ${getKaufSperre(fahrzeugTyp, station, eigenesKrankenhaus, laufbahn.xp)} kaufen.`;
    }
    if (getKaufSperre(fahrzeugTyp, station, eigenesKrankenhaus)) {
      return `Für den ${typ} braucht die Wache erst die Erweiterung „${getSonderErweiterung(fahrzeugTyp.brauchtErweiterung ?? '')?.name}“ (unter „Ausbau“).`;
    }
    if (!hatFreienStellplatz(station, vehicles)) {
      return `Kein freier Stellplatz (${getBelegteStellplaetze(station.id, vehicles)} von ${getStellplaetze(station)} belegt). Erweitere die Wache unter „Ausbau“.`;
    }
    if (balance < fahrzeugTyp.preis) {
      return `Nicht genügend Guthaben. Benötigt: ${fahrzeugTyp.preis} €, verfügbar: ${balance} €.`;
    }

    setBalance((cur) => cur - fahrzeugTyp.preis);
    addTransaction('Ausgabe', `${typ} für ${station.name} gekauft`, fahrzeugTyp.preis);
    addVehicle({
      name: typ,
      type: typ,
      stationId,
      price: fahrzeugTyp.preis,
      callsign: getNaechsterFunkrufname(typ, stationId, vehicles),
    });
    return null;
  };

  /** Baut eine neue Wache mit Startfahrzeug. Gibt die neue Wachen-ID oder eine Fehlermeldung zurück. */
  /** Eigenes Krankenhaus bauen (Voraussetzungen: Wachen, Ruf, Geld) */
  const baueKrankenhaus = (name: string, coords: [number, number], adresse?: Adresse): string | null => {
    const grund = pruefeKrankenhausBau(zaehleRettungswachen(locations), ruf, balance);
    if (grund) return grund;
    const ort = adresse ?? { strasse: 'Klinikstraße', plz: '', ort: name };
    setKrankenhaeuser((current) => [...current, {
      id: `kh-eigen-${Date.now()}`,
      name: name.trim() || 'Eigenes Krankenhaus',
      adresse: ort,
      coords,
      aufnahme: true,
      eigen: true,
      fachbereiche: ['innere'],
      stationen: { innere: EIGENES_KRANKENHAUS.startPflegekraefte },
      notaufnahmePlaetze: NOTAUFNAHME.startPlaetze,
      ruf: KRANKENHAUS_RUF.start,
      aufnahmen: [],
    }]);
    setBalance((cur) => cur - EIGENES_KRANKENHAUS.preis);
    addTransaction('Ausgabe', `Krankenhaus gebaut: ${name}`, EIGENES_KRANKENHAUS.preis);
    return null;
  };

  const schalteFachrichtungFrei = (krankenhausId: string, fachrichtung: Fachrichtung): string | null => {
    const krankenhaus = krankenhaeuser.find((kh) => kh.id === krankenhausId && kh.eigen);
    if (!krankenhaus) return 'Krankenhaus nicht gefunden.';
    const grund = pruefeFachrichtung(krankenhaus, fachrichtung, ruf, balance);
    if (grund) return grund;
    const preis = FACHRICHTUNGEN[fachrichtung].preis;
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? mitFachrichtung(kh, fachrichtung) : kh)));
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${krankenhaus.name}: ${FACHRICHTUNGEN[fachrichtung].label}`, preis);
    return null;
  };

  /** Stellt eine Pflegekraft ein – jede betreut weitere Betten. */
  const stellePflegekraftEin = (krankenhausId: string, station: Fachrichtung): string | null => {
    const krankenhaus = krankenhaeuser.find((kh) => kh.id === krankenhausId && kh.eigen);
    if (!krankenhaus) return 'Krankenhaus nicht gefunden.';
    const grund = pruefePflegekraft(krankenhaus, station, balance);
    if (grund) return grund;
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? mitNeuerPflegekraft(kh, station) : kh)));
    setBalance((cur) => cur - EIGENES_KRANKENHAUS.pflegekraftPreis);
    addTransaction('Ausgabe', `${krankenhaus.name}: Pflegekraft (${FACHRICHTUNGEN[station].label})`, EIGENES_KRANKENHAUS.pflegekraftPreis);
    return null;
  };

  /** Ein weiterer Behandlungsplatz in der Notaufnahme. */
  const erweitereNotaufnahme = (krankenhausId: string): string | null => {
    const krankenhaus = krankenhaeuser.find((kh) => kh.id === krankenhausId && kh.eigen);
    if (!krankenhaus) return 'Krankenhaus nicht gefunden.';
    const grund = pruefeNotaufnahmePlatz(krankenhaus, balance);
    if (grund) return grund;
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? mitNotaufnahmePlatz(kh) : kh)));
    setBalance((cur) => cur - NOTAUFNAHME.platzPreis);
    addTransaction('Ausgabe', `${krankenhaus.name}: Platz in der Notaufnahme`, NOTAUFNAHME.platzPreis);
    return null;
  };

  /** Notaufnahme an-/abmelden (Abmelden kostet Ruf des Hauses). */
  const meldeNotaufnahme = (krankenhausId: string, angemeldet: boolean): string | null => {
    if (!krankenhaeuser.some((kh) => kh.id === krankenhausId && kh.eigen)) return 'Krankenhaus nicht gefunden.';
    const jetzt = Date.now();
    setKrankenhaeuser((current) => current.map((kh) => (kh.id === krankenhausId ? mitNotaufnahme(kh, angemeldet, jetzt) : kh)));
    return null;
  };

  const erstelleWache = (wache: NeueWache): { id: string } | { fehler: string } => {
    const stationPrice = getWachenPreis(wache.stationKind, locations.filter((location) => location.type === 'station').length);
    const vehiclePrice = getFahrzeugTyp(wache.startFahrzeugTyp)?.preis ?? 0;
    const totalCost = stationPrice + vehiclePrice;

    if (wache.startFahrzeugTyp && !istFahrzeugFreigeschaltet(wache.startFahrzeugTyp, laufbahn.xp)) {
      return { fehler: `Den ${wache.startFahrzeugTyp} kannst du als Startfahrzeug erst mit höherem Rang wählen.` };
    }

    if (balance < totalCost) {
      return { fehler: `Nicht genügend Guthaben für die Erstellung. Benötigt: ${totalCost} €, verfügbar: ${balance} €.` };
    }

    const name = wache.name.trim() || 'Neuer Standort';
    const locationId = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    const neueWache: MapLocation = {
      id: locationId,
      name,
      type: 'station',
      stationKind: wache.stationKind,
      coords: wache.coords,
      description: wache.stationKind === 'Feuerwache' ? 'Feuerwehr' : 'Rettungsdienst',
      details: wache.details.trim() || `Frei platzierbare ${wache.stationKind}`,
      price: stationPrice,
      adresse: wache.adresse,
    };
    setLocations((current) => [...current, neueWache]);
    // Patienten brauchen ein Krankenhaus in erreichbarer Nähe
    setBalance((cur) => cur - totalCost);
    addTransaction('Ausgabe', `${wache.stationKind} mit ${wache.startFahrzeugTyp} erstellt`, totalCost);

    if (wache.startFahrzeugTyp) {
      const startFahrzeug = addVehicle({
        name: wache.startFahrzeugTyp,
        type: wache.startFahrzeugTyp,
        stationId: locationId,
        price: vehiclePrice,
        // Neue Wache: das Startfahrzeug heißt automatisch z. B. „RTW-1“
        callsign: wache.funkrufname.trim().slice(0, FUNKRUFNAME_MAX_LAENGE) || `${getFunkKurzname(wache.startFahrzeugTyp)}-1`,
      });
      // Das Startfahrzeug kommt mit voller Besatzung
      setPersonal((current) => [...current, ...erzeugeBesatzungFuer(startFahrzeug)]);
    }

    return { id: locationId };
  };

  /** Baut einen zusätzlichen Stellplatz. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const erweitereStellplaetze = (stationId: string): string | null => {
    const station = locations.find((location) => location.id === stationId && location.type === 'station');
    if (!station) return 'Wache nicht gefunden.';
    const preis = getStellplatzPreis(station);
    if (preis === null) return 'Die Wache ist bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €, verfügbar: ${balance.toLocaleString('de-DE')} €.`;

    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Stellplatz-Erweiterung für ${station.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === stationId ? mitStellplatzErweiterung(location) : location)));
    return null;
  };

  /** Name und Logo-Farbe einer Wache ändern. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const passeWacheAn = (wacheId: string, aenderung: { name?: string; logoFarbe?: string | null; fahrzeugFarbe?: string | null }): string | null => {
    const wache = locations.find((location) => location.id === wacheId && location.type === 'station');
    if (!wache) return 'Wache nicht gefunden.';
    const ergebnis = mitWachenAnpassung(wache, aenderung);
    if ('fehler' in ergebnis) return ergebnis.fehler;
    setLocations((current) => current.map((location) => (location.id === wacheId ? ergebnis.wache : location)));
    return null;
  };

  const loescheWache = (id: string) => {
    const ergebnis = entferneWache({ locations, vehicles, incidents, personal }, id);
    setLocations(ergebnis.locations);
    setVehicles(ergebnis.vehicles);
    setIncidents(ergebnis.incidents);
    setPersonal(ergebnis.personal ?? []);
  };

  // ---- Personal ----

  const findeWache = (wacheId: string) => locations.find((location) => location.id === wacheId && location.type === 'station');

  /** Stellt einen Bewerber ein. Gibt eine Fehlermeldung zurück oder null bei Erfolg. */
  const stellePersonalEin = (wacheId: string, bewerber: Bewerber): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const limit = getPersonalLimit(wache);
    if (getPersonalDerWache(wacheId, personal).length >= limit) {
      return `Kein Platz mehr für Personal (${limit} von ${limit}). Baue unter „Ausbau“ Ruheräume.`;
    }
    if (balance < bewerber.preis) return `Nicht genügend Guthaben. Benötigt: ${bewerber.preis.toLocaleString('de-DE')} €.`;
    if (!wache.bewerber?.liste.some((b) => b.id === bewerber.id)) return 'Dieser Bewerber ist nicht mehr verfügbar.';

    setBalance((cur) => cur - bewerber.preis);
    addTransaction('Ausgabe', `${bewerber.name} für ${wache.name} eingestellt`, bewerber.preis);
    setPersonal((current) => [...current, { id: bewerber.id, name: bewerber.name, qualifikationen: bewerber.qualifikationen, wacheId }]);
    setLocations((current) => current.map((location) => (location.id === wacheId ? ohneBewerber(location, bewerber.id) : location)));
    return null;
  };

  const fahrzeugVon = (person: Mitarbeiter | undefined) => vehicles.find((vehicle) => vehicle.id === person?.fahrzeugId);

  /** Entlässt eine Person (keine Erstattung). Nicht möglich, solange ihr Fahrzeug unterwegs ist. */
  const entlassePersonal = (personId: string): string | null => {
    const person = personal.find((eintrag) => eintrag.id === personId);
    if (person && istInAusbildung(person)) return `${person.name} ist auf einem Lehrgang – erst danach möglich.`;
    const fahrzeug = fahrzeugVon(person);
    if (fahrzeug && !kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    setPersonal((current) => current.filter((person) => person.id !== personId));
    return null;
  };

  /** Weist eine Person einem Fahrzeug ihrer Wache zu (oder ohne `fahrzeugId` in die Reserve). */
  const weisePersonalZu = (personId: string, fahrzeugId?: string): string | null => {
    const person = personal.find((eintrag) => eintrag.id === personId);
    if (!person) return 'Person nicht gefunden.';
    if (istInAusbildung(person)) return `${person.name} ist auf einem Lehrgang.`;
    const bisher = fahrzeugVon(person);
    if (bisher && !kannUmbesetzen(bisher)) return `${bisher.callsign ?? bisher.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    if (fahrzeugId) {
      const ziel = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
      if (!ziel || ziel.stationId !== person.wacheId) return 'Das Fahrzeug gehört nicht zu dieser Wache.';
      if (!kannUmbesetzen(ziel)) return `${ziel.callsign ?? ziel.name} ist unterwegs – erst nach der Rückkehr möglich.`;
      const soll = getFahrzeugTyp(ziel.type)?.besatzung ?? 0;
      if (personal.filter((eintrag) => eintrag.fahrzeugId === fahrzeugId).length >= soll) return `${ziel.callsign ?? ziel.name} ist bereits voll besetzt.`;
    }
    setPersonal((current) => current.map((eintrag) => (eintrag.id === personId ? { ...eintrag, fahrzeugId } : eintrag)));
    return null;
  };

  /** Besetzt ein Fahrzeug mit freiem Personal der Wache (Pflicht-Qualifikation zuerst). */
  const besetzeFahrzeugAutomatisch = (fahrzeugId: string): string | null => {
    const fahrzeug = vehicles.find((vehicle) => vehicle.id === fahrzeugId);
    if (!fahrzeug) return 'Fahrzeug nicht gefunden.';
    if (!kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – erst nach der Rückkehr möglich.`;
    setPersonal((current) => besetzeAutomatisch(fahrzeug, current));
    return null;
  };

  // ---- Ausbildung ----

  /** Baut den Ausbildungsbereich (erster Raum) bzw. einen weiteren Raum. */
  const baueAusbildungsraum = (wacheId: string): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const preis = getNaechsterRaumPreis(wache);
    if (preis === null) return 'Es sind bereits alle Ausbildungsräume gebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${hatAusbildungsbereich(wache) ? 'Ausbildungsraum' : 'Ausbildungsbereich'} für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitNeuemRaum(location) : location)));
    return null;
  };

  /** Erweitert einen Ausbildungsraum um weitere Plätze. */
  const erweitereAusbildungsraum = (wacheId: string, raumId: string): string | null => {
    const wache = findeWache(wacheId);
    const raum = wache?.ausbildungsRaeume?.find((r) => r.id === raumId);
    if (!wache || !raum) return 'Raum nicht gefunden.';
    const preis = getRaumUpgradePreis(raum);
    if (preis === null) return 'Dieser Raum ist bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Ausbildungsraum erweitert (${wache.name})`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitRaumUpgrade(location, raumId) : location)));
    return null;
  };

  /** Startet einen Lehrgang. Teilnehmer, deren Fahrzeug unterwegs ist, können nicht teilnehmen. */
  const starteLehrgangAnWache = (wacheId: string, raumId: string, qualifikation: Qualifikation, teilnehmerIds: string[]): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    for (const id of teilnehmerIds) {
      const fahrzeug = fahrzeugVon(personal.find((person) => person.id === id));
      if (fahrzeug && !kannUmbesetzen(fahrzeug)) return `${fahrzeug.callsign ?? fahrzeug.name} ist unterwegs – Teilnehmer erst nach der Rückkehr anmelden.`;
    }
    const ergebnis = starteLehrgang({ wache, raumId, qualifikation, teilnehmerIds, personal, jetzt: Date.now() });
    if ('fehler' in ergebnis) return ergebnis.fehler;
    if (balance < ergebnis.kosten) return `Nicht genügend Guthaben. Benötigt: ${ergebnis.kosten.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - ergebnis.kosten);
    addTransaction('Ausgabe', `Lehrgang ${QUALIFIKATION_LABELS[qualifikation]} (${teilnehmerIds.length} Teilnehmer)`, ergebnis.kosten);
    setLocations((current) => current.map((location) => (location.id === wacheId ? ergebnis.wache : location)));
    setPersonal(ergebnis.personal);
    return null;
  };

  /** Baut Aufenthaltsraum, Küche oder Fitnessraum aus (höhere Zufriedenheit). */
  const baueZufriedenheitsAusbau = (wacheId: string, ausbauId: ZufriedenheitsAusbau['id']): string | null => {
    const wache = findeWache(wacheId);
    const ausbau = ZUFRIEDENHEITS_AUSBAUTEN.find((eintrag) => eintrag.id === ausbauId);
    if (!wache || !ausbau) return 'Ausbau nicht gefunden.';
    const preis = getZufriedenheitsAusbauPreis(wache, ausbau);
    if (preis === null) return `${ausbau.name} ist bereits voll ausgebaut.`;
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `${ausbau.name} für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitZufriedenheitsAusbau(location, ausbauId) : location)));
    return null;
  };

  /** Grafik für einen Fahrzeugtyp wählen (`undefined` = Standardgrafik) */
  const waehleTypGrafik = (typ: string, grafikId: number | undefined) => {
    setGrafiken((current) => {
      const neu = { ...current };
      if (grafikId === undefined) delete neu[typ];
      else neu[typ] = grafikId;
      return neu;
    });
  };

  /** Eigene Grafik nur für ein Fahrzeug (`undefined` = wie der Typ) */
  const waehleFahrzeugGrafik = (fahrzeugId: string, grafikId: number | undefined) => {
    setVehicles((current) => current.map((vehicle) => {
      if (vehicle.id !== fahrzeugId) return vehicle;
      const { grafikId: _alt, ...rest } = vehicle;
      return grafikId === undefined ? rest : { ...rest, grafikId };
    }));
  };

  /** Eigene Lackfarbe nur für ein Fahrzeug (`undefined` = wie die Wache) */
  const waehleFahrzeugFarbe = (fahrzeugId: string, farbe: string | undefined) => {
    if (farbe !== undefined && !istLogoFarbe(farbe)) return;
    setVehicles((current) => current.map((vehicle) => {
      if (vehicle.id !== fahrzeugId) return vehicle;
      const { farbe: _alt, ...rest } = vehicle;
      return farbe === undefined ? rest : { ...rest, farbe: farbe.toLowerCase() };
    }));
  };

  /** Baut eine Sonder-Erweiterung (schaltet Sonderfahrzeuge frei, z. B. Hubschrauberlandeplatz). */
  const baueSonderErweiterung = (wacheId: string, erweiterungId: string): string | null => {
    const wache = findeWache(wacheId);
    const erweiterung = getSonderErweiterung(erweiterungId);
    if (!wache || !erweiterung) return 'Erweiterung nicht gefunden.';
    const ergebnis = mitSonderErweiterung(wache, erweiterungId);
    if ('fehler' in ergebnis) return ergebnis.fehler;
    if (balance < erweiterung.preis) return `Nicht genügend Guthaben. Benötigt: ${erweiterung.preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - erweiterung.preis);
    addTransaction('Ausgabe', `${erweiterung.name} für ${wache.name}`, erweiterung.preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? ergebnis.wache : location)));
    return null;
  };

  /** Baut eine Ruheraum-Stufe (mehr Personal-Plätze). */
  const baueRuheraum = (wacheId: string): string | null => {
    const wache = findeWache(wacheId);
    if (!wache) return 'Wache nicht gefunden.';
    const preis = getRuheraumPreis(wache);
    if (preis === null) return 'Ruheräume sind bereits voll ausgebaut.';
    if (balance < preis) return `Nicht genügend Guthaben. Benötigt: ${preis.toLocaleString('de-DE')} €.`;
    setBalance((cur) => cur - preis);
    addTransaction('Ausgabe', `Ruheräume für ${wache.name}`, preis);
    setLocations((current) => current.map((location) => (location.id === wacheId ? mitRuheraumAusbau(location) : location)));
    return null;
  };

  /** Erzeugt sofort einen Test-Einsatz. Gibt die Einsatz-ID oder eine Fehlermeldung zurück. */
  const erzeugeTestEinsatz = (): { id: string } | { fehler: string } => {
    const ergebnis = erzeugeZufallsEinsatz(locations, vehicles, Date.now(), undefined, krankenhaeuser);
    if ('fehler' in ergebnis) {
      return {
        fehler: ergebnis.fehler === 'keine-wache'
          ? 'Bitte erst eine Wache erstellen.'
          : 'Für diese Wache gibt es aktuell keinen Einsatz, den deine Fahrzeuge schaffen können.',
      };
    }
    setIncidents((current) => [ergebnis.einsatz, ...current]);
    strasseNachziehen(ergebnis.einsatz);
    return { id: ergebnis.einsatz.id };
  };

  const alarmieren = (incidentId: string, vehicleIds: string[]) => {
    const jetzt = Date.now();
    const ergebnis = alarmiereFahrzeuge({ incidents, vehicles, locations }, incidentId, vehicleIds, jetzt);
    setIncidents(ergebnis.incidents);
    setVehicles(ergebnis.vehicles);
    // Jede tatsächlich alarmierte Besatzung bekommt Stress (Dauerstress senkt die Zufriedenheit)
    const vorher = new Set(incidents.find((incident) => incident.id === incidentId)?.alarmedVehicles.map((a) => a.vehicleId));
    const neu = ergebnis.incidents.find((incident) => incident.id === incidentId)?.alarmedVehicles.filter((a) => !vorher.has(a.vehicleId)) ?? [];
    const wacheIds = neu.map((a) => vehicles.find((vehicle) => vehicle.id === a.vehicleId)?.stationId).filter((id): id is string => Boolean(id));
    setLocations((current) => erhoeheStress(current, wacheIds, jetzt));
    // Alarmdurchsage
    const einsatz = ergebnis.incidents.find((incident) => incident.id === incidentId);
    const alarmierte = neu.map((a) => vehicles.find((vehicle) => vehicle.id === a.vehicleId)).filter((v): v is Vehicle => Boolean(v));
    if (einsatz && alarmierte.length > 0) setFunk((current) => fuegeFunkHinzu(current, [erzeugeAlarmDurchsage(einsatz, alarmierte, jetzt)]));
  };

  /** Holt ein Fahrzeug vom Einsatz zurück (Rückalarmierung) */
  const rueckalarmieren = (incidentId: string, vehicleId: string) => {
    const ergebnis = rueckalarmiereFahrzeug({ incidents, vehicles, locations }, incidentId, vehicleId, Date.now());
    setIncidents(ergebnis.incidents);
    setVehicles(ergebnis.vehicles);
  };

  /** Holt alle Fahrzeuge vom Einsatz zurück – ohne Abzug; der Einsatz bleibt offen und verfällt wie jeder andere. */
  const rueckalarmiereAlleFahrzeuge = (incidentId: string) => {
    const ergebnis = rueckalarmiereAlle({ incidents, vehicles, locations }, incidentId, Date.now());
    setIncidents(ergebnis.incidents);
    setVehicles(ergebnis.vehicles);
  };

  const markiereMeldungGelesen = (incidentId: string) => {
    setIncidents((current) => current.map((incident) => (
      incident.id === incidentId ? { ...incident, neueMeldung: false } : incident
    )));
  };

  // Beförderung: Rang vergleichen (nicht beim Laden – erst Änderungen danach zählen)
  const rangStufeRef = useRef<number | null>(null);
  useEffect(() => {
    if (!spielstandGeladen) return;
    const rang = getRang(laufbahn.xp);
    if (rangStufeRef.current !== null && rang.stufe > rangStufeRef.current) {
      setBefoerderung(rang);
      spieleFanfare();
    }
    rangStufeRef.current = rang.stufe;
  }, [spielstandGeladen, laufbahn.xp]);

  // Erfolge prüfen, sobald sich etwas Relevantes ändert; die EP gibt es gleich dazu
  useEffect(() => {
    if (!spielstandGeladen) return;
    const wachen = locations.filter((location) => location.type === 'station');
    const neu = findeNeueErfolge({
      einsaetze: laufbahn.einsaetze,
      perfekt: laufbahn.perfekt,
      wachen: wachen.length,
      feuerwachen: wachen.filter((w) => w.stationKind === 'Feuerwache').length,
      fahrzeuge: vehicles.length,
      fahrzeugTypen: vehicles.map((vehicle) => vehicle.type ?? ''),
      ruf,
      eigenesKrankenhaus,
      guthaben: balance,
    }, laufbahn.erfolge);
    if (neu.length === 0) return;
    setLaufbahn((cur) => ({
      ...cur,
      xp: cur.xp + neu.reduce((summe, erfolg) => summe + erfolg.xp, 0),
      erfolge: [...cur.erfolge, ...neu.map((erfolg) => erfolg.id)],
    }));
    setErfolgsMeldungen((cur) => [...cur, ...neu]);
    spieleFanfare();
  }, [spielstandGeladen, laufbahn.einsaetze, laufbahn.perfekt, laufbahn.erfolge, locations, vehicles, ruf, eigenesKrankenhaus, balance]);

  const neuesSpiel = () => {
    // Den Spielstand sofort durch den neuen ersetzen – nicht löschen: Ein Konto ohne Spielstand würde beim
    // nächsten Laden einen alten Browser-Spielstand übernehmen (dann wären die alten Wachen wieder da).
    const neu = createNeuesSpiel();
    spielstandAnwenden(neu);
    void spielstandSpeicher.speichern(neu).then(() => spielstandSpeicher.sofortSpeichern?.());
  };

  // ---- Dev-Werkzeuge (nur Team, nur eigenes Konto – der Aufrufer setzt vorher die Dev-Markierung) ----

  const devGeld = (betrag: number) => {
    setBalance((cur) => cur + betrag);
    addTransaction(betrag >= 0 ? 'Einnahme' : 'Ausgabe', 'Dev-Werkzeug: Guthaben angepasst', Math.abs(betrag));
  };

  const devRufSetzen = (wert: number) => setRuf(Math.min(RUF_CONFIG.max, Math.max(RUF_CONFIG.min, Math.round(wert))));

  /** Setzt die EP auf den Beginn des gewählten Rangs – auch abwärts, damit sich Freischaltungen testen lassen. */
  const devRangSetzen = (stufe: number) => {
    const rang = RAENGE.find((r) => r.stufe === stufe);
    if (rang) setLaufbahn((cur) => ({ ...cur, xp: rang.abXp }));
  };

  /** Alle laufenden Lehrgänge enden sofort (der nächste Spiel-Tick vergibt die Qualifikationen). */
  const devLehrgaengeBeenden = () => {
    const jetzt = Date.now();
    setLocations((current) => current.map((location) => (location.ausbildungsRaeume?.some((raum) => raum.lehrgang)
      ? {
        ...location,
        ausbildungsRaeume: location.ausbildungsRaeume.map((raum) => (raum.lehrgang ? { ...raum, lehrgang: { ...raum.lehrgang, endeAt: jetzt } } : raum)),
      }
      : location)));
  };

  return {
    aao,
    setAao,
    grafiken,
    waehleTypGrafik,
    waehleFahrzeugGrafik,
    waehleFahrzeugFarbe,
    schichtzulage,
    schichtzulageGesehen: () => setSchichtzulage(null),
    willkommen,
    willkommenGesehen: () => setWillkommen(false),
    spielstandGeladen,
    ladeFehler,
    locations,
    vehicles,
    balance,
    transactions,
    laufendeKosten,
    incidents,
    completedIncidentHistory,
    completedIncidentStats,
    krankenhaeuser,
    baueKrankenhaus,
    schalteFachrichtungFrei,
    stellePflegekraftEin,
    erweitereNotaufnahme,
    meldeNotaufnahme,
    ruf,
    laufbahn,
    belohnungen,
    befoerderung,
    befoerderungGesehen: () => setBefoerderung(null),
    erfolgsMeldungen,
    erfolgsMeldungenGesehen: () => setErfolgsMeldungen([]),
    nowMs,
    addVehicle,
    buyVehicle,
    benenneFahrzeugUm,
    eigenesKrankenhaus,
    erstelleWache,
    erweitereStellplaetze,
    passeWacheAn,
    loescheWache,
    personal,
    stellePersonalEin,
    wuerfleBewerberNeu,
    entlassePersonal,
    weisePersonalZu,
    besetzeFahrzeugAutomatisch,
    baueRuheraum,
    baueAusbildungsraum,
    erweitereAusbildungsraum,
    starteLehrgangAnWache,
    ausbildungsAbschluesse,
    baueZufriedenheitsAusbau,
    baueSonderErweiterung,
    kuendigungen,
    funk,
    gibSprechaufforderung,
    erzeugeTestEinsatz,
    devGeld,
    devRufSetzen,
    devRangSetzen,
    devLehrgaengeBeenden,
    alarmieren,
    rueckalarmiereAlleFahrzeuge,
    rueckalarmieren,
    markiereMeldungGelesen,
    neuesSpiel,
  };
}
