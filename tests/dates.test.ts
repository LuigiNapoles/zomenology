import { describe, expect, it } from 'vitest';
import {
  DATE_TYPE_NAMES,
  formatCentury,
  formatDuration,
  formatInstant,
  formatKa,
  formatMa,
  formatMonth,
  formatNumber,
  formatOriginalDate,
  formatSpan,
  formatYear,
  parseYearInput,
  toRoman,
} from '../src/format/dates';

describe('formatNumber', () => {
  it('usa punto de millares y coma decimal', () => {
    expect(formatNumber(4600)).toBe('4.600');
    expect(formatNumber(13800)).toBe('13.800');
    expect(formatNumber(2.5)).toBe('2,5');
    expect(formatNumber(0.25)).toBe('0,25');
    expect(formatNumber(1_000_000, 0)).toBe('1.000.000');
    expect(formatNumber(45)).toBe('45');
  });
});

describe('toRoman', () => {
  it('convierte números de siglo', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(13)).toBe('XIII');
    expect(toRoman(19)).toBe('XIX');
    expect(toRoman(21)).toBe('XXI');
    expect(toRoman(49)).toBe('XLIX');
  });
});

describe('formatos del eje', () => {
  it('Ma sin referencia', () => {
    expect(formatMa(-4_600_000_000)).toBe('4.600 Ma');
    expect(formatMa(-13_800_000_000)).toBe('13.800 Ma');
    expect(formatMa(-2_500_000)).toBe('2,5 Ma');
    expect(formatMa(0)).toBe('0 Ma');
  });

  it('ka con referencia 1950', () => {
    expect(formatKa(1950 - 45_000)).toBe('45 ka');
    expect(formatKa(-4050)).toBe('6 ka');
    expect(formatKa(1950 - 250_000)).toBe('250 ka');
  });

  it('años a.C. y d.C.', () => {
    expect(formatYear(-3000)).toBe('3000 a.C.');
    expect(formatYear(-25)).toBe('25 a.C.');
    expect(formatYear(-40_000)).toBe('40.000 a.C.');
    expect(formatYear(1851)).toBe('1851');
    expect(formatYear(1)).toBe('año 1');
  });

  it('siglos', () => {
    expect(formatCentury(1200)).toBe('s. XIII');
    expect(formatCentury(0)).toBe('s. I');
    expect(formatCentury(1900)).toBe('s. XX');
    expect(formatCentury(-100)).toBe('s. I a.C.');
    expect(formatCentury(-300)).toBe('s. III a.C.');
  });

  it('meses', () => {
    expect(formatMonth(1851, 7)).toBe('jul 1851');
    expect(formatMonth(1852, 1)).toBe('ene 1852');
    expect(formatMonth(-44, 3)).toBe('mar 44 a.C.');
    expect(formatMonth(1, 1)).toBe('ene 1');
  });
});

describe('formatInstant y formatSpan', () => {
  it('fecha del centro según la escala', () => {
    expect(formatInstant(-4_600_000_000, 1e9)).toBe('4.600 Ma');
    expect(formatInstant(1950 - 45_000, 1e4)).toBe('45 ka');
    expect(formatInstant(-3000, 1000)).toBe('3000 a.C.');
    expect(formatInstant(-25.3, 100)).toBe('26 a.C.');
    expect(formatInstant(0.4, 100)).toBe('año 1');
    expect(formatInstant(1851.55, 0.5)).toBe('jul 1851');
    expect(formatInstant(1851.55, 50)).toBe('1851');
  });

  it('duración visible', () => {
    expect(formatSpan(13_800_000_000)).toBe('13.800 millones de años');
    expect(formatSpan(45_000)).toBe('45.000 años');
    expect(formatSpan(2.4)).toBe('2 años');
    expect(formatSpan(2 / 12)).toBe('2 meses');
    expect(formatSpan(1 / 12)).toBe('1 mes');
  });
});

describe('ficha: fecha original y duración', () => {
  it('añade la era solo si el texto no la dice', () => {
    expect(formatOriginalDate('4569-4340', 'a.C.')).toBe('4569-4340 (a.C.)');
    expect(formatOriginalDate('13.800 Ma', 'Ma')).toBe('13.800 Ma');
    expect(formatOriginalDate('6 ka BP-', 'ka BP')).toBe('6 ka BP-');
    expect(formatOriginalDate('-39 d.c', 'd.C.')).toBe('-39 d.c');
    expect(formatOriginalDate('1000 a.d-', 'd.C.')).toBe('1000 a.d-');
    expect(formatOriginalDate('175-235', 'd.C.')).toBe('175-235 (d.C.)');
    expect(formatOriginalDate('07|1851', undefined)).toBe('07|1851');
  });

  it('calcula la duración', () => {
    expect(formatDuration(1880, 1890, 1880, 1891, false)).toBe('10 años');
    expect(formatDuration(-25, 14, -25, 15, false)).toBe('38 años');
    expect(formatDuration(1, 2, 1, 3, false)).toBe('1 año');
    expect(formatDuration(-13_800_000_000, -13_700_000_000, 0, 0, false)).toBe(
      '100 millones de años',
    );
    // Vísperas sicilianas: 30 de marzo – 22 de mayo de 1282.
    const start = 1282 + 2 / 12 + 29 / (12 * 31);
    const end = 1282 + 4 / 12 + 22 / (12 * 31);
    expect(formatDuration(1282, 1282, start, end, true)).toBe('54 días');
    expect(formatDuration(1851, 1851, 1851.5, 1851 + 10 / 12, true)).toBe('4 meses');
  });

  it('nombres de tipo de fecha', () => {
    expect(DATE_TYPE_NAMES.v).toBe('Vida');
    expect(DATE_TYPE_NAMES.n).toBe('Nacimiento');
  });
});

describe('parseYearInput', () => {
  it('entiende años, a.C., ka y Ma', () => {
    expect(parseYearInput('1500')).toEqual({ start: 1500, end: 1501 });
    expect(parseYearInput('-500')).toEqual({ start: -500, end: -499 });
    expect(parseYearInput('500 a.C.')).toEqual({ start: -500, end: -499 });
    expect(parseYearInput('500 a. C.')).toEqual({ start: -500, end: -499 });
    expect(parseYearInput('500 ac')).toEqual({ start: -500, end: -499 });
    expect(parseYearInput('1492 d.C.')).toEqual({ start: 1492, end: 1493 });
    expect(parseYearInput('45 ka')).toEqual({ start: -43_050, end: -43_050 });
    expect(parseYearInput('6 ka BP')).toEqual({ start: -4050, end: -4050 });
    expect(parseYearInput('2,5 Ma')).toEqual({ start: -2_500_000, end: -2_500_000 });
    expect(parseYearInput("2'58 Ma")).toEqual({ start: -2_580_000, end: -2_580_000 });
    expect(parseYearInput('4.600 Ma')).toEqual({ start: -4.6e9, end: -4.6e9 });
    expect(parseYearInput('13.800 ma')).toEqual({ start: -1.38e10, end: -1.38e10 });
    expect(parseYearInput('10.000 a.C.')).toEqual({ start: -10_000, end: -9999 });
  });

  it('rechaza lo que no es una fecha', () => {
    for (const bad of ['', 'hola', '0', '1,5', '12 años', '-500 a.C.', '1,2,3 Ma']) {
      expect(parseYearInput(bad), bad).toBeNull();
    }
  });
});
