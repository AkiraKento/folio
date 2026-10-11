/**
 * @jest-environment jsdom
 */

import { createHighlightPopover } from '../popover';
import { createConsultaApp } from '../app';
import { apply } from '../../shared/anchor';
import type { ConsultaUnitWeb } from '../types';
import type { SavedAnnotation } from '../protocol';

describe('Consulta WebView Highlight Popover - MODO_CONSULTA.md §3', () => {
  let container: HTMLElement;
  let sampleUnit: ConsultaUnitWeb;
  let sampleAnnotation: SavedAnnotation;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'root';
    document.body.appendChild(container);

    sampleAnnotation = {
      id: 'ann-123',
      note_id: 'note-cardio',
      group_key: null,
      kind: 'hl',
      color: 'amarelo',
      quote: 'IECA/BRA ou INRA',
      prefix: '',
      suffix: ', betabloqueador e espironolactona.',
      start: 0,
      end: 16,
      note: 'Primeiro pilar',
      label: '',
      created_at: 1000,
      updated_at: 1000,
    };

    sampleUnit = {
      index: 0,
      noteId: 'note-cardio',
      deckPath: 'Medicina::Cardiologia',
      frontHtml: '<p>Qual o primeiro pilar da ICFEr?</p>',
      backHtml: '<p>IECA/BRA ou INRA, betabloqueador e espironolactona.</p>',
      tags: ['cardio'],
      suspended: false,
      annotations: [sampleAnnotation],
    };
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  function setupDOMWithUnit(unit: ConsultaUnitWeb): {
    unitEl: HTMLElement;
    backEl: HTMLElement;
    markEl: HTMLElement;
  } {
    const unitEl = document.createElement('article');
    unitEl.className = 'consulta-unit';
    unitEl.dataset.unitIndex = String(unit.index);
    unitEl.dataset.noteId = unit.noteId;

    const backEl = document.createElement('div');
    backEl.className = 'unit-back';
    backEl.innerHTML = unit.backHtml;

    // Aplica a anotação para criar os <mark> no DOM
    apply(backEl, unit.annotations);

    unitEl.appendChild(backEl);
    container.appendChild(unitEl);

    const markEl = backEl.querySelector<HTMLElement>('mark[data-aid="ann-123"]')!;

    return { unitEl, backEl, markEl };
  }

  it('abre o popover ao tocar em um <mark> de grifo existente', () => {
    const { markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn();
    const onDeleteAnnotation = jest.fn();
    const onSetColor = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
    });

    expect(popover.isVisible()).toBe(false);

    // Clica no grifo
    markEl.click();

    expect(popover.isVisible()).toBe(true);

    // Verifica que contém os botões de cores
    const colorBtns = popover.element.querySelectorAll('.popover-color-btn');
    expect(colorBtns.length).toBe(5);

    // Cor amarela deve estar ativa
    const yellowBtn = popover.element.querySelector('.popover-color-btn[data-color="amarelo"]');
    expect(yellowBtn?.classList.contains('active')).toBe(true);

    // Botão U (sublinhado)
    const toggleBtn = popover.element.querySelector('.popover-toggle-btn');
    expect(toggleBtn).not.toBeNull();

    // Botão Apagar
    const deleteBtn = popover.element.querySelector('.popover-delete-btn');
    expect(deleteBtn).not.toBeNull();

    // Campo de nota preenchido
    const noteInput = popover.element.querySelector<HTMLInputElement>('.popover-note-input');
    expect(noteInput).not.toBeNull();
    expect(noteInput?.value).toBe('Primeiro pilar');

    popover.dispose();
  });

  it('troca a cor do grifo: atualiza DOM, salva via bridge e notifica nova cor', async () => {
    const { backEl, markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn().mockResolvedValue(sampleAnnotation);
    const onDeleteAnnotation = jest.fn();
    const onSetColor = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
    });

    markEl.click();

    // Clica na cor verde
    const greenBtn = popover.element.querySelector<HTMLButtonElement>(
      '.popover-color-btn[data-color="verde"]'
    )!;
    greenBtn.click();

    expect(onSetColor).toHaveBeenCalledWith('verde');
    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-123',
        color: 'verde',
      })
    );

    // Verifica atualização de classes no DOM
    const updatedMark = backEl.querySelector('mark[data-aid="ann-123"]');
    expect(updatedMark?.classList.contains('c-verde')).toBe(true);
    expect(updatedMark?.classList.contains('cq-c-verde')).toBe(true);

    popover.dispose();
  });

  it('alterna o tipo da anotação entre grifo (hl) e sublinhado (ul)', async () => {
    const { backEl, markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn().mockResolvedValue(sampleAnnotation);
    const onDeleteAnnotation = jest.fn();
    const onSetColor = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
    });

    markEl.click();

    const toggleBtn = popover.element.querySelector<HTMLButtonElement>('.popover-toggle-btn')!;
    toggleBtn.click();

    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-123',
        kind: 'ul',
      })
    );

    const updatedMark = backEl.querySelector('mark[data-aid="ann-123"]');
    expect(updatedMark?.classList.contains('ul')).toBe(true);
    expect(updatedMark?.classList.contains('cq-ul')).toBe(true);

    // Alterna de volta para hl
    toggleBtn.click();
    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-123',
        kind: 'hl',
      })
    );

    popover.dispose();
  });

  it('salva nota alterada ao fechar o popover (MODO_CONSULTA.md §3)', async () => {
    const { backEl, markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn().mockResolvedValue(sampleAnnotation);
    const onDeleteAnnotation = jest.fn();
    const onSetColor = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
    });

    markEl.click();

    const noteInput = popover.element.querySelector<HTMLInputElement>('.popover-note-input')!;
    noteInput.value = 'Nota atualizada com novas evidências';

    // Clica fora para fechar o popover
    document.body.click();

    expect(popover.isVisible()).toBe(false);
    expect(onSaveAnnotation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ann-123',
        note: 'Nota atualizada com novas evidências',
      })
    );

    // Trecho com nota possui classe has-note
    const updatedMark = backEl.querySelector('mark[data-aid="ann-123"]');
    expect(updatedMark?.classList.contains('has-note')).toBe(true);

    popover.dispose();
  });

  it('apaga o grifo: remove do DOM, exclui na bridge e emite evento de deleção para Desfazer', async () => {
    const { backEl, markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn();
    const onDeleteAnnotation = jest.fn().mockResolvedValue(true);
    const onSetColor = jest.fn();
    const onAnnotationDeleted = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
      onAnnotationDeleted,
    });

    markEl.click();

    const deleteBtn = popover.element.querySelector<HTMLButtonElement>('.popover-delete-btn')!;
    deleteBtn.click();

    expect(popover.isVisible()).toBe(false);

    // Mark removido do DOM, preservando o textContent
    expect(backEl.querySelector('mark[data-aid="ann-123"]')).toBeNull();
    expect(backEl.textContent).toContain('IECA/BRA ou INRA, betabloqueador');

    // Soft delete via ponte
    expect(onDeleteAnnotation).toHaveBeenCalledWith('ann-123');

    // Notificado para exibir o Snackbar no app
    expect(onAnnotationDeleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ann-123' }),
      0
    );

    // Removido da lista de anotações da unidade
    expect(sampleUnit.annotations.length).toBe(0);

    popover.dispose();
  });

  it('restaura anotação desfeita no DOM (Desfazer)', () => {
    const { backEl, markEl } = setupDOMWithUnit(sampleUnit);

    const onSaveAnnotation = jest.fn();
    const onDeleteAnnotation = jest.fn().mockResolvedValue(true);
    const onSetColor = jest.fn();

    const popover = createHighlightPopover({
      rootEl: container,
      doc: document,
      win: window,
      getUnits: () => [sampleUnit],
      onSaveAnnotation,
      onDeleteAnnotation,
      onSetColor,
    });

    // Apaga primeiro
    markEl.click();
    const deleteBtn = popover.element.querySelector<HTMLButtonElement>('.popover-delete-btn')!;
    deleteBtn.click();

    expect(backEl.querySelector('mark[data-aid="ann-123"]')).toBeNull();

    // Restaura a anotação
    popover.restore(0, sampleAnnotation);

    // O grifo voltou ao DOM com as classes certas
    const restoredMark = backEl.querySelector('mark[data-aid="ann-123"]');
    expect(restoredMark).not.toBeNull();
    expect(restoredMark?.textContent).toBe('IECA/BRA ou INRA');
    expect(restoredMark?.classList.contains('c-amarelo')).toBe(true);

    // Foi reinserido nas anotações da unidade
    expect(sampleUnit.annotations.some((a) => a.id === 'ann-123')).toBe(true);

    popover.dispose();
  });

  it('integração com ConsultaApp: fecha popover ao iniciar seleção e restaura via bridge', async () => {
    const postMock = jest.fn();

    const app = createConsultaApp({
      mountRoot: container,
      win: window,
      post: postMock,
      initialData: {
        units: [sampleUnit],
        hasMore: false,
        theme: 'light',
        fontSize: 17,
        lastColor: 'amarelo',
        showFront: true,
      },
    });

    const rootEl = container.querySelector('#consulta-root')!;
    const markEl = rootEl.querySelector<HTMLElement>('mark[data-aid="ann-123"]')!;
    expect(markEl).not.toBeNull();

    // Abre o popover ao clicar no grifo
    markEl.click();
    expect(app.popover.isVisible()).toBe(true);

    // Simula restauração via mensagem bridge 'restoreAnnotation'
    // Primeiro remove no DOM
    const backEl = rootEl.querySelector('.unit-back')!;
    markEl.remove();

    app.receive({
      type: 'restoreAnnotation',
      payload: {
        unitIndex: 0,
        annotation: sampleAnnotation,
      },
    });

    // O grifo foi restaurado no DOM
    expect(backEl.querySelector('mark[data-aid="ann-123"]')).not.toBeNull();

    app.dispose();
  });
});
