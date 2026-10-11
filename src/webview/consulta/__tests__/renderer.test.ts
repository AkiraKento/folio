/**
 * @jest-environment jsdom
 */

import {
  formatDeckPath,
  renderConsultaUnit,
  renderUnitsBatch,
  closeAllUnitMenus,
} from '../renderer';
import type { ConsultaUnitWeb } from '../types';

describe('Consulta WebView Renderer - MODO_CONSULTA.md §2 e §3', () => {
  const sampleUnit: ConsultaUnitWeb = {
    index: 0,
    noteId: 'note-1',
    deckPath: 'Medicina::Cardiologia',
    frontHtml: '<p>Qual o primeiro pilar da IC?</p>',
    backHtml: '<p>IECA/BRA ou <span class="cloze">INRA</span> e betabloqueadores.</p>',
    tags: ['cardio', '#ic'],
    suspended: false,
    annotations: [],
  };

  test('formata caminhos de deck hierárquicos para o cabeçalho de seção', () => {
    expect(formatDeckPath('Cardiologia')).toBe('CARDIOLOGIA');
    expect(formatDeckPath('Medicina::Cardiologia')).toBe('MEDICINA › CARDIOLOGIA');
    expect(
      formatDeckPath('Medicina::Cardiologia::Insuficiência Cardíaca')
    ).toBe('MEDICINA › CARDIOLOGIA › INSUFICIÊNCIA CARDÍACA');
    expect(formatDeckPath('')).toBe('');
  });

  test('renderiza cabeçalho de seção na primeira unidade e quando o deck muda', () => {
    // 1. Primeira unidade deve gerar cabeçalho
    const firstResult = renderConsultaUnit(sampleUnit, {
      previousDeckPath: undefined,
    });
    expect(firstResult.headerElement).not.toBeNull();
    expect(firstResult.headerElement?.textContent).toBe('MEDICINA › CARDIOLOGIA');
    expect(firstResult.headerElement?.className).toContain('deck-section-header');

    // 2. Segunda unidade com o mesmo deck não deve gerar novo cabeçalho
    const secondResult = renderConsultaUnit(
      { ...sampleUnit, index: 1, noteId: 'note-2' },
      { previousDeckPath: 'Medicina::Cardiologia' }
    );
    expect(secondResult.headerElement).toBeNull();

    // 3. Terceira unidade com subdeck diferente gera novo cabeçalho
    const thirdResult = renderConsultaUnit(
      {
        ...sampleUnit,
        index: 2,
        noteId: 'note-3',
        deckPath: 'Medicina::Cardiologia::Arritmias',
      },
      { previousDeckPath: 'Medicina::Cardiologia' }
    );
    expect(thirdResult.headerElement).not.toBeNull();
    expect(thirdResult.headerElement?.textContent).toBe(
      'MEDICINA › CARDIOLOGIA › ARRITMIAS'
    );
  });

  test('renderiza frente esmaecida e verso em serifa', () => {
    const result = renderConsultaUnit(sampleUnit);
    const unitEl = result.unitElement;

    // Frente em elemento .unit-front
    const frontEl = unitEl.querySelector('.unit-front');
    expect(frontEl).not.toBeNull();
    expect(frontEl?.innerHTML).toContain('Qual o primeiro pilar da IC?');

    // Verso em elemento .unit-back
    const backEl = unitEl.querySelector('.unit-back');
    expect(backEl).not.toBeNull();
    expect(backEl?.innerHTML).toContain('IECA/BRA');
    expect(backEl?.innerHTML).toContain('class="cloze"');
  });

  test('renderiza tags formatadas com hashtag', () => {
    const result = renderConsultaUnit(sampleUnit);
    const tags = result.unitElement.querySelectorAll('.unit-tag');

    expect(tags.length).toBe(2);
    expect(tags[0].textContent).toBe('#cardio');
    expect(tags[1].textContent).toBe('#ic');
  });

  test('renderiza botão de menu ⋯ e aciona ações do menu contextual', () => {
    const onMenuAction = jest.fn();
    const result = renderConsultaUnit(sampleUnit, { onMenuAction });
    const unitEl = result.unitElement;
    document.body.appendChild(unitEl);

    const menuButton = unitEl.querySelector<HTMLButtonElement>('.unit-menu-button');
    expect(menuButton).not.toBeNull();
    expect(menuButton?.textContent).toBe('⋯');
    expect(menuButton?.getAttribute('aria-label')).toBe('Opções da unidade');

    // Clicar no botão abre o menu contextual
    menuButton?.click();
    let dropdown = unitEl.querySelector('.unit-menu-dropdown');
    expect(dropdown).not.toBeNull();

    const items = dropdown?.querySelectorAll<HTMLButtonElement>('.unit-menu-item');
    expect(items?.length).toBe(3);
    expect(items?.[0].textContent).toBe('Editar');
    expect(items?.[1].textContent).toBe('Revisar agora');
    expect(items?.[2].textContent).toBe('Suspender');

    // Clicar em "Editar"
    items?.[0].click();
    expect(onMenuAction).toHaveBeenCalledWith('edit', 'note-1', 0);

    // O dropdown fecha após o clique
    dropdown = unitEl.querySelector('.unit-menu-dropdown');
    expect(dropdown).toBeNull();

    unitEl.remove();
  });

  test('unidade suspensa recebe classe .suspended e selo "suspenso"', () => {
    const suspendedUnit: ConsultaUnitWeb = {
      ...sampleUnit,
      suspended: true,
    };
    const result = renderConsultaUnit(suspendedUnit);
    const unitEl = result.unitElement;

    expect(unitEl.className).toContain('suspended');
    const badge = unitEl.querySelector('.suspended-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('suspenso');

    // Menu mostra 'Reativar' em vez de 'Suspender'
    const onMenuAction = jest.fn();
    const withAction = renderConsultaUnit(suspendedUnit, { onMenuAction });
    document.body.appendChild(withAction.unitElement);

    const menuBtn = withAction.unitElement.querySelector<HTMLButtonElement>('.unit-menu-button');
    menuBtn?.click();

    const dropdown = withAction.unitElement.querySelector('.unit-menu-dropdown');
    const toggleBtn = dropdown?.querySelectorAll('.unit-menu-item')[2];
    expect(toggleBtn?.textContent).toBe('Reativar');

    toggleBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onMenuAction).toHaveBeenCalledWith('toggleSuspend', 'note-1', 0);

    withAction.unitElement.remove();
  });

  test('aplica anotações no verso usando algoritmo de âncora', () => {
    const unitWithAnnotation: ConsultaUnitWeb = {
      ...sampleUnit,
      backHtml: '<p>A dose de ataque de amiodarona é 300 mg EV.</p>',
      annotations: [
        {
          id: 'ann-1',
          kind: 'hl',
          color: 'amarelo',
          quote: 'amiodarona',
          start: 22,
          end: 32,
          note: 'Antiarrítmico de classe III',
        },
      ],
    };

    const result = renderConsultaUnit(unitWithAnnotation);
    const backEl = result.unitElement.querySelector('.unit-back');
    expect(backEl).not.toBeNull();

    const markEl = backEl?.querySelector('mark.ann');
    expect(markEl).not.toBeNull();
    expect(markEl?.getAttribute('data-aid')).toBe('ann-1');
    expect(markEl?.textContent).toBe('amiodarona');
    expect(markEl?.className).toContain('c-amarelo');
    expect(markEl?.className).toContain('has-note');
  });

  test('sanitiza tags perigosas (<script>, onerror, etc.) no HTML', () => {
    const maliciousUnit: ConsultaUnitWeb = {
      ...sampleUnit,
      frontHtml: '<p>Seguro</p><script>alert("xss")</script><img src="x" onerror="alert(1)" />',
      backHtml: '<a href="javascript:alert(2)">Clique</a><iframe src="https://evil.com"></iframe>',
    };

    const result = renderConsultaUnit(maliciousUnit);
    const unitEl = result.unitElement;

    expect(unitEl.querySelector('script')).toBeNull();
    expect(unitEl.querySelector('iframe')).toBeNull();
    const img = unitEl.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
    const link = unitEl.querySelector('a');
    expect(link?.getAttribute('href')).toBeNull();
  });

  test('renderUnitsBatch renderiza lote de 30 unidades corretamente', () => {
    const container = document.createElement('div');
    const batch: ConsultaUnitWeb[] = Array.from({ length: 30 }, (_, i) => ({
      index: i,
      noteId: `note-${i}`,
      deckPath: i < 15 ? 'Medicina::Cardiologia' : 'Medicina::Pneumologia',
      frontHtml: `<p>Frente da unidade ${i}</p>`,
      backHtml: `<p>Verso da unidade ${i}</p>`,
      tags: ['geral'],
      suspended: i % 10 === 0,
      annotations: [],
    }));

    const result = renderUnitsBatch(container, batch);

    expect(result.renderedCount).toBe(30);
    expect(result.lastDeckPath).toBe('Medicina::Pneumologia');

    // Devem existir 30 unidades
    const units = container.querySelectorAll('.consulta-unit');
    expect(units.length).toBe(30);

    // Devem existir exatamente 2 cabeçalhos de seção (um para Cardio e um para Pneumo)
    const headers = container.querySelectorAll('.deck-section-header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe('MEDICINA › CARDIOLOGIA');
    expect(headers[1].textContent).toBe('MEDICINA › PNEUMOLOGIA');
  });

  test('closeAllUnitMenus fecha menus abertos', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const result1 = renderConsultaUnit(sampleUnit);
    const result2 = renderConsultaUnit({ ...sampleUnit, index: 1, noteId: 'note-2' });
    container.appendChild(result1.unitElement);
    container.appendChild(result2.unitElement);

    // Abre menu na unidade 1
    result1.unitElement.querySelector<HTMLButtonElement>('.unit-menu-button')?.click();
    expect(container.querySelectorAll('.unit-menu-dropdown').length).toBe(1);

    // Fecha todos
    closeAllUnitMenus(document.body);
    expect(container.querySelectorAll('.unit-menu-dropdown').length).toBe(0);

    container.remove();
  });
});
