import { JSDOM } from 'jsdom';
import {
  describe as describeRange,
  locate,
  wrap,
  unwrap,
  unwrapAll,
  decorate,
  marksOf,
  apply,
  AnnotationColor,
  AnnotationData,
} from '../anchor';

describe('Algoritmo de Âncora (src/webview/shared/anchor.ts) - MODO_CONSULTA.md §7', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
    document = dom.window.document;
  });

  function getRoot(html: string): HTMLElement {
    const root = document.getElementById('root')!;
    root.innerHTML = html;
    return root;
  }

  // 1. describe/locate de ida e volta num parágrafo simples.
  test('1. describe/locate de ida e volta num parágrafo simples', () => {
    const root = getRoot('<p>O coração tem quatro câmaras: dois átrios e dois ventrículos.</p>');
    const textNode = root.querySelector('p')!.firstChild as Text;

    // Seleciona "quatro câmaras"
    const range = document.createRange();
    const startIndex = textNode.data.indexOf('quatro câmaras');
    const endIndex = startIndex + 'quatro câmaras'.length;
    range.setStart(textNode, startIndex);
    range.setEnd(textNode, endIndex);

    const desc = describeRange(root, range);
    expect(desc).not.toBeNull();
    expect(desc!.quote).toBe('quatro câmaras');
    expect(desc!.start).toBe(startIndex);
    expect(desc!.end).toBe(endIndex);
    expect(desc!.prefix).toBe('O coração tem ');
    expect(desc!.suffix).toBe(': dois átrios e dois ventrículos.');

    // locate no mesmo elemento reencontra a posição exata
    const loc = locate(root, desc!);
    expect(loc).toEqual([startIndex, endIndex]);

    // Aplica wrap e verifica os elementos gerados
    const marks = wrap(root, loc![0], loc![1], {
      id: 'ann-1',
      kind: 'hl',
      color: 'amarelo',
      note: 'quatro cavidades',
    });
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('quatro câmaras');
    expect(marks[0].getAttribute('data-aid')).toBe('ann-1');
    expect(marks[0].className).toContain('cq-mark');
    expect(marks[0].className).toContain('ann');
    expect(marks[0].className).toContain('cq-hl');
    expect(marks[0].className).toContain('hl');
    expect(marks[0].className).toContain('cq-c-amarelo');
    expect(marks[0].className).toContain('c-amarelo');
    expect(marks[0].className).toContain('has-note');
    expect(marks[0].className).toContain('end');
  });

  // 2. O mesmo trecho aparece 2× no texto e o contexto escolhe a ocorrência certa.
  test('2. O mesmo trecho aparece 2x no texto e o contexto escolhe a ocorrência certa', () => {
    const text = 'O ventrículo esquerdo ejeta sangue. O ventrículo direito recebe sangue venoso.';
    const root = getRoot(`<p>${text}</p>`);

    const firstPos = text.indexOf('ventrículo');
    const secondPos = text.lastIndexOf('ventrículo');
    expect(firstPos).not.toBe(secondPos);

    // Anotação visando a SEGUNDA ocorrência ("O ventrículo direito")
    const annSecond: AnnotationData = {
      id: 'ann-2',
      kind: 'hl',
      color: 'verde',
      quote: 'ventrículo',
      prefix: 'eja sangue. O ', // contexto anterior (sufixo do prefixo)
      suffix: ' direito recebe sangue',
      start: secondPos,
      end: secondPos + 'ventrículo'.length,
    };

    // Altera propositalmente start para forçar desempate pelo score de contexto
    const annSecondMoved = {
      ...annSecond,
      start: 0,
      end: 'ventrículo'.length,
    };

    const loc2 = locate(root, annSecondMoved);
    expect(loc2).toEqual([secondPos, secondPos + 'ventrículo'.length]);

    // Anotação visando a PRIMEIRA ocorrência
    const annFirst: AnnotationData = {
      id: 'ann-1',
      kind: 'ul',
      color: 'azul',
      quote: 'ventrículo',
      prefix: 'O ',
      suffix: ' esquerdo ejeta sangue.',
      start: 50, // propositalmente deslocado
      end: 60,
    };

    const loc1 = locate(root, annFirst);
    expect(loc1).toEqual([firstPos, firstPos + 'ventrículo'.length]);
  });

  // 3. Card editado com texto inserido antes do trecho: a anotação é reencontrada.
  test('3. Card editado com texto inserido antes do trecho: a anotação é reencontrada', () => {
    // Texto original
    const origText = 'A pressão arterial normal é 120 por 80 mmHg.';
    const origStart = origText.indexOf('120 por 80');
    const origEnd = origStart + '120 por 80'.length;

    const ann: AnnotationData = {
      id: 'ann-bp',
      kind: 'hl',
      color: 'amarelo',
      quote: '120 por 80',
      prefix: 'A pressão arterial normal é ',
      suffix: ' mmHg.',
      start: origStart,
      end: origEnd,
    };

    // Card editado: adicionado parágrafo antes
    const editedText =
      'Em indivíduos adultos normotensos em repouso, a pressão arterial normal é 120 por 80 mmHg.';
    const root = getRoot(`<p>${editedText}</p>`);

    const newStart = editedText.indexOf('120 por 80');
    const newEnd = newStart + '120 por 80'.length;
    expect(newStart).not.toBe(origStart);

    const loc = locate(root, ann);
    expect(loc).toEqual([newStart, newEnd]);
  });

  // 4. Espaços e quebras de linha mudaram dentro do trecho: reencontra pelo passo 3.
  test('4. Espaços e quebras de linha mudaram dentro do trecho: reencontra pelo passo 3 (squash)', () => {
    const ann: AnnotationData = {
      id: 'ann-drugs',
      kind: 'hl',
      color: 'laranja',
      quote: 'IECA betabloqueador e espironolactona',
      prefix: 'O tratamento inclui ',
      suffix: ' na fase inicial.',
      start: 21,
      end: 21 + 'IECA betabloqueador e espironolactona'.length,
    };

    // Card editado com múltiplas quebras de linha e espaços no meio do trecho
    const editedHtml =
      '<p>O tratamento inclui IECA \n\n  betabloqueador \n  e espironolactona na fase inicial.</p>';
    const root = getRoot(editedHtml);

    const loc = locate(root, ann);
    expect(loc).not.toBeNull();
    const foundText = root.textContent!.slice(loc![0], loc![1]);
    expect(foundText.replace(/\s+/g, ' ')).toBe('IECA betabloqueador e espironolactona');
  });

  // 5. Trecho apagado do card: vira órfã e não lança erro.
  test('5. Trecho apagado do card: vira órfã e não lança erro', () => {
    const root = getRoot('<p>O paciente recebeu alta sem intercorrências.</p>');

    const ann: AnnotationData = {
      id: 'ann-orphan',
      kind: 'hl',
      color: 'rosa',
      quote: 'insuficiência cardíaca descompensada',
      prefix: 'diagnosticado com ',
      suffix: ' e choque cardiogênico.',
      start: 15,
      end: 51,
    };

    expect(() => {
      const loc = locate(root, ann);
      expect(loc).toBeNull();
    }).not.toThrow();

    let orphans: AnnotationData[] = [];
    expect(() => {
      orphans = apply(root, [ann]);
    }).not.toThrow();

    expect(orphans).toEqual([ann]);
    expect(marksOf(root, ann.id)).toHaveLength(0);
  });

  // 6. Seleção que atravessa <b>, <span class="cloze"> e <br>: pinta todos os pedaços e textContent continua igual.
  test('6. Seleção que atravessa <b>, <span class="cloze"> e <br>: pinta todos os pedaços e textContent continua igual', () => {
    const initialHtml =
      '<p>Início do texto <b>negrito importante</b> e <span class="cloze">lacuna em destaque</span><br> segunda linha após quebra final.</p>';
    const root = getRoot(initialHtml);
    const textBefore = root.textContent!;

    // Trecho que começa dentro de <b>, pega o texto entre eles, atravessa o cloze e alcança a segunda linha
    const quote = 'importante e lacuna em destaque segunda linha';
    const ann: AnnotationData = {
      id: 'ann-span',
      kind: 'hl',
      color: 'amarelo',
      quote,
      start: textBefore.indexOf(quote),
      end: textBefore.indexOf(quote) + quote.length,
    };

    const loc = locate(root, ann);
    expect(loc).toEqual([ann.start, ann.end]);

    const marks = wrap(root, loc![0], loc![1], ann);
    // Deve criar marks divididos nos nós de texto dentro das diferentes tags
    expect(marks.length).toBeGreaterThanOrEqual(3);

    // O textContent total NÃO pode mudar
    expect(root.textContent).toBe(textBefore);

    // Verifica que nenhum <br> foi embrulhado
    for (const m of marks) {
      expect(m.querySelector('br')).toBeNull();
      expect(m.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  // 7. Duas anotações sobrepostas: as duas pintadas; apagar uma não estraga a outra.
  test('7. Duas anotações sobrepostas: as duas pintadas; apagar uma não estraga a outra', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const root = getRoot(`<p>${text}</p>`);

    // Anotação 1: "DEFGH" (pos 3 a 8)
    const ann1: AnnotationData = {
      id: 'ann-1',
      kind: 'hl',
      color: 'amarelo',
      quote: 'DEFGH',
      start: 3,
      end: 8,
    };

    // Anotação 2: "FGHIJK" (pos 5 a 11) - sobrepõe "FGH"
    const ann2: AnnotationData = {
      id: 'ann-2',
      kind: 'ul',
      color: 'verde',
      quote: 'FGHIJK',
      start: 5,
      end: 11,
    };

    const orphans = apply(root, [ann1, ann2]);
    expect(orphans).toHaveLength(0);

    // Ambas têm marcas no DOM
    const marks1Before = marksOf(root, ann1.id);
    const marks2Before = marksOf(root, ann2.id);
    expect(marks1Before.length).toBeGreaterThan(0);
    expect(marks2Before.length).toBeGreaterThan(0);
    expect(root.textContent).toBe(text);

    // Apaga a anotação 1 (unwrap)
    unwrap(root, ann1.id);

    // Marca 1 não existe mais
    expect(marksOf(root, ann1.id)).toHaveLength(0);

    // Marca 2 permanece e textContent segue íntegro
    const marks2After = marksOf(root, ann2.id);
    expect(marks2After.length).toBeGreaterThan(0);
    expect(root.textContent).toBe(text);

    // O trecho coberto por ann2 continua contendo exatamente "FGHIJK"
    const ann2Text = Array.from<Element>(marks2After)
      .map((m) => m.textContent)
      .join('');
    expect(ann2Text).toBe('FGHIJK');
  });

  // 8. Performance: aplicar 50 anotações num verso de 5.000 caracteres em menos de 30 ms.
  test('8. Performance: aplicar 50 anotações num verso de 5.000 caracteres em menos de 30 ms', () => {
    // Gera texto com ~5.000 caracteres
    const sentence =
      'O sistema cardiovascular é composto pelo coração e vasos sanguíneos distribuídos. ';
    const repetitions = Math.ceil(5000 / sentence.length);
    const fullText = sentence.repeat(repetitions).slice(0, 5000);
    const root = getRoot(`<div class="card-back">${fullText}</div>`);

    // Gera 50 anotações espaçadas uniformemente
    const anns: AnnotationData[] = [];
    const step = Math.floor((fullText.length - 100) / 50);

    for (let i = 0; i < 50; i++) {
      const start = i * step + 5;
      const quote = 'coração e vasos';
      const quoteStart = fullText.indexOf(quote, start);
      const actualStart = quoteStart !== -1 ? quoteStart : start;
      const actualQuote = fullText.slice(actualStart, actualStart + quote.length);
      const actualEnd = actualStart + actualQuote.length;

      anns.push({
        id: `perf-ann-${i}`,
        kind: i % 2 === 0 ? 'hl' : 'ul',
        color: (['amarelo', 'verde', 'azul', 'rosa', 'laranja'] as AnnotationColor[])[i % 5],
        quote: actualQuote,
        prefix: fullText.slice(Math.max(0, actualStart - 40), actualStart),
        suffix: fullText.slice(actualEnd, actualEnd + 40),
        start: actualStart,
        end: actualEnd,
        note: i % 3 === 0 ? 'Nota de teste de performance' : '',
      });
    }

    // Aquecimento do JIT para eliminar overhead de interpretação inicial do V8
    apply(root, anns.slice(0, 10));
    unwrapAll(root);

    // Mede a execução isolando ruído de GC / escalonamento concorrente de workers do Jest
    let elapsed = Infinity;
    let orphans: typeof anns = [];
    for (let run = 0; run < 3; run++) {
      unwrapAll(root);
      const t0 = performance.now();
      const res = apply(root, anns);
      const dt = performance.now() - t0;
      if (dt < elapsed) {
        elapsed = dt;
        orphans = res;
      }
    }

    expect(orphans).toHaveLength(0);
    expect(root.querySelectorAll('mark[data-aid]').length).toBeGreaterThanOrEqual(50);
    expect(root.textContent).toBe(fullText);
    // Critério estrito da §7: menos de 30 ms
    expect(elapsed).toBeLessThan(30);
  });

  // Testes adicionais de robustez e cobertura
  test('describeRange lida com seleções com espaços nas bordas e fora do root', () => {
    const root = getRoot('<p>  Texto com espaços nas pontas   </p>');
    const textNode = root.querySelector('p')!.firstChild as Text;

    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, textNode.data.length);

    const desc = describeRange(root, range);
    expect(desc).not.toBeNull();
    expect(desc!.quote).toBe('Texto com espaços nas pontas');
    expect(desc!.start).toBe(2);
  });

  test('unwrapAll remove todas as marcas e restaura o DOM normalizado', () => {
    const root = getRoot('<p>Texto de teste para desmarcação geral completa.</p>');
    const anns: AnnotationData[] = [
      {
        id: 'a1',
        kind: 'hl',
        color: 'amarelo',
        quote: 'teste',
        start: 9,
        end: 14,
      },
      {
        id: 'a2',
        kind: 'ul',
        color: 'verde',
        quote: 'desmarcação',
        start: 20,
        end: 31,
      },
    ];

    apply(root, anns);
    expect(root.querySelectorAll('mark').length).toBe(2);

    unwrapAll(root);
    expect(root.querySelectorAll('mark').length).toBe(0);
    expect(root.textContent).toBe('Texto de teste para desmarcação geral completa.');
  });

  test('decorate atualiza atributos e classes ao modificar anotação existente', () => {
    const root = getRoot('<p>Anotação que receberá uma nota posteriormente.</p>');
    const ann: AnnotationData = {
      id: 'a-dynamic',
      kind: 'hl',
      color: 'amarelo',
      quote: 'receberá',
      start: 9,
      end: 17,
      note: '',
    };

    apply(root, [ann]);
    let mark = root.querySelector('mark[data-aid="a-dynamic"]')!;
    expect(mark.className).not.toContain('has-note');

    // Usuário edita a anotação para adicionar uma nota e mudar para rosa
    ann.note = 'Nota adicionada';
    ann.color = 'rosa';
    decorate(root, ann);

    mark = root.querySelector('mark[data-aid="a-dynamic"]')!;
    expect(mark.className).toContain('has-note');
    expect(mark.className).toContain('c-rosa');
    expect(mark.className).toContain('end');
  });

  test('ignora nós SKIP como <script> e <style> dentro do root', () => {
    const root = getRoot(
      '<div>Texto antes <script>var x = 1;</script> e texto depois com palavra destacada.</div>'
    );
    const quote = 'palavra destacada';
    const start = root.textContent!.indexOf(quote);
    const ann: AnnotationData = {
      id: 'ann-skip',
      kind: 'hl',
      color: 'azul',
      quote,
      start,
      end: start + quote.length,
    };

    const orphans = apply(root, [ann]);
    expect(orphans).toHaveLength(0);
    expect(root.querySelector('script')!.querySelector('mark')).toBeNull();
  });
});
