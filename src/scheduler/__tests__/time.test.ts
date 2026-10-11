import {
  getStudyDayCutoff,
  getStudyDayStart,
  getStudyDayRange,
  formatInterval,
} from '../time';

describe('src/scheduler/time.ts', () => {
  describe('getStudyDayStart e getStudyDayCutoff (virada às 4h no fuso local)', () => {
    test('para horário após as 4h (ex: 10:00), o dia de estudo começou às 04:00 do mesmo dia e termina às 04:00 do dia seguinte', () => {
      // Cria uma data com hora local 10:00
      const now = new Date(2026, 9, 9, 10, 0, 0); // 9 de Outubro de 2026, 10:00 local
      const startMs = getStudyDayStart(now, 4);
      const cutoffMs = getStudyDayCutoff(now, 4);

      const startDate = new Date(startMs);
      const cutoffDate = new Date(cutoffMs);

      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(9);
      expect(startDate.getDate()).toBe(9);
      expect(startDate.getHours()).toBe(4);
      expect(startDate.getMinutes()).toBe(0);

      expect(cutoffDate.getFullYear()).toBe(2026);
      expect(cutoffDate.getMonth()).toBe(9);
      expect(cutoffDate.getDate()).toBe(10);
      expect(cutoffDate.getHours()).toBe(4);
      expect(cutoffDate.getMinutes()).toBe(0);
    });

    test('para horário antes das 4h (ex: 02:30), o dia de estudo começou às 04:00 do dia anterior e termina às 04:00 do dia atual', () => {
      // 9 de Outubro de 2026, 02:30 local -> ainda é o dia de estudo de 8 de Outubro!
      const now = new Date(2026, 9, 9, 2, 30, 0);
      const startMs = getStudyDayStart(now, 4);
      const cutoffMs = getStudyDayCutoff(now, 4);

      const startDate = new Date(startMs);
      const cutoffDate = new Date(cutoffMs);

      expect(startDate.getFullYear()).toBe(2026);
      expect(startDate.getMonth()).toBe(9);
      expect(startDate.getDate()).toBe(8);
      expect(startDate.getHours()).toBe(4);

      expect(cutoffDate.getFullYear()).toBe(2026);
      expect(cutoffDate.getMonth()).toBe(9);
      expect(cutoffDate.getDate()).toBe(9);
      expect(cutoffDate.getHours()).toBe(4);
    });

    test('exatamente às 04:00:00 vira o novo dia de estudo', () => {
      const atRollover = new Date(2026, 9, 9, 4, 0, 0);
      const startMs = getStudyDayStart(atRollover, 4);
      const cutoffMs = getStudyDayCutoff(atRollover, 4);

      const startDate = new Date(startMs);
      const cutoffDate = new Date(cutoffMs);

      expect(startDate.getDate()).toBe(9);
      expect(startDate.getHours()).toBe(4);

      expect(cutoffDate.getDate()).toBe(10);
      expect(cutoffDate.getHours()).toBe(4);
    });

    test('getStudyDayRange retorna intervalo coerente de 24 horas', () => {
      const now = new Date(2026, 9, 9, 15, 0, 0);
      const range = getStudyDayRange(now, 4);

      expect(range.endMs - range.startMs).toBe(24 * 60 * 60 * 1000);
      expect(range.startMs).toBeLessThanOrEqual(now.getTime());
      expect(range.endMs).toBeGreaterThan(now.getTime());
    });
  });

  describe('formatInterval', () => {
    test('formata minutos corretamente', () => {
      expect(formatInterval(30 * 1000)).toBe('< 1 min');
      expect(formatInterval(60 * 1000)).toBe('1 min');
      expect(formatInterval(10 * 60 * 1000)).toBe('10 min');
      expect(formatInterval(45 * 60 * 1000)).toBe('45 min');
    });

    test('formata horas corretamente', () => {
      expect(formatInterval(60 * 60 * 1000)).toBe('1 h');
      expect(formatInterval(3 * 60 * 60 * 1000)).toBe('3 h');
      expect(formatInterval(23 * 60 * 60 * 1000)).toBe('23 h');
    });

    test('formata dias corretamente', () => {
      expect(formatInterval(24 * 60 * 60 * 1000)).toBe('1 d');
      expect(formatInterval(3 * 24 * 60 * 60 * 1000)).toBe('3 d');
      expect(formatInterval(25 * 24 * 60 * 60 * 1000)).toBe('25 d');
    });

    test('formata meses e anos corretamente', () => {
      expect(formatInterval(35 * 24 * 60 * 60 * 1000)).toBe('1 m');
      expect(formatInterval(65 * 24 * 60 * 60 * 1000)).toBe('2 m');
      expect(formatInterval(370 * 24 * 60 * 60 * 1000)).toBe('1 a');
    });

    test('aceita dueMs e nowMs relativos', () => {
      const now = 1000000;
      const due = now + 10 * 60 * 1000;
      expect(formatInterval(due, now)).toBe('10 min');
    });
  });
});
