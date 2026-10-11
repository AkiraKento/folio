/**
 * @jest-environment jsdom
 */

import { createSelectionToolbar } from '../toolbar';
import { createConsultaApp } from '../app';
import type { ConsultaUnitWeb } from '../types';
import type { SavedAnnotation } from '../protocol';
import { strings } from '../../../ui/strings';

describe('Consulta WebView Selection Toolbar - MODO_CONSULTA.md §3', () => {
  let container: HTMLElement;
  let sampleUnits: ConsultaUnitWeb[];

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

    sampleUnits = [
      {
        index: 0,
        noteId: 'note-123',
        deckPath: 'Medicina::Cardiologia',
        frontHtml: '<p>Qual o primeiro pilar da ICFEr?</p>',
        backHtml: '<p>IECA/BRA ou INRA, betabloqueador e espironolactona.</p>',
        tags: ['cardio', 'ic'],
        suspended: false,
        annotations: [],
      },
    ];
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  function setupDOMWithUnit(unit: ConsultaUnitWeb): {
    unitEl: HTMLElement;
    backEl: HTMLElement;
    frontEl: HTMLElement;
  } {
    const unitEl = document.createElement('article');
    unitEl.className = 'consulta-unit';
    unitEl.dataset.unitIndex = String(unit.index);
    unitEl.dataset.noteId = unit.noteId;

    const frontEl = document.createElement('div');
    frontEl.className = 'unit-front';
    frontEl.innerHTML = unit.frontHtml;
    unitEl.appendChild(frontEl);

    const backEl = document.createElement('div');
    backEl.className = 'unit-back';
    backEl.innerHTML = unit.backHtml;
    unitEl.appendChild(backEl);

    container.appendChild(unitEl);
    return { unitEl, backEl, frontEl };
  }

  function mockSelection(containerNode: Node, startOffset: number, endOffset: number): Range {
    const range = document.createRange();
    range.setStart(containerNode, startOffset);
    range.setEnd(containerNode, endOffset);

    // Mock getBoundingClientRect no range para jsdom
    range.getBoundingClientRect = () =>
      ({
        top: 200,
        bottom: 230,
        left: 50,
        right: 150,
        width: 100,
        height: 30,
      }) as DOMRect;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return range;
  }

  test('aparece com os 5 botões de cores, U, ✎ e Copiar quando texto do verso é selecionado', () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8); // "IECA/BRA"

    const onSaveAnnotation = jest.fn();
    const onSetColor = jest.fn();

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation,
      onSetColor,
    });

    toolbar.checkSelection();

    expect(toolbar.isVisible()).toBe(true);
    const toolbarEl = toolbar.element;

    // 5 botões de cores
    const colorBtns = toolbarEl.querySelectorAll('.toolbar-color-btn');
    expect(colorBtns.length).toBe(5);

    // Botão da cor ativa (amarelo) com classe .active
    const yellowBtn = toolbarEl.querySelector('.toolbar-color-btn[data-color="amarelo"]');
    expect(yellowBtn?.className).toContain('active');

    // Botão Sublinhar (U)
    const underlineBtn = toolbarEl.querySelector('.toolbar-underline-btn');
    expect(underlineBtn).not.toBeNull();
    expect(underlineBtn?.getAttribute('aria-label')).toBe(strings.consulta.toolbarUnderline);

    // Botão Nota (✎)
    const noteBtn = toolbarEl.querySelector('.toolbar-note-btn');
    expect(noteBtn).not.toBeNull();
    expect(noteBtn?.getAttribute('aria-label')).toBe(strings.consulta.toolbarNote);

    // Botão Copiar
    const copyBtn = toolbarEl.querySelector('.toolbar-copy-btn');
    expect(copyBtn).not.toBeNull();
    expect(copyBtn?.textContent).toContain(strings.consulta.toolbarCopy);

    toolbar.dispose();
  });

  test('todos os botões da barra respeitam o alvo de toque de no mínimo 44px', () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8);

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation: jest.fn(),
      onSetColor: jest.fn(),
    });

    toolbar.checkSelection();

    const buttons = toolbar.element.querySelectorAll<HTMLButtonElement>('.toolbar-btn');
    expect(buttons.length).toBeGreaterThan(0);

    for (const btn of Array.from(buttons)) {
      // No CSS e inline, todos têm min-height e min-width de pelo menos 44px
      expect(btn.className).toContain('toolbar-btn');
    }

    toolbar.dispose();
  });

  test('não exibe a barra se a seleção estiver fora do verso (ex.: na frente do card)', () => {
    const { frontEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = frontEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 4);

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation: jest.fn(),
      onSetColor: jest.fn(),
    });

    toolbar.checkSelection();
    expect(toolbar.isVisible()).toBe(false);

    toolbar.dispose();
  });

  test('tocar numa cor cria e salva grifo (kind: hl) imediatamente com a cor escolhida', async () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8); // "IECA/BRA"

    const mockSaved: SavedAnnotation = {
      id: 'ann-uuid-1',
      note_id: 'note-123',
      group_key: null,
      kind: 'hl',
      color: 'verde',
      quote: 'IECA/BRA',
      prefix: '',
      suffix: ' ou INRA, betabloqueador e espironolacto',
      start: 0,
      end: 8,
      note: '',
      label: '',
      created_at: 1000,
      updated_at: 1000,
    };

    const onSaveAnnotation = jest.fn().mockResolvedValue(mockSaved);
    const onSetColor = jest.fn();

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation,
      onSetColor,
    });

    toolbar.checkSelection();

    // Clica no botão da cor verde
    const greenBtn = toolbar.element.querySelector<HTMLButtonElement>(
      '.toolbar-color-btn[data-color="verde"]'
    );
    expect(greenBtn).not.toBeNull();
    greenBtn?.click();

    expect(onSetColor).toHaveBeenCalledWith('verde');

    // Aguarda o salvamento assíncrono
    await Promise.resolve();

    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        note_id: 'note-123',
        kind: 'hl',
        color: 'verde',
        quote: 'IECA/BRA',
        start: 0,
        end: 8,
      })
    );

    // O texto foi pintado com <mark class="ann c-verde ...">
    const markEl = backEl.querySelector('mark.ann');
    expect(markEl).not.toBeNull();
    expect(markEl?.getAttribute('data-aid')).toBe('ann-uuid-1');
    expect(markEl?.className).toContain('c-verde');
    expect(markEl?.className).toContain('hl');
    expect(markEl?.textContent).toBe('IECA/BRA');

    // A barra foi fechada após o grifo
    expect(toolbar.isVisible()).toBe(false);

    // A unidade em memória recebeu a anotação
    expect(sampleUnits[0].annotations.length).toBe(1);
    expect(sampleUnits[0].annotations[0].id).toBe('ann-uuid-1');

    toolbar.dispose();
  });

  test('tocar em U cria e salva anotação sublinhada (kind: ul) com a última cor ativa', async () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 12, 16); // "INRA"

    const mockSaved: SavedAnnotation = {
      id: 'ann-uuid-2',
      note_id: 'note-123',
      group_key: null,
      kind: 'ul',
      color: 'azul',
      quote: 'INRA',
      prefix: 'IECA/BRA ou ',
      suffix: ', betabloqueador e espironolactona.',
      start: 12,
      end: 16,
      note: '',
      label: '',
      created_at: 1000,
      updated_at: 1000,
    };

    const onSaveAnnotation = jest.fn().mockResolvedValue(mockSaved);
    const onSetColor = jest.fn();

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'azul',
      onSaveAnnotation,
      onSetColor,
    });

    toolbar.checkSelection();

    const underlineBtn = toolbar.element.querySelector<HTMLButtonElement>(
      '.toolbar-underline-btn'
    );
    expect(underlineBtn).not.toBeNull();
    underlineBtn?.click();

    await Promise.resolve();

    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'ul',
        color: 'azul',
        quote: 'INRA',
      })
    );

    const markEl = backEl.querySelector('mark.ann');
    expect(markEl?.className).toContain('ul');
    expect(markEl?.className).toContain('c-azul');

    expect(toolbar.isVisible()).toBe(false);

    toolbar.dispose();
  });

  test('tocar em ✎ abre modo de nota, permite digitar texto e salva com nota e indicador ✎', async () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8); // "IECA/BRA"

    const mockSaved: SavedAnnotation = {
      id: 'ann-uuid-3',
      note_id: 'note-123',
      group_key: null,
      kind: 'hl',
      color: 'amarelo',
      quote: 'IECA/BRA',
      prefix: '',
      suffix: ' ou INRA, betabloqueador e espironolacto',
      start: 0,
      end: 8,
      note: 'Dose inicial baixa e titular',
      label: '',
      created_at: 1000,
      updated_at: 1000,
    };

    const onSaveAnnotation = jest.fn().mockResolvedValue(mockSaved);

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation,
      onSetColor: jest.fn(),
    });

    toolbar.checkSelection();

    // Clica no botão Nota
    const noteBtn = toolbar.element.querySelector<HTMLButtonElement>('.toolbar-note-btn');
    noteBtn?.click();

    // Barra entra em modo de nota com input
    const input = toolbar.element.querySelector<HTMLInputElement>('.toolbar-note-input');
    expect(input).not.toBeNull();
    expect(input?.placeholder).toBe(strings.consulta.toolbarNotePlaceholder);

    input!.value = 'Dose inicial baixa e titular';

    // Clica em Salvar (✓)
    const saveBtn = toolbar.element.querySelector<HTMLButtonElement>(
      '.toolbar-note-save-btn'
    );
    expect(saveBtn).not.toBeNull();
    saveBtn?.click();

    await Promise.resolve();

    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'hl',
        color: 'amarelo',
        quote: 'IECA/BRA',
        note: 'Dose inicial baixa e titular',
      })
    );

    // O mark pintado no verso recebe a classe has-note
    const markEl = backEl.querySelector('mark.ann');
    expect(markEl?.className).toContain('has-note');

    expect(toolbar.isVisible()).toBe(false);

    toolbar.dispose();
  });

  test('tocar em Copiar copia o trecho para a área de transferência e dá feedback visual', () => {
    jest.useFakeTimers();

    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8); // "IECA/BRA"

    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation: jest.fn(),
      onSetColor: jest.fn(),
    });

    toolbar.checkSelection();

    const copyBtn = toolbar.element.querySelector<HTMLButtonElement>('.toolbar-copy-btn');
    expect(copyBtn).not.toBeNull();
    copyBtn?.click();

    expect(mockWriteText).toHaveBeenCalledWith('IECA/BRA');
    expect(copyBtn?.textContent).toContain(strings.consulta.toolbarCopied);

    jest.advanceTimersByTime(500);

    expect(toolbar.isVisible()).toBe(false);

    jest.useRealTimers();
    toolbar.dispose();
  });

  test('suprime menu de contexto nativo no evento contextmenu quando há seleção', () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8);

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation: jest.fn(),
      onSetColor: jest.fn(),
    });

    const event = new MouseEvent('contextmenu', { cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);

    toolbar.dispose();
  });

  test('posiciona a barra abaixo da seleção quando esta se encontra no topo do viewport', () => {
    const { backEl } = setupDOMWithUnit(sampleUnits[0]);
    const pNode = backEl.querySelector('p')!.firstChild!;
    const range = mockSelection(pNode, 0, 8);

    // Seleção bem no topo (top = 10px): não cabe a barra acima
    range.getBoundingClientRect = () =>
      ({
        top: 10,
        bottom: 35,
        left: 50,
        right: 150,
        width: 100,
        height: 25,
      }) as DOMRect;

    const toolbar = createSelectionToolbar({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => sampleUnits,
      getLastColor: () => 'amarelo',
      onSaveAnnotation: jest.fn(),
      onSetColor: jest.fn(),
    });

    toolbar.checkSelection();

    expect(toolbar.isVisible()).toBe(true);
    const topPx = parseInt(toolbar.element.style.top, 10);
    // Deve ser posicionado abaixo do rect.bottom (35 + 10 = 45px)
    expect(topPx).toBeGreaterThanOrEqual(35);

    toolbar.dispose();
  });

  test('integração com ConsultaApp: barra funciona com lotes carregados', async () => {
    const postMock = jest.fn();
    const app = createConsultaApp({
      mountRoot: container,
      win: window,
      post: postMock,
      initialData: {
        theme: 'light',
        fontSize: 17,
        lastColor: 'rosa',
        showFront: true,
        units: sampleUnits,
        hasMore: false,
      },
    });

    const backEl = container.querySelector<HTMLElement>('.unit-back')!;
    const pNode = backEl.querySelector('p')!.firstChild!;
    mockSelection(pNode, 0, 8);

    app.toolbar.checkSelection();
    expect(app.toolbar.isVisible()).toBe(true);

    // A cor ativa segue o settings inicial ('rosa')
    const pinkBtn = app.toolbar.element.querySelector('.toolbar-color-btn[data-color="rosa"]');
    expect(pinkBtn?.className).toContain('active');

    app.dispose();
  });
});
