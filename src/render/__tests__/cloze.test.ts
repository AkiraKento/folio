import { extractClozeNumbers, processCloze, renderAllClozesRevealed } from '../cloze';

describe('processCloze', () => {
  describe('lado da frente (front)', () => {
    it('substitui a lacuna ativa sem dica por [...] envolto em span.cloze', () => {
      const input = 'A capital da França é {{c1::Paris}}.';
      const output = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(output).toBe('A capital da França é <span class="cloze">[...]</span>.');
    });

    it('substitui a lacuna ativa com dica por [dica] envolto em span.cloze', () => {
      const input = 'A capital da França é {{c1::Paris::cidade luz}}.';
      const output = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(output).toBe('A capital da França é <span class="cloze">[cidade luz]</span>.');
    });

    it('revela lacunas inativas como texto comum, sem dica e sem span', () => {
      const input = '{{c1::Paris::capital}} fica na {{c2::França::país}}.';
      const output = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(output).toBe('<span class="cloze">[capital]</span> fica na França.');
    });

    it('ativa múltiplas lacunas com o mesmo número cN simultaneamente', () => {
      const input = '{{c1::Paris}} é a capital e {{c1::França}} é o país.';
      const output = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(output).toBe(
        '<span class="cloze">[...]</span> é a capital e <span class="cloze">[...]</span> é o país.'
      );
    });

    it('suporta HTML dentro da resposta da lacuna na frente', () => {
      const input = 'Tome {{c1::<b>Aspirina</b>}} se tiver dor.';
      const output = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(output).toBe('Tome <span class="cloze">[...]</span> se tiver dor.');
    });
  });

  describe('lado do verso (back)', () => {
    it('substitui a lacuna ativa pelo texto original envolto em span.cloze (sem dica)', () => {
      const input = 'A capital da França é {{c1::Paris::cidade luz}}.';
      const output = processCloze(input, { side: 'back', targetClozeNumber: 1 });
      expect(output).toBe('A capital da França é <span class="cloze">Paris</span>.');
    });

    it('revela lacunas inativas como texto simples no verso', () => {
      const input = '{{c1::Paris}} fica na {{c2::França}}.';
      const output = processCloze(input, { side: 'back', targetClozeNumber: 1 });
      expect(output).toBe('<span class="cloze">Paris</span> fica na França.');
    });

    it('suporta HTML dentro da resposta no verso', () => {
      const input = 'Tome {{c1::<b>Aspirina</b> 100mg::medicamento}}.';
      const output = processCloze(input, { side: 'back', targetClozeNumber: 1 });
      expect(output).toBe('Tome <span class="cloze"><b>Aspirina</b> 100mg</span>.');
    });

    it('suporta clozes com quebras de linha (multilinha)', () => {
      const input = 'Tratamento:\n{{c1::Item 1\nItem 2\nItem 3}}';
      const output = processCloze(input, { side: 'back', targetClozeNumber: 1 });
      expect(output).toBe('Tratamento:\n<span class="cloze">Item 1\nItem 2\nItem 3</span>');
    });
  });

  describe('variante todas reveladas (allClozesRevealed / Modo Consulta)', () => {
    it('revela todas as lacunas c1, c2, c3 envolvidas em span.cloze', () => {
      const input = '{{c1::Paris::capital}} fica na {{c2::França::país}} na Europa {{c3::Ocidental}}.';
      const output = processCloze(input, {
        side: 'front',
        targetClozeNumber: 1,
        allClozesRevealed: true,
      });
      expect(output).toBe(
        '<span class="cloze">Paris</span> fica na <span class="cloze">França</span> na Europa <span class="cloze">Ocidental</span>.'
      );
    });

    it('função dedicada renderAllClozesRevealed revela todas as lacunas com span.cloze', () => {
      const input = '{{c1::Metformina}} e {{c2::iSGLT2::classe}} no DM2.';
      const output = renderAllClozesRevealed(input);
      expect(output).toBe(
        '<span class="cloze">Metformina</span> e <span class="cloze">iSGLT2</span> no DM2.'
      );
    });

    it('renderAllClozesRevealed preserva texto multilinha com HTML', () => {
      const input = 'Causas:\n1. {{c1::<b>Isquemia</b>}}\n2. {{c2::<i>Chagas</i>}}';
      const output = renderAllClozesRevealed(input);
      expect(output).toBe(
        'Causas:\n1. <span class="cloze"><b>Isquemia</b></span>\n2. <span class="cloze"><i>Chagas</i></span>'
      );
    });
  });

  describe('extractClozeNumbers', () => {
    it('extrai números únicos e ordenados de clozes no texto', () => {
      const input = '{{c2::dois}} {{c1::um}} {{c3::três}} {{c1::um de novo}}';
      expect(extractClozeNumbers(input)).toEqual([1, 2, 3]);
    });

    it('retorna array vazio para texto sem clozes', () => {
      expect(extractClozeNumbers('Texto sem cloze')).toEqual([]);
      expect(extractClozeNumbers('')).toEqual([]);
    });

    it('suporta clozes com quebras de linha e dicas', () => {
      const input = '{{c1::linha 1\nlinha 2::dica}} e {{c4::quatro}}';
      expect(extractClozeNumbers(input)).toEqual([1, 4]);
    });
  });

  describe('casos especiais de parsing', () => {
    it('trata dica vazia ou com apenas espaços como sem dica ([...])', () => {
      const input = '{{c1::resposta::   }}';
      const front = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      expect(front).toBe('<span class="cloze">[...]</span>');
    });

    it('suporta múltiplos :: no conteúdo da lacuna', () => {
      const input = 'Horário marcado: {{c1::10::30::hora}}.';
      const front = processCloze(input, { side: 'front', targetClozeNumber: 1 });
      const back = processCloze(input, { side: 'back', targetClozeNumber: 1 });
      expect(front).toBe('Horário marcado: <span class="cloze">[hora]</span>.');
      expect(back).toBe('Horário marcado: <span class="cloze">10::30</span>.');
    });

    it('mantém texto intacto se não houver clozes', () => {
      const input = 'Texto sem nenhuma lacuna.';
      expect(processCloze(input, { side: 'front', targetClozeNumber: 1 })).toBe(input);
    });
  });
});
