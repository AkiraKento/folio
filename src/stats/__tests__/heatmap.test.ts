import {
  buildHeatmapData,
  calculateHeatmapLevel,
  formatDateKey,
} from '../heatmap';

describe('src/stats/heatmap', () => {
  const baseDate = new Date(2026, 9, 10, 12, 0, 0); // Sábado, 10/10/2026 12:00

  describe('formatDateKey', () => {
    it('formata datas no padrão YYYY-MM-DD com preenchimento de zeros', () => {
      const d1 = new Date(2026, 0, 5, 12, 0, 0);
      expect(formatDateKey(d1)).toBe('2026-01-05');

      const d2 = new Date(2026, 11, 25, 12, 0, 0);
      expect(formatDateKey(d2)).toBe('2026-12-25');
    });
  });

  describe('calculateHeatmapLevel', () => {
    it('retorna 0 para 0 revisões', () => {
      expect(calculateHeatmapLevel(0)).toBe(0);
    });

    it('retorna níveis proporcionais padrão para contagens normais', () => {
      expect(calculateHeatmapLevel(1)).toBe(1);
      expect(calculateHeatmapLevel(4)).toBe(1);
      expect(calculateHeatmapLevel(5)).toBe(2);
      expect(calculateHeatmapLevel(14)).toBe(2);
      expect(calculateHeatmapLevel(15)).toBe(3);
      expect(calculateHeatmapLevel(29)).toBe(3);
      expect(calculateHeatmapLevel(30)).toBe(4);
      expect(calculateHeatmapLevel(100)).toBe(4);
    });

    it('adapta os limites se maxCount for fornecido', () => {
      // Se o usuário tem no máximo 4 revisões em um dia, o nível 4 ainda pode ser alcançado
      expect(calculateHeatmapLevel(4, 4)).toBe(4);
      expect(calculateHeatmapLevel(1, 4)).toBe(1);
    });
  });

  describe('buildHeatmapData', () => {
    it('gera a estrutura de semanas vazia quando não há revisões', () => {
      const data = buildHeatmapData([], {
        now: baseDate,
        weeksCount: 12,
        rolloverHour: 4,
      });

      expect(data.weeks).toHaveLength(12);
      expect(data.totalReviews).toBe(0);
      expect(data.activeDays).toBe(0);
      expect(data.maxCount).toBe(0);

      // Toda semana tem exatamente 7 dias (Domingo a Sábado)
      for (const week of data.weeks) {
        expect(week).toHaveLength(7);
        for (let i = 0; i < 7; i++) {
          expect(week[i].dayOfWeek).toBe(i);
          expect(week[i].count).toBe(0);
          expect(week[i].level).toBe(0);
        }
      }
    });

    it('agrega múltiplos timestamps no mesmo dia', () => {
      // 3 revisões em 10/10/2026 às 10h, 11h e 14h
      const ts1 = new Date(2026, 9, 10, 10, 0, 0).getTime();
      const ts2 = new Date(2026, 9, 10, 11, 0, 0).getTime();
      const ts3 = new Date(2026, 9, 10, 14, 0, 0).getTime();

      // 1 revisão em 09/10/2026 às 15h
      const ts4 = new Date(2026, 9, 9, 15, 0, 0).getTime();

      const data = buildHeatmapData([ts1, ts2, ts3, ts4], {
        now: baseDate,
        weeksCount: 14,
        rolloverHour: 4,
      });

      expect(data.totalReviews).toBe(4);
      expect(data.activeDays).toBe(2);
      expect(data.maxCount).toBe(3);

      // Localiza o dia 10/10/2026 na última semana
      const lastWeek = data.weeks[data.weeks.length - 1];
      const sat = lastWeek.find((d: { date: string }) => d.date === '2026-10-10');
      expect(sat).toBeDefined();
      expect(sat?.count).toBe(3);
      expect(sat?.level).toBeGreaterThan(0);

      const fri = lastWeek.find((d: { date: string }) => d.date === '2026-10-09');
      expect(fri).toBeDefined();
      expect(fri?.count).toBe(1);
    });

    it('respeita o dayRolloverHour para estudo na madrugada', () => {
      // Revisão em 10/10/2026 às 02h da madrugada.
      // Com rollover às 04h, deve contar como dia de estudo 09/10/2026.
      const nightStudyTs = new Date(2026, 9, 10, 2, 0, 0).getTime();

      const data = buildHeatmapData([nightStudyTs], {
        now: baseDate,
        weeksCount: 8,
        rolloverHour: 4,
      });

      const lastWeek = data.weeks[data.weeks.length - 1];
      const oct9 = lastWeek.find((d: { date: string }) => d.date === '2026-10-09');
      const oct10 = lastWeek.find((d: { date: string }) => d.date === '2026-10-10');

      expect(oct9?.count).toBe(1);
      expect(oct10?.count).toBe(0);
    });

    it('ignora revisões fora da janela de semanas solicitada', () => {
      // 1 ano atrás
      const oldTs = new Date(2025, 0, 1).getTime();
      // Hoje
      const todayTs = baseDate.getTime();

      const data = buildHeatmapData([oldTs, todayTs], {
        now: baseDate,
        weeksCount: 4,
      });

      expect(data.totalReviews).toBe(1);
      expect(data.activeDays).toBe(1);
    });
  });
});
