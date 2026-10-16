import { BUILTIN_NOTE_TYPES } from '../../db/builtin-note-types';
import { renderCard, renderCardSide } from '../card';

describe('renderCard & renderCardSide', () => {
  describe('Note Type Básico', () => {
    const fields = {
      Frente: 'O que é a síndrome de Wolff-Parkinson-White?',
      Verso: 'Uma síndrome de pré-excitação ventricular por via acessória.',
    };

    it('renderiza frente e verso com FrontSide e divisor hr', () => {
      const result = renderCard({
        noteType: BUILTIN_NOTE_TYPES.BASIC,
        fields,
        cardOrd: 0,
      });

      expect(result.front).toContain('<div class="main question-field" id="question">O que é a síndrome de Wolff-Parkinson-White?</div>');
      expect(result.back).toContain('O que é a síndrome de Wolff-Parkinson-White?');
      expect(result.back).toContain('<hr id="answer">');
      expect(result.back).toContain(
        '<div class="main answer-field" id="answer">Uma síndrome de pré-excitação ventricular por via acessória.</div>'
      );
    });

    it('renderiza lado isolado via renderCardSide', () => {
      const front = renderCardSide({
        noteType: BUILTIN_NOTE_TYPES.BASIC,
        fields,
        cardOrd: 0,
        side: 'front',
      });
      expect(front).toContain(fields.Frente);
      expect(front).toContain('class="main question-field"');

      const back = renderCardSide({
        noteType: BUILTIN_NOTE_TYPES.BASIC,
        fields,
        cardOrd: 0,
        side: 'back',
      });
      expect(back).toContain(fields.Frente);
      expect(back).toContain(fields.Verso);
      expect(back).toContain('class="main answer-field"');
    });
  });

  describe('Note Type Básico + Invertido', () => {
    const fields = {
      Frente: 'Bradicardia',
      Verso: 'Frequência cardíaca < 50 bpm',
    };

    it('renderiza Card 1 (ord 0: Frente -> Verso)', () => {
      const card0 = renderCard({
        noteType: BUILTIN_NOTE_TYPES.BASIC_REVERSED,
        fields,
        cardOrd: 0,
      });

      expect(card0.front).toContain('Bradicardia');
      expect(card0.front).toContain('class="main question-field"');
      expect(card0.back).toContain('Bradicardia');
      expect(card0.back).toContain('Frequência cardíaca < 50 bpm');
      expect(card0.back).toContain('class="main answer-field"');
    });

    it('renderiza Card 2 (ord 1: Verso -> Frente)', () => {
      const card1 = renderCard({
        noteType: BUILTIN_NOTE_TYPES.BASIC_REVERSED,
        fields,
        cardOrd: 1,
      });

      expect(card1.front).toContain('Frequência cardíaca < 50 bpm');
      expect(card1.front).toContain('class="main question-field"');
      expect(card1.back).toContain('Frequência cardíaca < 50 bpm');
      expect(card1.back).toContain('Bradicardia');
      expect(card1.back).toContain('class="main answer-field"');
    });
  });

  describe('Note Type Cloze', () => {
    const fields = {
      Texto:
        'A insuficiência cardíaca de fração de ejeção reduzida tem FEVE &le; {{c1::40%}} e responde aos 4 pilares: {{c2::IECA/BRA/INRA, BB, ARM e iSGLT2::quatro classes}}.',
      'Verso extra': 'Diretriz SBC de Insuficiência Cardíaca.',
    };

    it('renderiza card ord 0 (c1 ativo, c2 inativo)', () => {
      const result = renderCard({
        noteType: BUILTIN_NOTE_TYPES.CLOZE,
        fields,
        cardOrd: 0,
      });

      // Na frente: c1 com [...] e c2 revelado sem tags cloze
      expect(result.front).toContain('FEVE &le; <span class="cloze">[...]</span>');
      expect(result.front).toContain('responde aos 4 pilares: IECA/BRA/INRA, BB, ARM e iSGLT2.');

      // No verso: c1 com <span class="cloze">40%</span>, hr#answer e verso extra
      expect(result.back).toContain('FEVE &le; <span class="cloze">40%</span>');
      expect(result.back).toContain('<hr id="answer">');
      expect(result.back).toContain('Diretriz SBC de Insuficiência Cardíaca.');
    });

    it('renderiza card ord 1 (c2 ativo com dica, c1 inativo)', () => {
      const result = renderCard({
        noteType: BUILTIN_NOTE_TYPES.CLOZE,
        fields,
        cardOrd: 1,
      });

      // Na frente: c1 revelado, c2 com [quatro classes]
      expect(result.front).toContain('FEVE &le; 40%');
      expect(result.front).toContain(
        'responde aos 4 pilares: <span class="cloze">[quatro classes]</span>.'
      );

      // No verso: c2 com <span class="cloze">IECA/BRA/INRA, BB, ARM e iSGLT2</span>
      expect(result.back).toContain(
        'responde aos 4 pilares: <span class="cloze">IECA/BRA/INRA, BB, ARM e iSGLT2</span>.'
      );
      expect(result.back).toContain('Diretriz SBC de Insuficiência Cardíaca.');
    });

    it('renderiza no modo Consulta (allClozesRevealed = true) com todas as lacunas reveladas e destacadas', () => {
      const result = renderCard({
        noteType: BUILTIN_NOTE_TYPES.CLOZE,
        fields,
        cardOrd: 0,
        allClozesRevealed: true,
      });

      // Ambas as lacunas (c1 e c2) devem estar reveladas com <span class="cloze">
      expect(result.front).toContain('FEVE &le; <span class="cloze">40%</span>');
      expect(result.front).toContain(
        'responde aos 4 pilares: <span class="cloze">IECA/BRA/INRA, BB, ARM e iSGLT2</span>.'
      );
      expect(result.back).toContain('FEVE &le; <span class="cloze">40%</span>');
      expect(result.back).toContain(
        'responde aos 4 pilares: <span class="cloze">IECA/BRA/INRA, BB, ARM e iSGLT2</span>.'
      );
    });

    it('renderiza lado isolado no modo Consulta via renderCardSide', () => {
      const back = renderCardSide({
        noteType: BUILTIN_NOTE_TYPES.CLOZE,
        fields,
        cardOrd: 0,
        side: 'back',
        allClozesRevealed: true,
      });

      expect(back).toContain('FEVE &le; <span class="cloze">40%</span>');
      expect(back).toContain(
        'responde aos 4 pilares: <span class="cloze">IECA/BRA/INRA, BB, ARM e iSGLT2</span>.'
      );
    });
  });
});
