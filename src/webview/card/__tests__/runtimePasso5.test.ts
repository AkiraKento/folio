import { JSDOM } from 'jsdom';
import { renderCard } from '@/render/card';
import { AVICENA_FIXTURE, ANKING_FIXTURE } from '../__fixtures__';
import { buildAnkiDocument } from '../ankiDocument';
import { describe as describeSelection } from '../../shared/anchor';
import { cardRuntimeJs } from '../../generated/card';

describe('M10 Passo 5 — Runtime do Weiss dentro do documento', () => {
  it('um grifo criado na Consulta numa nota avicena aparece no verso da revisão no trecho certo, com as pílulas de tag presentes', async () => {
    const noteType = AVICENA_FIXTURE.toNoteType();
    const example = AVICENA_FIXTURE.example;

    // 1. Simula a criação de um grifo no texto da nota na Consulta
    const consultaDom = new JSDOM(
      `<!doctype html><html><body><div id="unit-body">${example.fields.answer}</div></body></html>`
    );
    const unitBody = consultaDom.window.document.getElementById('unit-body')!;
    const fullText = unitBody.textContent ?? '';
    const targetPhrase = 'inflamação de um órgão de exemplo';
    const startIdx = fullText.indexOf(targetPhrase);
    expect(startIdx).toBeGreaterThan(0);

    // Encontra o nó de texto que contém targetPhrase para criar um Range real como na Consulta
    const walker = consultaDom.window.document.createTreeWalker(
      unitBody,
      consultaDom.window.NodeFilter.SHOW_TEXT
    );
    let targetNode: Text | null = null;
    let nodeOffset = 0;
    while (walker.nextNode()) {
      const tn = walker.currentNode as Text;
      const idx = (tn.data || '').indexOf(targetPhrase);
      if (idx !== -1) {
        targetNode = tn;
        nodeOffset = idx;
        break;
      }
    }
    expect(targetNode).not.toBeNull();

    const range = consultaDom.window.document.createRange();
    range.setStart(targetNode!, nodeOffset);
    range.setEnd(targetNode!, nodeOffset + targetPhrase.length);

    const described = describeSelection(unitBody, range);
    expect(described).not.toBeNull();
    expect(described?.quote).toBe(targetPhrase);
    consultaDom.window.close();

    // 2. Renderiza o verso da nota avicena com o runtime do Weiss injetado
    const rendered = renderCard({
      noteType,
      fields: example.fields,
      cardOrd: example.cardOrd ?? 0,
      tags: example.tags,
      deckName: 'Clínica::Cardiologia',
    });

    const outboundMessages: Array<{
      type: string;
      payload?: { side?: string; height?: number; backgroundColor?: string };
    }> = [];

    const docHtml = buildAnkiDocument(
      {
        html: rendered.back,
        side: 'back',
        theme: 'light',
        css: noteType.css ?? '',
        isBuiltinModel: false,
        cardId: 'card-avicena-p5',
        noteId: 'note-avicena-p5',
        cardOrd: example.cardOrd ?? 0,
        fields: example.fields,
        tags: example.tags,
        showHighlights: true,
        annotations: [
          {
            id: 'ann-avicena-1',
            kind: 'hl',
            color: 'amarelo',
            quote: described!.quote,
            prefix: described!.prefix,
            suffix: described!.suffix,
            start: described!.start,
            end: described!.end,
            note: 'Revisar fisiopatologia da dispneia paroxística noturna',
          },
        ],
      },
      {
        runtimeScript: cardRuntimeJs,
      }
    );

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
      url: 'file:///media/',
    });

    dom.window.ReactNativeWebView = {
      postMessage: (raw: string) => {
        outboundMessages.push(JSON.parse(raw));
      },
    };

    // Espera 2 rAF + 150ms + MutationObserver quieto por 100ms
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Pílulas de tag do avicena devem estar presentes
    const tagPills = dom.window.document.querySelectorAll('.tag-pill:not(#reload-imgs-btn)');
    expect(tagPills.length).toBe(example.tags.length);

    // O grifo deve estar aplicado exatamente no trecho certo dentro de #answer
    const marks = dom.window.document.querySelectorAll<HTMLElement>(
      '#answer mark[data-aid="ann-avicena-1"]'
    );
    expect(marks.length).toBeGreaterThan(0);
    const highlightedText = Array.from(marks)
      .map((m) => m.textContent)
      .join('');
    expect(highlightedText).toBe(targetPhrase);

    // Nenhuma pílula de tag ou botão deve ter sido grifada por engano
    expect(dom.window.document.querySelectorAll('.tags-container mark').length).toBe(0);

    // Tocar no grifo abre o balão da nota
    marks[0].click();
    const tooltip = dom.window.document.querySelector('.card-note-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toBe(
      'Revisar fisiopatologia da dispneia paroxística noturna'
    );

    // Verifica que a imagem do avicena recebeu .zoom-enabled do próprio template e NÃO abriu .weiss-zoom-overlay
    const img = dom.window.document.querySelector<HTMLImageElement>('#answer img');
    expect(img).not.toBeNull();
    expect(img?.classList.contains('zoom-enabled')).toBe(true);
    expect(img?.hasAttribute('data-weiss-zoom-bound')).toBe(false);

    // Verifica que a cor de fundo efetiva de body.card (#e4ebe4 = rgb(228, 235, 228)) foi reportada ao RN
    const renderedMsgs = outboundMessages.filter((m) => m.type === 'rendered');
    expect(renderedMsgs.length).toBeGreaterThan(0);
    expect(renderedMsgs[renderedMsgs.length - 1].payload?.backgroundColor).toBe(
      'rgb(228, 235, 228)'
    );

    dom.window.close();
  });

  it('abre overlay de zoom com toque duplo apenas em imagens sem .zoom-enabled e reporta cor de fundo do AnKing', async () => {
    const noteType = ANKING_FIXTURE.toNoteType();
    const docHtml = buildAnkiDocument(
      {
        html: '<div id="text">Imagem sem script de zoom: <img id="plain-img" src="exemplo-avicena.png" alt="Teste"></div>',
        side: 'back',
        theme: 'dark',
        css: noteType.css ?? '',
        isBuiltinModel: false,
      },
      {
        runtimeScript: cardRuntimeJs,
      }
    );

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
      url: 'file:///media/',
    });

    await new Promise((resolve) => setTimeout(resolve, 350));

    const plainImg = dom.window.document.getElementById('plain-img') as HTMLImageElement;
    expect(plainImg).not.toBeNull();
    expect(plainImg.classList.contains('zoom-enabled')).toBe(false);
    expect(plainImg.getAttribute('data-weiss-zoom-bound')).toBe('true');

    // Simula duplo clique na imagem
    plainImg.dispatchEvent(new dom.window.MouseEvent('dblclick', { bubbles: true }));

    const overlay = dom.window.document.querySelector('.weiss-zoom-overlay') as HTMLElement;
    expect(overlay).not.toBeNull();
    expect(overlay.querySelector('img')?.getAttribute('src')).toBe('exemplo-avicena.png');

    // Clicar no fundo do overlay fecha o zoom
    overlay.click();
    expect(dom.window.document.querySelector('.weiss-zoom-overlay')).toBeNull();

    dom.window.close();
  });
});
