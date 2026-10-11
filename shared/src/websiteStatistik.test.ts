import { describe, expect, it } from 'vitest';
import { bewerteBesuch, ordneQuelleEin, saeubereKampagne } from './websiteStatistik.js';

const EIGEN = ['leitstellendispo.de'];

describe('Website-Statistik: Herkunft', () => {
  it('erkennt Suchmaschinen, bekannte Seiten und fremde Links', () => {
    expect(ordneQuelleEin('https://www.google.de/', null, EIGEN)).toEqual({ art: 'suche', name: 'Google' });
    expect(ordneQuelleEin('https://www.ecosia.org/search?q=x', null, EIGEN)).toEqual({ art: 'suche', name: 'Ecosia' });
    expect(ordneQuelleEin('https://discord.com/channels/1/2', null, EIGEN)).toEqual({ art: 'link', name: 'Discord' });
    expect(ordneQuelleEin('https://forum.beispiel.de/thread/5', null, EIGEN)).toEqual({ art: 'link', name: 'forum.beispiel.de' });
  });

  it('ohne Herkunft = direkt, eigene Website (auch Subdomain) = intern', () => {
    expect(ordneQuelleEin('', null, EIGEN)).toEqual({ art: 'direkt', name: null });
    expect(ordneQuelleEin('kein-link', null, EIGEN)).toEqual({ art: 'direkt', name: null });
    expect(ordneQuelleEin('https://leitstellendispo.de/funktionen.html', null, EIGEN).art).toBe('intern');
    expect(ordneQuelleEin('https://spiel.leitstellendispo.de/', null, EIGEN).art).toBe('intern');
  });

  it('?von=… hat Vorrang und wird gesäubert', () => {
    expect(ordneQuelleEin(null, 'WhatsApp-Gruppe1', EIGEN)).toEqual({ art: 'kampagne', name: 'whatsapp-gruppe1' });
    expect(ordneQuelleEin('https://www.google.de/', 'discord', EIGEN)).toEqual({ art: 'kampagne', name: 'discord' });
    expect(saeubereKampagne('<script>')).toBe('script');
    expect(saeubereKampagne('   ')).toBeNull();
    expect(saeubereKampagne(42)).toBeNull();
  });
});

describe('Website-Statistik: Verhalten', () => {
  it('Klick = interagiert, lange da oder weit gescrollt = gelesen, sonst kurz', () => {
    expect(bewerteBesuch({ dauerSekunden: 3, scrollProzent: 0, interaktion: true })).toBe('interagiert');
    expect(bewerteBesuch({ dauerSekunden: 45, scrollProzent: 10, interaktion: false })).toBe('gelesen');
    expect(bewerteBesuch({ dauerSekunden: 10, scrollProzent: 80, interaktion: false })).toBe('gelesen');
    expect(bewerteBesuch({ dauerSekunden: 5, scrollProzent: 20, interaktion: false })).toBe('kurz');
  });
});
