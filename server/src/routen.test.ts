import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { starteTestServer, type TestServer } from './testServer.js';

let server: TestServer | undefined;
let osrm: Server | undefined;
afterEach(async () => {
  await server?.beenden();
  await new Promise((fertig) => (osrm ? osrm.close(fertig) : fertig(undefined)));
  server = osrm = undefined;
});

const anfrage = { anfragen: [{ von: [48.775, 9.17], nach: [48.785, 9.18] }] };

describe('Straßen-Routing', () => {
  it('ohne OSRM_URL: 503, das Spiel bleibt bei der Luftlinie', async () => {
    server = await starteTestServer();
    expect((await server.anfrage('POST', '/routen', { body: anfrage })).status).toBe(503);
  });

  it('fragt OSRM, dreht die Koordinaten richtig herum und merkt sich die Antwort', async () => {
    let aufrufe = 0;
    osrm = createServer((req, res) => {
      aufrufe++;
      expect(req.url).toContain('/route/v1/driving/9.17,48.775;9.18,48.785');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ code: 'Ok', routes: [{ duration: 312.4, distance: 2150, geometry: { coordinates: [[9.17, 48.775], [9.18, 48.785]] } }] }));
    }).listen(0);
    await new Promise((fertig) => osrm!.once('listening', fertig));
    server = await starteTestServer({ osrmUrl: `http://127.0.0.1:${(osrm.address() as AddressInfo).port}` });

    for (let i = 0; i < 2; i++) {
      const res = await server.anfrage('POST', '/routen', { body: anfrage });
      expect(await res.json()).toEqual({ routen: [{ dauerSekunden: 312, distanzKm: 2.15, punkte: [[48.775, 9.17], [48.785, 9.18]] }] });
    }
    expect(aufrufe).toBe(1);
  });

  it('lehnt kaputte Koordinaten ab', async () => {
    server = await starteTestServer({ osrmUrl: 'http://127.0.0.1:1' });
    expect((await server.anfrage('POST', '/routen', { body: { anfragen: [{ von: [999, 0], nach: [0, 0] }] } })).status).toBe(400);
  });
});
