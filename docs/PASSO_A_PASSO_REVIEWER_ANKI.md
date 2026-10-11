# Passo a passo: reviewer fiel aos modelos do Anki (Avicena e AnKing)

11/10/2026 · executar como **M10** do `ROADMAP.md`, **depois** dos itens P0-3 (imagens) e P0-5 (log de erros) do M9.

## Objetivo

Na revisão, um card importado deve ter **a mesma aparência que tem no Anki**: o "cartão com profundidade" (fundo do app, caixa clara ou escura com cantos de 12 px, sombra suave, fonte Lato, tags em pílulas coloridas, cloze azul, referência em verde à direita), nos temas claro e escuro. Os modelos de referência são os do Akira:

| modelo | notas no Anki dele | onde está a "profundidade" |
|---|---|---|
| `avicena` (padrão, 3 campos: question / answer / reference) | ~29 mil, quase todos os decks da Osler | cada campo fica numa caixa `.main` (fundo `#f0f4f0` / `#042124`, raio 12, padding 20, `box-shadow`) sobre o fundo do `.card` (`#e4ebe4` / `#021012`) |
| `AnKing` (cloze, 5 campos: Text / Extra / Personal Notes / Missed Questions / One by one) | ~3 mil | o próprio `.card` vira a caixa (fundo `#f0f4f0`, raio 12, sombra) sobre o fundo do `html` (`#e4ebe4`) |

Templates, CSS e uma nota de exemplo de cada modelo estão em `docs/referencia/modelos/{avicena,anking}/`, exportados da coleção real do Akira. **Use esses arquivos como fixtures dos testes.** As notas `exemplo.json` são sintéticas, mas têm a mesma estrutura HTML das reais.

## Por que hoje não fica igual (diagnóstico)

1. `src/webview/card/renderer.ts` monta `<div class="card-root"><div class="card">…`, e `css-scope.ts` reescreve o CSS do modelo para `.card-root …`. Regras de `html`, `body`, `.card` e `.nightMode.card` deixam de casar como no Anki.
2. O modo escuro do Weiss usa `.theme-dark`, mas os modelos esperam `nightMode` / `night_mode` / `night-mode` (a classe `nightMode` no mesmo elemento que `.card`, e `night_mode` num ancestral).
3. `BASE_CARD_STYLES` (`styles.ts`) aplica o visual do Weiss **por cima** do modelo (fundo, imagens, tabelas, cloze).
4. O DOMPurify roda sobre o HTML **final**, então remove os `<script>` do template. No Avicena isso apaga as tags em pílula e o zoom de imagem; no AnKing, as pílulas, o cloze um por um, os botões de dica e o bloco de notas.
5. A fonte Lato vem por `@import` do Google Fonts: offline, cai para Arial.
6. A tela de revisão envolve a WebView com cor e espaçamento do próprio Weiss, o que cria uma "moldura" que não existe no Anki.

## Regras deste trabalho

- **Fidelidade primeiro:** para modelos importados, o Weiss **não** acrescenta estilo próprio ao conteúdo do card. Só entram a camada de grifos da Consulta, o balão de nota e o zoom de imagem (ver Passo 5).
- O HTML dos **campos** continua sanitizado. Os **scripts do template** do modelo rodam (o template é do próprio usuário). Ajustes → "Executar scripts dos modelos" vem **ligado** e pode ser desligado.
- Nada sai do aparelho: imports remotos de CSS e chamadas de rede dos scripts são bloqueados ou trocados por equivalentes locais.

---

## Passo 1 — Fixtures e "Laboratório de cards"

1. Criar `src/webview/card/__fixtures__/` que lê `docs/referencia/modelos/*/` (templates, CSS, `model.json`, `exemplo.json`). Copiar uma imagem PNG qualquer como `exemplo-avicena.png` para a pasta de mídia de teste.
2. Criar uma tela escondida **Ajustes → Desenvolvedor → Laboratório de cards** (só aparece com 7 toques na versão do app):
   - lista os modelos existentes no banco + os dois de fixture;
   - para cada um: frente/verso × claro/escuro, renderizados com o mesmo componente da revisão;
   - botão "Abrir nota real aleatória deste modelo".
3. **Pronto quando** o laboratório mostra as fixtures (ainda com o visual atual errado). Ele vai servir para comparar cada passo.

## Passo 2 — Documento no formato do Anki (substitui o `.card-root`)

1. Criar `src/webview/card/ankiDocument.ts`, que monta **um documento HTML completo por lado do card**, igual ao AnkiDroid:

```html
<!doctype html>
<html class="mobile android js {NM_HTML}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style id="weiss-reset">/* só: html,body{margin:0;padding:0} e -webkit-text-size-adjust:100% */</style>
  <style id="weiss-fonts">/* @font-face locais (Passo 6) */</style>
  <style id="note-css">/* CSS do modelo, SEM escopo, com imports remotos tratados */</style>
  <style id="weiss-overlay">/* grifos, balão de nota, zoom, ocultações de compatibilidade */</style>
  <script>/* shims do Anki (Passo 4), ANTES do conteúdo */</script>
</head>
<body class="card card{ORD+1} {NM_BODY}">
  <div id="qa">{HTML DO LADO, com os <script> do template}</div>
  <script>/* runtime do Weiss (Passo 5), DEPOIS do conteúdo */</script>
</body>
</html>
```

   - Escuro: `NM_HTML = "nightMode night_mode night-mode"` e `NM_BODY = "nightMode night_mode night-mode"`. Claro: os dois vazios. Isso cobre `.nightMode.card`, `.night_mode .card`, `.night-mode .card` e `html.nightMode`, usados nos CSS do Akira.
2. **Apagar o uso de `scopeCss`** para modelos importados. O CSS entra cru.
3. `BASE_CARD_STYLES` passa a valer **só** para os modelos embutidos do Weiss (Passo 8) ou para modelos com CSS vazio.
4. `CardView` / `ReviewView`: cada lado carrega um documento novo com `source={{ html: doc, baseUrl: <pasta de mídia> }}` (a `baseUrl` do P0-3 faz `src="exemplo.png"` e `_AnKingIconSmall.png` funcionarem). `originWhitelist` restrito como no P2-4.
5. **Testes (jsdom):** o documento gerado tem as classes certas em `html` e `body`, o CSS do modelo aparece sem `.card-root`, e há exatamente um `#qa`.
6. **Pronto quando**, no laboratório, a fixture avicena mostra as caixas `.main` com sombra, nos dois temas, e a AnKing mostra o `.card` como caixa sobre o fundo `#e4ebe4`.

## Passo 3 — Filtros e campos especiais do template

Em `src/render/filters.ts` e `template.ts`:

| no template | comportamento |
|---|---|
| `{{edit:Campo}}`, `{{edit:cloze:Campo}}` | ignora `edit:` e aplica o resto (é do add-on Edit Field During Review). Sem warning. |
| `{{clickable::Tags}}` / `{{clickable:Tags}}` | devolve as tags separadas por espaço (o script do AnKing transforma em `<kbd>`). |
| `{{Tags}}` | tags separadas por espaço, com `::` preservado. |
| `{{cloze-only:Campo}}`, `{{tts …}}`, `[sound:…]` | removidos da saída (sem áudio no MVP). |
| comentários `<!-- -->` | preservados (inofensivos). |
| filtros desconhecidos | valor cru, **um** aviso por modelo no log (não a cada card). |

- O `Card`, `Deck`, `Subdeck` e `CardFlag` já existem e continuam iguais.
- **Sanitizar os campos antes da substituição**, não o HTML final: cada valor de campo passa pelo DOMPurify (sem `script`, `on*`, `javascript:`) e só então entra no template. O texto do template (com os scripts) fica intacto.
- **Testes:** renderizar as duas fixtures; o resultado do avicena contém `class="main question-field"` e os `<script>` do template; um `<script>` colocado de propósito dentro de um **campo** é removido.

## Passo 4 — Scripts do template e shims do Anki

1. Os `<script>` do template rodam na ordem em que aparecem, como no Anki. Cada um vai num `try/catch`, com erros mandados ao log do Weiss (P0-5). Um script quebrado nunca derruba a revisão.
2. `<script src="_arquivo.js">` carrega da pasta de mídia. Se não existir, só gera log.
3. Shims definidos **antes** do conteúdo:
   - `window.pycmd = function(){}` e `window.bridgeCommand = window.pycmd`;
   - `window.onUpdateHook = []` e `window.onShownHook = []`; o runtime chama os `onShownHook` depois de montar;
   - `window.AnkiDroidJS` mínimo (`ankiGetCardType`, `ankiIsInNightMode`, `ankiGetCardId` etc.), retornando valores coerentes com o card atual;
   - **AnkiConnect local:** interceptar `fetch` para `http://127.0.0.1:8765` e responder pela ponte do Weiss, só para estas ações e **só para o card/nota atual**:
     - `guiCurrentCard` → `{ result: { cardId } }`
     - `cardsInfo` → `{ result: [{ cardId, note: noteId }] }`
     - `updateNoteFields` → grava os campos na nota atual (o "Bloco de Notas" do AnKing salva em `Personal Notes`) e responde `{ result: null, error: null }`
     - qualquer outra ação → `{ result: null, error: "não suportado no Weiss" }`
   - qualquer outra requisição de rede vinda do card é bloqueada e registrada em log. O pop-up da Wikipédia do AnKing deixa de funcionar offline, e isso é aceito.
4. `localStorage` e `sessionStorage` ficam ligados (`domStorageEnabled`): a `Persistence` do AnKing (frente → verso) depende disso. Testar que o "um por um" mantém o estado ao virar o card.
5. Ajustes → "Executar scripts dos modelos" (padrão ligado). Desligado, os `<script>` do template são removidos.
6. CSS de compatibilidade em `weiss-overlay`: esconder `#pic` (link do ícone AnKing, que abre site externo). **Não** esconder o bloco de notas: ele funciona via shim.
7. **Testes:** no jsdom com `runScripts: "dangerously"`, a fixture avicena gera `.tag-pill` igual ao número de tags; a fixture AnKing gera os `<kbd>` das tags e, com "One by one" = `.`, mostra os botões *Reveal Next* / *Toggle All*; um `updateNoteFields` via `fetch` altera só a nota atual.

## Passo 5 — Runtime do Weiss dentro do documento

Script injetado **depois** do conteúdo:

1. **Grifos da Consulta no verso:** aplicar `anchor.apply()` sobre `#qa`, **depois** que os scripts do template terminarem (o avicena usa `setTimeout(…, 100)`): esperar 2 `requestAnimationFrame` + 150 ms e um `MutationObserver` quieto por 100 ms, nessa ordem. Ignorar como texto âncora os nós de `.tags-container`, `#tags-container`, `.notepad-wrapper` e botões, para que pílulas e botões não desloquem as posições.
2. Balão da nota ao tocar num grifo (o código atual, só que movido para cá).
3. Links: interceptar e mandar para o RN (comportamento atual).
4. **Zoom de imagem:** se a imagem já tem `.zoom-enabled` (o avicena faz isso), não mexer. Senão, toque duplo abre um overlay com pinça para zoom e arrastar.
5. Mandar ao RN: `ready`, a **cor de fundo efetiva** (`getComputedStyle(document.body).backgroundColor`, ou a do `html` se a do body for transparente) e a altura.
6. **Teste:** um grifo criado na Consulta numa nota avicena aparece no verso da revisão no trecho certo, com as pílulas de tag presentes.

## Passo 6 — Fonte Lato offline

1. Incluir Lato 400, 700, 400 itálico e 700 itálico (licença OFL) no pacote da WebView, como `@font-face` em `weiss-fonts`.
2. No CSS do modelo, trocar `@import url(…fonts.googleapis.com…family=Lato…)` por nada (a fonte já está local). Outros `@import` remotos são removidos e registrados em log.
3. **Pronto quando**, em modo avião, o texto do avicena sai em Lato (conferir a letra "g" no laboratório).

## Passo 7 — A tela de revisão sem moldura

Em `ReviewView.tsx`:

1. A WebView ocupa toda a área entre a barra superior e a barra de respostas, **sem padding nem fundo próprio** em volta.
2. O fundo do container RN, da barra de status e das barras superior e inferior usa a **cor de fundo recebida no Passo 5**, com transição de 150 ms. Assim não aparece emenda entre o app e o card.
3. A barra de respostas fica flutuante, com fundo da mesma cor a 92% de opacidade e uma sombra sutil para cima. O documento recebe `padding-bottom` igual à altura dela, para o fim do verso não ficar escondido.
4. Trocar de frente para verso com fade de 120 ms, sem piscar branco: a WebView começa com fundo transparente e o container já tem a cor certa.
5. **Pronto quando** o screenshot da revisão de uma nota avicena real é visualmente igual ao do AnkiDroid ou do Anki desktop (ver Passo 10), nos dois temas.

## Passo 8 — Cores fixas no modo escuro

Notas antigas têm cor inline (ex.: `style="color: rgb(0, 0, 0)"` na fixture AnKing), que some no fundo escuro.

1. Ajustes → "Ajustar cores fixas no modo escuro" (padrão ligado).
2. Ligado e no escuro, ao renderizar os **campos**: remover `color` inline com luminância < 0,25 e `background-color` inline com luminância > 0,85. Cores médias (ex.: o azul `rgb(0,0,255)`) ficam como estão.
3. **Teste:** na fixture AnKing no escuro, o trecho preto passa a herdar a cor `#b2cacd`; o azul continua azul.

## Passo 9 — Os modelos próprios do Weiss com o mesmo visual

Para os cards criados no Weiss e os importados por CSV terem o mesmo "cartão com profundidade":

1. Reescrever os templates e o CSS dos modelos embutidos (Básico, Básico + invertido, Cloze) na estrutura do avicena:
   - frente `<div class="main question-field">…</div>`;
   - verso `<div class="main answer-field">…</div>` + `<hr>` + `Extra` / referência + tags;
   - tags em pílulas geradas **sem script**, por um filtro novo `{{weiss-tags:Tags}}` que já devolve `<span class="tag-pill">`;
   - cores Calmcoder / Noctis Obscuro, iguais às do avicena.
2. Migração: atualizar os modelos embutidos no banco apenas se o CSS e os templates ainda forem os originais (comparar com hash). Se o usuário tiver editado, não mexer.
3. **Pronto quando** um card criado no editor do Weiss e um card avicena importado ficam lado a lado no laboratório sem diferença de estilo.

## Passo 10 — Comparação visual e desempenho

1. **Referência visual:** pedir ao Akira 8 screenshots do AnkiDroid (ou do Anki desktop): avicena frente/verso × claro/escuro e AnKing frente/verso × claro/escuro. Salvar em `docs/referencia/visual/`.
2. Fluxo Maestro `reviewer-visual.yaml`: abre o laboratório e tira os mesmos 8 screenshots no emulador. Comparar lado a lado e anotar as diferenças em `docs/referencia/visual/DIFERENCAS.md` até não restar nenhuma relevante.
3. **Desempenho:** virar o card em < 150 ms e passar ao próximo em < 250 ms num Android intermediário. Se não der, pré-carregar a frente do próximo card numa segunda WebView escondida e alternar (double buffering).
4. Rodar `npm run check`, o fluxo Maestro, e testar 50 revisões seguidas num deck avicena real sem erro no log.

## Critérios de aceite do M10

- Cards avicena e AnKing reais na revisão ficam visualmente iguais ao AnkiDroid, nos temas claro e escuro, com tags em pílula, cloze colorido, referência e sombra.
- O zoom de imagem do avicena funciona com toque; o "um por um", as dicas e o bloco de notas do AnKing funcionam, e o bloco salva em `Personal Notes`.
- Em modo avião, o visual é o mesmo (fonte local, nenhuma requisição externa no log).
- Os grifos da Consulta aparecem no lugar certo no verso de cards avicena.
- Um script com erro num template gera uma linha no log e não interrompe a revisão.
