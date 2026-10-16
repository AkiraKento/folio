import { isFieldEmpty, renderTemplate, resetUnknownFilterWarnings, stripHtml } from '../template';


describe('stripHtml & isFieldEmpty', () => {
  it('remove tags html e decodifica entidades comuns', () => {
    expect(stripHtml('<p>Olá <b>Mundo</b>!</p>')).toBe('Olá Mundo!');
    expect(stripHtml('&quot;Tom &amp; Jerry&quot; &lt;3')).toBe('"Tom & Jerry" <3');
    expect(stripHtml('Linha 1<br>Linha 2')).toBe('Linha 1 Linha 2');
  });

  it('identifica campos vazios corretamente', () => {
    expect(isFieldEmpty(undefined)).toBe(true);
    expect(isFieldEmpty('')).toBe(true);
    expect(isFieldEmpty('    \n\t  ')).toBe(true);
    expect(isFieldEmpty('<p></p>')).toBe(true);
    expect(isFieldEmpty('<div><br></div>')).toBe(true);
    expect(isFieldEmpty('&nbsp;   &nbsp;')).toBe(true);
  });

  it('reconhece campos com texto ou mídia como não-vazios', () => {
    expect(isFieldEmpty('Texto simples')).toBe(false);
    expect(isFieldEmpty('<p>Conteúdo</p>')).toBe(false);
    expect(isFieldEmpty('<img src="imagem.png" />')).toBe(false);
    expect(isFieldEmpty('<div><img src="coracao.svg"></div>')).toBe(false);
  });
});

describe('renderTemplate', () => {
  describe('substituição de campos simples', () => {
    it('substitui campo exato', () => {
      const template = '<h1>{{Frente}}</h1>';
      const output = renderTemplate(template, {
        fields: { Frente: 'Qual o diagnóstico?' },
      });
      expect(output).toBe('<h1>Qual o diagnóstico?</h1>');
    });

    it('suporta espaços dentro das tags e formato com três chaves', () => {
      const template = '{{ Frente }} - {{{ Frente }}}';
      const output = renderTemplate(template, {
        fields: { Frente: 'Teste' },
      });
      expect(output).toBe('Teste - Teste');
    });

    it('suporta nomes de campos com espaços e acentos', () => {
      const template = 'Extra: {{Verso extra}} | Obs: {{Observações médicas}}';
      const output = renderTemplate(template, {
        fields: {
          'Verso extra': 'Mais detalhes',
          'Observações médicas': 'Atenção à dose',
        },
      });
      expect(output).toBe('Extra: Mais detalhes | Obs: Atenção à dose');
    });

    it('substitui campos inexistentes por string vazia', () => {
      const template = 'Antes [{{Inexistente}}] Depois';
      const output = renderTemplate(template, {
        fields: { Frente: 'Algo' },
      });
      expect(output).toBe('Antes [] Depois');
    });
  });

  describe('campos especiais (Tags, Deck, Subdeck, Card, FrontSide)', () => {
    it('renderiza {{Tags}} unidas por espaço', () => {
      const template = '<div class="tags">{{Tags}}</div>';
      const output = renderTemplate(template, {
        fields: {},
        tags: ['medicina', 'cardiologia', 'ic'],
      });
      expect(output).toBe('<div class="tags">medicina cardiologia ic</div>');
    });

    it('renderiza {{Deck}} e {{Subdeck}}', () => {
      const template = '{{Deck}} / {{Subdeck}}';
      const output = renderTemplate(template, {
        fields: {},
        deckName: 'Medicina::Cardiologia::Arritmias',
      });
      expect(output).toBe('Medicina::Cardiologia::Arritmias / Arritmias');
    });

    it('renderiza {{Card}} com o nome do template', () => {
      const template = '<span>{{Card}}</span>';
      const output = renderTemplate(template, {
        fields: {},
        cardName: 'Card 1 (Invertido)',
      });
      expect(output).toBe('<span>Card 1 (Invertido)</span>');
    });

    it('renderiza {{FrontSide}} no verso com o frontHtml fornecido', () => {
      const template = '{{FrontSide}}\n<hr>\n{{Verso}}';
      const output = renderTemplate(template, {
        fields: { Verso: 'Resposta final' },
        side: 'back',
        frontHtml: '<b>Pergunta na frente</b>',
      });
      expect(output).toBe('<b>Pergunta na frente</b>\n<hr>\nResposta final');
    });

    it('substitui {{FrontSide}} por vazio se chamado na frente', () => {
      const template = '{{FrontSide}} Frente';
      const output = renderTemplate(template, {
        fields: {},
        side: 'front',
      });
      expect(output).toBe(' Frente');
    });
  });

  describe('condicionais {{#Campo}} e {{^Campo}}', () => {
    it('renderiza bloco {{#Campo}} apenas quando o campo tem conteúdo', () => {
      const template = '{{#Verso}}<div class="res">{{Verso}}</div>{{/Verso}}';
      const comConteudo = renderTemplate(template, {
        fields: { Verso: 'Tem resposta' },
      });
      expect(comConteudo).toBe('<div class="res">Tem resposta</div>');

      const semConteudo = renderTemplate(template, {
        fields: { Verso: '   ' },
      });
      expect(semConteudo).toBe('');

      const comHtmlVazio = renderTemplate(template, {
        fields: { Verso: '<p><br></p>' },
      });
      expect(comHtmlVazio).toBe('');
    });

    it('renderiza bloco invertido {{^Campo}} apenas quando o campo é vazio ou inexistente', () => {
      const template = '{{^Dica}}<span class="sem-dica">Sem dica disponível</span>{{/Dica}}';
      const vazio = renderTemplate(template, {
        fields: { Dica: '' },
      });
      expect(vazio).toBe('<span class="sem-dica">Sem dica disponível</span>');

      const preenchido = renderTemplate(template, {
        fields: { Dica: 'A dica é X' },
      });
      expect(preenchido).toBe('');
    });

    it('suporta condicionais aninhadas', () => {
      const template = `{{#A}}A-start:{{#B}}B-dentro:{{B}}{{/B}}:A-end{{/A}}`;
      const outputAmbos = renderTemplate(template, {
        fields: { A: 'sim', B: 'ok' },
      });
      expect(outputAmbos).toBe('A-start:B-dentro:ok:A-end');

      const outputApenasA = renderTemplate(template, {
        fields: { A: 'sim', B: '' },
      });
      expect(outputApenasA).toBe('A-start::A-end');

      const outputNenhum = renderTemplate(template, {
        fields: { A: '', B: 'ok' },
      });
      expect(outputNenhum).toBe('');
    });

    it('suporta condicionais sobre campos especiais como {{#Tags}}', () => {
      const template = '{{#Tags}}<p>Tags: {{Tags}}</p>{{/Tags}}';
      const comTags = renderTemplate(template, {
        fields: {},
        tags: ['cirurgia'],
      });
      expect(comTags).toBe('<p>Tags: cirurgia</p>');

      const semTags = renderTemplate(template, {
        fields: {},
        tags: [],
      });
      expect(semTags).toBe('');
    });
  });

  describe('filtros (hint:, text:, type:, cloze: e desconhecidos)', () => {
    it('filtro hint: gera elemento details expansível quando há conteúdo', () => {
      const template = '{{hint:Observacao}}';
      const output = renderTemplate(template, {
        fields: { Observacao: 'Tomar com água' },
      });
      expect(output).toContain('<details class="hint">');
      expect(output).toContain('<summary class="hint-label">Mostrar dica: Observacao</summary>');
      expect(output).toContain('<div class="hint-content">Tomar com água</div>');
    });

    it('filtro hint: retorna vazio quando o campo for vazio', () => {
      const template = '{{hint:Observacao}}';
      const output = renderTemplate(template, {
        fields: { Observacao: '' },
      });
      expect(output).toBe('');
    });

    it('filtro text: remove tags html do campo', () => {
      const template = 'Puro: {{text:Formatado}}';
      const output = renderTemplate(template, {
        fields: { Formatado: '<b>Negrito</b> &amp; <i>itálico</i>' },
      });
      expect(output).toBe('Puro: Negrito & itálico');
    });

    it('filtro type: exibe o campo sem campos de digitação (MVP)', () => {
      const template = 'Digite: {{type:Resposta}}';
      const output = renderTemplate(template, {
        fields: { Resposta: 'Penicilina' },
      });
      expect(output).toBe('Digite: Penicilina');
    });

    it('filtro cloze: aplica o processador de cloze na frente e no verso', () => {
      const templateFront = '{{cloze:Texto}}';
      const frontOutput = renderTemplate(templateFront, {
        fields: { Texto: 'Tratamento: {{c1::AAS}} e {{c2::Estadual}}' },
        side: 'front',
        cardOrd: 0,
        clozeNumber: 1,
      });
      expect(frontOutput).toBe('Tratamento: <span class="cloze">[...]</span> e Estadual');

      const templateBack = '{{cloze:Texto}}';
      const backOutput = renderTemplate(templateBack, {
        fields: { Texto: 'Tratamento: {{c1::AAS}} e {{c2::Estadual}}' },
        side: 'back',
        cardOrd: 0,
        clozeNumber: 1,
      });
      expect(backOutput).toBe('Tratamento: <span class="cloze">AAS</span> e Estadual');
    });

    it('encadeamento de filtros avalia da direita para a esquerda', () => {
      const template = '{{text:cloze:Texto}}';
      const output = renderTemplate(template, {
        fields: { Texto: 'Tratar com {{c1::<b>Heparina</b>}}.' },
        side: 'back',
        clozeNumber: 1,
      });
      // cloze vira <span class="cloze"><b>Heparina</b></span>, depois text remove tags
      expect(output).toBe('Tratar com Heparina.');
    });

    it('filtro desconhecido emite UM aviso por modelo no console/log e exibe o campo cru', () => {
      resetUnknownFilterWarnings();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const template = '{{filtroCustom:Frente}}';

      const output1 = renderTemplate(template, {
        fields: { Frente: 'Valor 1' },
        modelName: 'ModeloTeste',
      });
      const output2 = renderTemplate(template, {
        fields: { Frente: 'Valor 2' },
        modelName: 'ModeloTeste',
      });

      expect(output1).toBe('Valor 1');
      expect(output2).toBe('Valor 2');
      // Deve emitir apenas 1 aviso para o mesmo modelo, mesmo renderizando 2 cards
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Filtro desconhecido: "filtroCustom"')
      );
      warnSpy.mockRestore();
    });

    it('suporta edit:, edit:cloze:, clickable::Tags, cloze-only:, tts e [sound:...] sem warnings', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const outEdit = renderTemplate(
        '<div>{{edit:question}}</div> | <div>{{edit:cloze:Text}}</div> | <div id="tags">{{clickable::Tags}}</div> | {{cloze-only:Text}} | {{tts en_US voices=Apple_Samantha:cloze:Text}}',
        {
          fields: {
            question: 'Pergunta [sound:audio1.mp3] limpa',
            Text: 'Lacuna {{c1::ativa}}',
          },
          tags: ['Assunto::Cirurgia', 'origem::Osler'],
          side: 'front',
          clozeNumber: 1,
        }
      );

      expect(warnSpy).not.toHaveBeenCalled();
      expect(outEdit).toContain('<div>Pergunta  limpa</div>');
      expect(outEdit).toContain('<div>Lacuna <span class="cloze">[...]</span></div>');
      expect(outEdit).toContain('<div id="tags">Assunto::Cirurgia origem::Osler</div>');
      expect(outEdit).not.toContain('audio1.mp3');
      warnSpy.mockRestore();
    });

    it('filtro weiss-tags: converte tags em spans .tag-pill sem necessidade de scripts (M10 Passo 9)', () => {
      const template = '<div class="tags-container">{{weiss-tags:Tags}}</div>';

      // 1. Com lista de tags
      const outputWithTags = renderTemplate(template, {
        fields: {},
        tags: ['Cardiologia::Arritmias', 'urgencia'],
      });
      expect(outputWithTags).toBe(
        '<div class="tags-container"><span class="tag-pill">Cardiologia::Arritmias</span> <span class="tag-pill">urgencia</span></div>'
      );

      // 2. Sem tags (deve resultar em tags-container vazio)
      const outputEmpty = renderTemplate(template, {
        fields: {},
        tags: [],
      });
      expect(outputEmpty).toBe('<div class="tags-container"></div>');

      // 3. Dentro de condicional {{#Tags}}
      const templateConditional =
        '{{#Tags}}<div class="tags-container">{{weiss-tags:Tags}}</div>{{/Tags}}';
      const outputConditional = renderTemplate(templateConditional, {
        fields: {},
        tags: ['Pediatria'],
      });
      expect(outputConditional).toBe(
        '<div class="tags-container"><span class="tag-pill">Pediatria</span></div>'
      );

      const outputNoTagsConditional = renderTemplate(templateConditional, {
        fields: {},
        tags: [],
      });
      expect(outputNoTagsConditional).toBe('');
    });

    it('renderiza as fixtures avicena e AnKing preservando scripts do template e removendo <script> malicioso de dentro de um campo', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AVICENA_FIXTURE, ANKING_FIXTURE } = require('../../webview/card/__fixtures__');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { renderCard } = require('../card');

      const avicenaResult = renderCard({
        noteType: AVICENA_FIXTURE.toNoteType(),
        fields: {
          ...AVICENA_FIXTURE.example.fields,
          question:
            AVICENA_FIXTURE.example.fields.question +
            '<script>window.__HACKED_FIELD__ = true;</script><img src="x" onerror="alert(1)">',
        },
        cardOrd: 0,
        tags: AVICENA_FIXTURE.example.tags,
      });

      expect(avicenaResult.front).toContain('class="main question-field"');
      expect(avicenaResult.front).toContain('<script>');
      expect(avicenaResult.front).toContain('document.querySelectorAll(".tags-container")');
      expect(avicenaResult.front).not.toContain('__HACKED_FIELD__');
      expect(avicenaResult.front).not.toContain('onerror=');

      const ankingResult = renderCard({
        noteType: ANKING_FIXTURE.toNoteType(),
        fields: ANKING_FIXTURE.example.fields,
        cardOrd: 0,
        tags: ANKING_FIXTURE.example.tags,
      });

      expect(ankingResult.front).toContain('<div id="text">');
      expect(ankingResult.front).toContain('<span class="cloze">[Dica de exemplo]</span>');
      expect(ankingResult.back).toContain('<div id="tags-container">1°semestre Fisio UNESP2027-CB::Circulatorio</div>');
    });
  });
});

