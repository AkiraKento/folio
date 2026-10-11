import { isFieldEmpty, renderTemplate, stripHtml } from '../template';

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

    it('filtro desconhecido emite aviso no console e exibe o campo cru', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const template = '{{filtroCustom:Frente}}';
      const output = renderTemplate(template, {
        fields: { Frente: 'Valor do campo' },
      });
      expect(output).toBe('Valor do campo');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Filtro desconhecido: "filtroCustom"')
      );
      warnSpy.mockRestore();
    });
  });
});
