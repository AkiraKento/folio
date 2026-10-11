/**
 * @jest-environment jsdom
 */
import {
  computeReadingPosition,
  findUnitElement,
  scrollToTarget,
  debounce,
  type ScrollTarget,
} from '../navigation';

describe('Navegação e Posição de Leitura da Consulta (MODO_CONSULTA.md §3, §8)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('findUnitElement', () => {
    test('encontra elemento da unidade pelo índice data-unit-index', () => {
      container.innerHTML = `
        <div class="consulta-unit" data-unit-index="0">Unidade 0</div>
        <div class="consulta-unit" data-unit-index="1">Unidade 1</div>
        <div class="consulta-unit" data-unit-index="2">Unidade 2</div>
      `;

      const el0 = findUnitElement(container, 0);
      const el1 = findUnitElement(container, 1);
      const el99 = findUnitElement(container, 99);

      expect(el0).not.toBeNull();
      expect(el0?.textContent).toBe('Unidade 0');
      expect(el1?.textContent).toBe('Unidade 1');
      expect(el99).toBeNull();
    });

    test('retorna null para índices não inteiros', () => {
      expect(findUnitElement(container, NaN)).toBeNull();
      expect(findUnitElement(container, 1.5)).toBeNull();
    });
  });

  describe('computeReadingPosition', () => {
    test('retorna null para container sem unidades', () => {
      expect(computeReadingPosition(container)).toBeNull();
    });

    test('calcula índice e offset da primeira unidade visível', () => {
      container.innerHTML = `
        <div class="consulta-unit" data-unit-index="0">Unidade 0</div>
        <div class="consulta-unit" data-unit-index="1">Unidade 1</div>
      `;

      const units = container.querySelectorAll<HTMLElement>('.consulta-unit');
      // Simula unidade 0 rolada para cima (top: -50, bottom: 100)
      jest.spyOn(units[0], 'getBoundingClientRect').mockReturnValue({
        top: -50,
        bottom: 100,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: -50,
        toJSON: () => {},
      });
      jest.spyOn(units[1], 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 250,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: 100,
        toJSON: () => {},
      });

      const pos = computeReadingPosition(container);
      expect(pos).not.toBeNull();
      expect(pos?.unitIndex).toBe(0);
      expect(pos?.offset).toBe(50); // -(-50) = 50px de offset dentro da unidade
    });

    test('avança para unidade 1 quando unidade 0 passou totalmente do topo', () => {
      container.innerHTML = `
        <div class="consulta-unit" data-unit-index="0">Unidade 0</div>
        <div class="consulta-unit" data-unit-index="1">Unidade 1</div>
      `;

      const units = container.querySelectorAll<HTMLElement>('.consulta-unit');
      // Unidade 0 totalmente acima do topo (bottom: -10)
      jest.spyOn(units[0], 'getBoundingClientRect').mockReturnValue({
        top: -160,
        bottom: -10,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: -160,
        toJSON: () => {},
      });
      // Unidade 1 no topo cortada em 20px (top: -20, bottom: 130)
      jest.spyOn(units[1], 'getBoundingClientRect').mockReturnValue({
        top: -20,
        bottom: 130,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: -20,
        toJSON: () => {},
      });

      const pos = computeReadingPosition(container);
      expect(pos).not.toBeNull();
      expect(pos?.unitIndex).toBe(1);
      expect(pos?.offset).toBe(20);
    });
  });

  describe('scrollToTarget', () => {
    test('retorna false quando a unidade alvo não está no DOM', () => {
      const target: ScrollTarget = { unitIndex: 10 };
      expect(scrollToTarget(window, container, target)).toBe(false);
    });

    test('rola até a unidade alvo com deslocamento (offset) para "Continuar lendo"', () => {
      container.innerHTML = `
        <div class="consulta-unit" data-unit-index="5">Unidade 5</div>
      `;
      const unitEl = container.querySelector<HTMLElement>('.consulta-unit')!;

      jest.spyOn(unitEl, 'getBoundingClientRect').mockReturnValue({
        top: 250,
        bottom: 400,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: 250,
        toJSON: () => {},
      });

      const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const target: ScrollTarget = { unitIndex: 5, offset: 40 };
      const success = scrollToTarget(window, container, target);

      expect(success).toBe(true);
      // currentY (0) + rectTop (250) + offset (40) = 290
      expect(scrollToSpy).toHaveBeenCalledWith(0, 290);
    });

    test('rola até o grifo com annotationId e adiciona classe ann-flash', () => {
      jest.useFakeTimers();
      container.innerHTML = `
        <div class="consulta-unit" data-unit-index="2">
          <div class="unit-back">
            Texto antes
            <mark class="ann" data-aid="ann-123">grifado</mark>
            depois
          </div>
        </div>
      `;

      const unitEl = container.querySelector<HTMLElement>('.consulta-unit')!;
      const markEl = container.querySelector<HTMLElement>('mark')!;

      jest.spyOn(unitEl, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 250,
        left: 0,
        right: 300,
        width: 300,
        height: 150,
        x: 0,
        y: 100,
        toJSON: () => {},
      });

      jest.spyOn(markEl, 'getBoundingClientRect').mockReturnValue({
        top: 130,
        bottom: 150,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: 130,
        toJSON: () => {},
      });

      // Simula window.innerHeight = 600
      Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });

      const scrollToSpy = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});

      const target: ScrollTarget = { unitIndex: 2, annotationId: 'ann-123' };
      const success = scrollToTarget(window, container, target);

      expect(success).toBe(true);
      // y = currentY (0) + rectTop (130) - (innerHeight 600 / 3 = 200) = max(0, -70) = 0
      expect(scrollToSpy).toHaveBeenCalled();
      expect(markEl.classList.contains('ann-flash')).toBe(true);

      // Após 1600ms a classe de flash é removida
      jest.advanceTimersByTime(1600);
      expect(markEl.classList.contains('ann-flash')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('debounce', () => {
    test('atrasa execução e suporta flush imediato', () => {
      jest.useFakeTimers();
      const fn = jest.fn();
      const debounced = debounce(fn, 1000);

      debounced('primeiro');
      debounced('segundo');

      expect(fn).not.toHaveBeenCalled();

      // Flush força a execução imediata com os últimos argumentos
      debounced.flush();
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('segundo');

      // Avançar o tempo não dispara novamente
      jest.advanceTimersByTime(1000);
      expect(fn).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    test('cancel cancela execução pendente', () => {
      jest.useFakeTimers();
      const fn = jest.fn();
      const debounced = debounce(fn, 1000);

      debounced('teste');
      debounced.cancel();

      jest.advanceTimersByTime(1500);
      expect(fn).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
