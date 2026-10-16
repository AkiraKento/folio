import { JSDOM } from 'jsdom';
import { renderCard } from '@/render/card';
import { AVICENA_FIXTURE, ANKING_FIXTURE } from '../__fixtures__';
import { buildAnkiDocument } from '../ankiDocument';

describe('M10 Passo 4 — Scripts do template e shims do Anki', () => {
  it('fixture avicena executa os scripts do template no jsdom e gera .tag-pill igual ao número de tags', async () => {
    const noteType = AVICENA_FIXTURE.toNoteType();
    const example = AVICENA_FIXTURE.example;

    const rendered = renderCard({
      noteType,
      fields: example.fields,
      cardOrd: example.cardOrd ?? 0,
      tags: example.tags,
      deckName: 'Clínica::Cardiologia',
    });

    const docHtml = buildAnkiDocument({
      html: rendered.back,
      side: 'back',
      theme: 'light',
      css: noteType.css ?? '',
      isBuiltinModel: false,
      cardId: 'card-avicena-1',
      noteId: 'note-avicena-1',
      cardOrd: example.cardOrd ?? 0,
      fields: example.fields,
      tags: example.tags,
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
      url: 'file:///media/',
    });

    // O script do avicena gera 1 .tag-pill para cada tag sincronamente e, após 100ms, #reload-imgs-btn se houver imagem
    const tagPillsBeforeTimeout = dom.window.document.querySelectorAll('.tag-pill');
    expect(tagPillsBeforeTimeout.length).toBe(example.tags.length);
    expect(Array.from(tagPillsBeforeTimeout).map((el) => el.textContent)).toEqual(example.tags);

    await new Promise((resolve) => setTimeout(resolve, 160));

    const tagPills = dom.window.document.querySelectorAll('.tag-pill:not(#reload-imgs-btn)');
    expect(tagPills.length).toBe(example.tags.length);
    expect(dom.window.document.getElementById('reload-imgs-btn')).not.toBeNull();

    dom.window.close();
  });

  it('fixture AnKing gera os <kbd> das tags e, com "One by one" = ".", mostra os botões Reveal Next / Toggle All', async () => {
    const noteType = ANKING_FIXTURE.toNoteType();
    const example = ANKING_FIXTURE.example; // One by one = "."

    const rendered = renderCard({
      noteType,
      fields: example.fields,
      cardOrd: example.cardOrd ?? 0,
      tags: example.tags,
      deckName: 'Medicina::Cardiologia',
    });

    const docHtml = buildAnkiDocument({
      html: rendered.back,
      side: 'back',
      theme: 'light',
      css: noteType.css ?? '',
      isBuiltinModel: false,
      cardId: 'card-anking-1',
      noteId: 'note-anking-1',
      cardOrd: example.cardOrd ?? 0,
      fields: example.fields,
      tags: example.tags,
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
      url: 'file:///media/',
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    // Verifica <kbd> gerados para cada tag em #tags-container
    const kbdTags = dom.window.document.querySelectorAll('#tags-container kbd');
    expect(kbdTags.length).toBe(example.tags.length);

    // Verifica botões do One by one (Reveal Next e Toggle All) visíveis no verso
    const revealNextBtn = dom.window.document.getElementById('button-reveal-next');
    const toggleAllBtn = dom.window.document.getElementById('button-toggle-all');
    expect(revealNextBtn).not.toBeNull();
    expect(toggleAllBtn).not.toBeNull();
    expect(revealNextBtn?.hasAttribute('hidden')).toBe(false);
    expect(toggleAllBtn?.hasAttribute('hidden')).toBe(false);

    dom.window.close();
  });

  it('intercepta AnkiConnect local (127.0.0.1:8765) para guiCurrentCard, cardsInfo e updateNoteFields apenas da nota atual', async () => {
    const outboundMessages: Array<{ type: string; payload?: unknown }> = [];

    const docHtml = buildAnkiDocument({
      html: '<div class="main">Teste AnkiConnect</div>',
      side: 'back',
      theme: 'light',
      css: '',
      isBuiltinModel: true,
      cardId: 'card-123',
      noteId: 'note-456',
      cardOrd: 0,
      fields: {
        Text: 'Conteúdo original',
        'Personal Notes': '',
      },
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
      url: 'file:///media/',
    });

    dom.window.ReactNativeWebView = {
      postMessage: (raw: string) => {
        outboundMessages.push(JSON.parse(raw));
      },
    };

    // 1. guiCurrentCard
    const currentCardRes = await dom.window.fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({ action: 'guiCurrentCard', version: 6 }),
    });
    const currentCardJson = await currentCardRes.json();
    expect(currentCardJson).toEqual({
      result: { cardId: 'card-123' },
      error: null,
    });

    // 2. cardsInfo do card atual
    const cardsInfoRes = await dom.window.fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({
        action: 'cardsInfo',
        version: 6,
        params: { cards: ['card-123'] },
      }),
    });
    const cardsInfoJson = await cardsInfoRes.json();
    expect(cardsInfoJson.error).toBeNull();
    expect(cardsInfoJson.result[0].note).toBe('note-456');

    // 3. updateNoteFields na nota atual -> permitido e enviado ao RN
    const updateOwnRes = await dom.window.fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateNoteFields',
        version: 6,
        params: {
          note: {
            id: 'note-456',
            fields: {
              'Personal Notes': 'Minha anotação pessoal no AnKing',
            },
          },
        },
      }),
    });
    const updateOwnJson = await updateOwnRes.json();
    expect(updateOwnJson).toEqual({ result: null, error: null });
    expect(outboundMessages).toContainEqual({
      type: 'updateNoteFields',
      payload: {
        noteId: 'note-456',
        fields: { 'Personal Notes': 'Minha anotação pessoal no AnKing' },
      },
    });

    // 4. updateNoteFields em OUTRA nota -> bloqueado e NÃO enviado ao RN
    const msgCountBefore = outboundMessages.length;
    const updateOtherRes = await dom.window.fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateNoteFields',
        version: 6,
        params: {
          note: {
            id: 'note-999-outra',
            fields: {
              'Personal Notes': 'Tentativa indevida',
            },
          },
        },
      }),
    });
    const updateOtherJson = await updateOtherRes.json();
    expect(updateOtherJson.error).toContain('não suportado no Weiss');
    expect(outboundMessages.length).toBe(msgCountBefore);

    // 5. Outra ação qualquer do AnkiConnect -> erro "não suportado no Weiss"
    const unsupportedRes = await dom.window.fetch('http://127.0.0.1:8765', {
      method: 'POST',
      body: JSON.stringify({
        action: 'deleteNotes',
        version: 6,
        params: { notes: ['note-456'] },
      }),
    });
    const unsupportedJson = await unsupportedRes.json();
    expect(unsupportedJson).toEqual({
      result: null,
      error: 'não suportado no Weiss',
    });

    dom.window.close();
  });

  it('isola erro de um <script> quebrado no template, envia para o log e executa o próximo <script>', () => {
    const outboundMessages: Array<{ type: string; payload?: { message?: string } }> = [];

    const docHtml = buildAnkiDocument({
      html: `
        <div id="alvo">Inicial</div>
        <script>
          throw new Error("Erro proposital no script 1");
        </script>
        <script>
          document.getElementById("alvo").textContent = "Script 2 executou com sucesso";
        </script>
      `,
      side: 'front',
      theme: 'light',
      css: '',
      isBuiltinModel: true,
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
    });

    // Verifica que o segundo script não foi interrompido pelo erro do primeiro
    expect(dom.window.document.getElementById('alvo')?.textContent).toBe(
      'Script 2 executou com sucesso'
    );

    // Verifica também captura com ReactNativeWebView conectado
    dom.window.ReactNativeWebView = {
      postMessage: (raw: string) => {
        outboundMessages.push(JSON.parse(raw));
      },
    };
    dom.window.__weissLogScriptError?.(new Error('Falha de teste'));
    expect(outboundMessages.some((m) => m.type === 'scriptError')).toBe(true);

    dom.window.close();
  });

  it('bloqueia qualquer requisição fetch externa (ex: Wikipédia) e registra scriptError', async () => {
    const outboundMessages: Array<{ type: string; payload?: { message?: string } }> = [];

    const docHtml = buildAnkiDocument({
      html: '<div>Card sem rede</div>',
      side: 'back',
      theme: 'light',
      css: '',
      isBuiltinModel: true,
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
    });

    dom.window.ReactNativeWebView = {
      postMessage: (raw: string) => {
        outboundMessages.push(JSON.parse(raw));
      },
    };

    await expect(
      dom.window.fetch('https://en.wikipedia.org/api/rest_v1/page/summary/Heart')
    ).rejects.toThrow('Requisição de rede bloqueada pelo Weiss');

    expect(
      outboundMessages.some(
        (m) =>
          m.type === 'scriptError' &&
          m.payload?.message?.includes('Bloqueada requisição fetch externa')
      )
    ).toBe(true);

    dom.window.close();
  });

  it('remove os <script> do template quando executeModelScripts === false', () => {
    const docHtml = buildAnkiDocument({
      html: '<div id="box">Original</div><script>document.getElementById("box").textContent = "Alterado";</script>',
      side: 'front',
      theme: 'light',
      css: '',
      isBuiltinModel: true,
      executeModelScripts: false,
    });

    const dom = new JSDOM(docHtml, {
      runScripts: 'dangerously',
    });

    expect(dom.window.document.getElementById('box')?.textContent).toBe('Original');
    dom.window.close();
  });
});
