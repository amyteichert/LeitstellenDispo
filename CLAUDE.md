# Hinweise für Claude

## Branches: erst `test`, dann live
- **`feature/ruf-und-wachenverwaltung`** = live auf spiel.leitstellendispo.de (Server holt alle 3 Minuten).
- **`test`** = test.leitstellendispo.de (eigene Datenbank, Mails nur ins Log, Server holt ebenfalls alle 3 Minuten).
- Lege **keine** weiteren Branches (z. B. `claude/...`) an und öffne **keine** Pull Requests.
- Vor dem Arbeiten: `git checkout feature/ruf-und-wachenverwaltung` und `git pull --rebase origin test` (test ist immer gleich oder weiter als live).
- Nach dem Arbeiten (Tests und Build grün): **nur auf `test` pushen**: `git push origin HEAD:test`. Dann Amy sagen, worauf sie auf test.leitstellendispo.de achten soll.
- **Live erst, wenn Amy es sagt** („ab live“ o. Ä.): `git fetch origin && git push origin origin/test:feature/ruf-und-wachenverwaltung`.
  Das bringt den ganzen test-Stand live, auch Änderungen anderer Sitzungen – vorher kurz sagen, was alles mitgeht (`git log --oneline origin/feature/ruf-und-wachenverwaltung..origin/test`).
- Ausnahme nur, wenn Amy ausdrücklich „direkt live“ sagt (z. B. dringender Fehler im Live-Spiel): dann auf beide pushen.
- Falls die Umgebung einen anderen Branch vorgibt: trotzdem wie oben arbeiten.
- `master` ist veraltet (Stand 07.10.2026) und wird nicht benutzt.

## Server
- Live: `/opt/leitstellendispo` (Dienst `leitstellendispo`, Port 3001). Test: `/opt/leitstellendispo-test` (Dienst `leitstellendispo-test`, Port 3002).
- Beide lauschen nur auf 127.0.0.1 (`HOST` in config.env), nginx davor. Ausgehend dürfen die Dienste nur zu Apples Mailserver und den DNS-Servern
  (`/etc/systemd/system/<dienst>.service.d/mailversand.conf`) – braucht eine neue Funktion weitere Ziele (z. B. Webhook), muss das dort ergänzt werden.
