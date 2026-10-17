import { describe, expect, it } from 'vitest';
import { istGruendungsSpieler, istTeamRolle, pruefeBenutzername, pruefePasswort } from './konten.js';

describe('pruefeBenutzername', () => {
  it('akzeptiert normale Namen inkl. Umlaute', () => {
    expect(pruefeBenutzername('Disponent')).toBeNull();
    expect(pruefeBenutzername('Leitstelle_Süd-1.2')).toBeNull();
  });

  it('lehnt zu kurze, zu lange und fehlende Namen ab', () => {
    expect(pruefeBenutzername('ab')).not.toBeNull();
    expect(pruefeBenutzername('a'.repeat(25))).not.toBeNull();
    expect(pruefeBenutzername(undefined)).not.toBeNull();
  });

  it('lehnt Leerzeichen und Sonderzeichen ab', () => {
    expect(pruefeBenutzername('Dispo T')).not.toBeNull();
    expect(pruefeBenutzername('<script>')).not.toBeNull();
  });
});

describe('pruefePasswort', () => {
  it('verlangt mindestens 8 Zeichen', () => {
    expect(pruefePasswort('1234567')).not.toBeNull();
    expect(pruefePasswort('12345678')).toBeNull();
  });

  it('lehnt Passwörter über 72 Bytes ab (bcrypt-Grenze)', () => {
    expect(pruefePasswort('a'.repeat(72))).toBeNull();
    expect(pruefePasswort('ä'.repeat(37))).not.toBeNull(); // 74 Bytes
  });

  it('lehnt fehlende Passwörter ab', () => {
    expect(pruefePasswort('')).not.toBeNull();
    expect(pruefePasswort(null)).not.toBeNull();
  });
});

describe('istTeamRolle', () => {
  it('erkennt Owner, Co-Owner und Admin als Team, Spieler nicht', () => {
    expect(istTeamRolle('owner')).toBe(true);
    expect(istTeamRolle('co_owner')).toBe(true);
    expect(istTeamRolle('admin')).toBe(true);
    expect(istTeamRolle('player')).toBe(false);
  });
});

describe('istGruendungsSpieler', () => {
  it('gibt das Abzeichen allen, solange die Alpha läuft', () => {
    expect(istGruendungsSpieler({ erstellt: '2030-01-01T00:00:00Z' }, null)).toBe(true);
  });

  it('nach dem Alpha-Ende nur Konten von davor', () => {
    const ende = '2027-01-01T00:00:00Z';
    expect(istGruendungsSpieler({ erstellt: '2026-10-17T12:00:00Z' }, ende)).toBe(true);
    expect(istGruendungsSpieler({ erstellt: '2027-01-02T12:00:00Z' }, ende)).toBe(false);
  });
});
