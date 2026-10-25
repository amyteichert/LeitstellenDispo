# Straßen-Routing (OSRM) einrichten

Fahrzeuge fahren auf echten Straßen. Die Fahrzeit ist die Navi-Zeit unter optimalen Bedingungen, je nach Fahrzeugtyp etwas schneller oder langsamer.
Ohne OSRM läuft das Spiel normal weiter, nur mit Luftlinie.

So hängt es zusammen: Der Browser fragt `POST /api/routen` beim Spiel-Server an, der Spiel-Server fragt OSRM (`OSRM_URL`).
OSRM muss nur lokal auf dem Server erreichbar sein und nicht aus dem Internet.

## Einmalig: Kartendaten aufbereiten (Deutschland)

Du brauchst Docker. Das Aufbereiten dauert etwa 30 bis 60 Minuten und braucht kurzzeitig rund 16 GB RAM.

```bash
mkdir -p /opt/osrm && cd /opt/osrm
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

docker run --rm -t -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/germany-latest.osm.pbf
docker run --rm -t -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend osrm-partition /data/germany-latest.osrm
docker run --rm -t -v /opt/osrm:/data ghcr.io/project-osrm/osrm-backend osrm-customize /data/germany-latest.osrm
```

## OSRM dauerhaft starten

```bash
docker run -d --name osrm --restart unless-stopped -p 127.0.0.1:5000:5000 -v /opt/osrm:/data \
  ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/germany-latest.osrm
```

Test (Stuttgart, eine kurze Strecke). Die Antwort muss mit `"code":"Ok"` beginnen:

```bash
curl "http://127.0.0.1:5000/route/v1/driving/9.17,48.775;9.18,48.785?overview=false"
```

## Spiel-Server einstellen

In der Umgebung des Spiel-Servers (z. B. `.env`) diese Zeile eintragen und den Server neu starten:

```
OSRM_URL=http://127.0.0.1:5000
```

Beim Start steht dann im Log `Straßen-Routing: http://127.0.0.1:5000`.

## Karte aktualisieren (z. B. alle paar Monate)

`germany-latest.osm.pbf` neu herunterladen, die drei Schritte zum Aufbereiten wiederholen und danach `docker restart osrm` ausführen.
