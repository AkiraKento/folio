# Modo Consulta — especificação (funcionalidade central)

A Consulta transforma um deck (ou o resultado de uma busca) num **texto corrido para ler**: os versos dos cards aparecem um embaixo do outro, na ordem do deck. Enquanto lê, a pessoa **grifa** (5 cores), **sublinha** e **escreve notas** em trechos. As anotações:

- **nunca** são gravadas nos campos do card;
- são ancoradas pelo **texto** (trecho + contexto), então sobrevivem à edição do card;
- reaparecem no **verso durante a revisão**.

A funcionalidade já existe e foi validada como add-on do Anki desktop (ConsultaCards, do Akira). Este documento traduz esse add-on para o app. O algoritmo de âncora está em `docs/referencia/anchor.js`: **porte para TypeScript sem mudar o comportamento** e escreva os testes da §7 antes de mexer nele.

## 1. Pontos de entrada

- Detalhe do deck → botão **Consultar**.
- Revisão → botão **Abrir na Consulta**, que abre a Consulta do deck rolada até a unidade do card atual.
- Hoje → **Continuar lendo**, que reabre a última Consulta na última posição (tabela `consulta_pos`).
- Busca global → resultado → **Ler estes na Consulta**.

## 2. Unidades (o que vira um bloco da lista)

- Uma **unidade = uma nota** (não um card). Uma nota Cloze com c1…c5 aparece **uma vez só**, com todas as lacunas reveladas e marcadas (`<span class="cloze">`).
- Uma nota Básico + invertido aparece uma vez (renderiza o verso do card `ord = 0`).
- Ordem: caminho do deck (ordem natural, ignorando acento e caixa) → `notes.created_at` → `cards.ord`.
- Cada unidade mostra: o caminho do deck (só quando muda em relação à unidade anterior, como um cabeçalho de seção), a **frente** em fonte menor e esmaecida, o **verso** completo, as tags e um menu `⋯` com Editar, Revisar agora e Suspender.
- Suspensas aparecem com opacidade reduzida e o selo "suspenso".
- **P2:** opção "Juntar irmãs" para decks em que cada lacuna é uma nota separada. Irmãs são notas do mesmo note type e do mesmo deck cujo texto, sem lacunas e sem HTML, é igual. Nesse caso a anotação usa `group_key` (hash desse texto) em vez de `note_id`.

## 3. Interface

```
┌──────────────────────────────────────┐
│ ←  Cardiologia            🔍  A− A+  ☰ │  barra: voltar, busca, fonte, painel
├──────────────────────────────────────┤
│ CARDIOLOGIA › INSUFICIÊNCIA CARDÍACA │  cabeçalho de seção (deck)
│                                      │
│  Qual a primeira linha na ICFEr?     │  frente (pequena, esmaecida)
│  ▌IECA/BRA ou INRA, betabloqueador,  │  verso (serifa, legível)
│  ▌antagonista mineralocorticoide e   │  grifo amarelo
│  iSGLT2 — os "quatro pilares".  ✎    │  ✎ = trecho com nota
│  #cardio #ic                    ⋯    │
│ ──────────────────────────────────── │
│  …próxima unidade…                   │
└──────────────────────────────────────┘
```

- **Uma WebView para a lista inteira**, não uma por card. Isso permite selecionar texto naturalmente e rolar de forma fluida. O lado React Native só fornece dados e recebe eventos.
- **Carregamento em lotes** de 30 unidades: quando a rolagem chega a ~2 telas do fim, a WebView pede o próximo lote. Unidades muito acima da tela podem ser trocadas por um espaço com a mesma altura (virtualização simples) para decks enormes.
- **Selecionar texto** (toque longo e arrastar as alças) faz aparecer uma **barra flutuante** acima da seleção: ● ● ● ● ● (as 5 cores), **U** (sublinhar), **✎** (nota) e **Copiar**. Tocar numa cor grifa direto. Suprimir o menu nativo do Android para ele não cobrir a barra; se não for possível, posicionar a barra abaixo da seleção.
- **Tocar num grifo** abre um popover com: troca de cor, alternar grifo/sublinhado, campo de nota (salva ao fechar), Apagar. Apagar mostra o snackbar "Grifo removido · Desfazer" por 6 s.
- **Painel ☰ (Anotações):** lista todas as anotações do deck aberto, na ordem de leitura, com o trecho (até 2 linhas) e a nota. Tem o filtro "só com nota". Tocar num item rola até o trecho e pisca o grifo. No fim aparecem as **órfãs** (§5), com o trecho original e o botão Apagar.
- **Busca 🔍:** filtra as unidades por texto (frente + verso + tags), ignorando acento e caixa, com espera de 250 ms enquanto digita. Tem o interruptor "só unidades com anotação".
- **Fonte A−/A+:** de 14 a 26 px, padrão 17. A largura da coluna de texto vai até 720 px (relevante em tablet).
- **Posição:** ao sair, salvar `unit_index` + deslocamento em `consulta_pos`.
- **Revisar estes:** um botão no topo da busca cria uma sessão de revisão só com os cards das unidades filtradas (vencidos ou não, sem alterar o agendamento normal: modo "estudo extra", que registra review_log mas não reagenda cards ainda não vencidos). *Pergunte ao Akira antes de implementar a regra de reagendamento.*

### Cores

| cor     | grifo claro                 | grifo escuro                | sublinhado claro | sublinhado escuro |
|---------|-----------------------------|-----------------------------|------------------|-------------------|
| amarelo | `rgba(255, 208, 50, 0.45)`  | `rgba(255, 210, 70, 0.28)`  | `#d6a400`        | `#f2c94c`         |
| verde   | `rgba(96, 200, 112, 0.36)`  | `rgba(120, 220, 130, 0.24)` | `#34a853`        | `#6fcf7f`         |
| azul    | `rgba(80, 160, 255, 0.32)`  | `rgba(100, 175, 255, 0.26)` | `#2f80ed`        | `#6cb2ff`         |
| rosa    | `rgba(255, 110, 165, 0.32)` | `rgba(255, 120, 175, 0.26)` | `#e0457b`        | `#ff7eb0`         |
| laranja | `rgba(255, 145, 50, 0.38)`  | `rgba(255, 160, 80, 0.28)`  | `#e8711c`        | `#ffa25c`         |

O grifo usa `box-decoration-break: clone` para quebrar bem entre linhas. Trecho com nota recebe um pequeno ✎ depois do último pedaço (`.has-note.end::after`). A última cor usada fica salva e é a padrão da próxima vez.

## 4. Dados

```sql
create table annotations (
  id          text primary key,          -- uuid
  note_id     text not null,             -- nota onde foi criada
  group_key   text,                      -- P2: identidade das irmãs; null em notas comuns
  kind        text not null,             -- 'hl' (grifo) | 'ul' (sublinhado)
  color       text not null,             -- 'amarelo'|'verde'|'azul'|'rosa'|'laranja'
  quote       text not null,             -- trecho exato (textContent)
  prefix      text not null default '',  -- até 40 caracteres antes
  suffix      text not null default '',  -- até 40 caracteres depois
  start       integer not null default 0,-- posição no textContent do verso
  "end"       integer not null default 0,
  note        text not null default '',  -- nota do usuário (texto puro)
  label       text not null default '',  -- reservado (etiqueta)
  created_at  integer not null,
  updated_at  integer not null,
  deleted_at  integer
);
create index ix_ann_note on annotations(note_id);
create index ix_ann_group on annotations(group_key);
```

- `note_id` e `group_key` só são definidos na criação. Editar uma anotação nunca a move de nota.
- Apagar é lógico (`deleted_at`); o "Desfazer" só limpa `deleted_at`.
- O backup (F9) inclui as anotações. Apagar uma nota **não** apaga as anotações dela na hora: elas viram órfãs e somem com a nota apenas quando a nota for purgada de vez.

## 5. Âncora (como reencontrar o trecho)

Algoritmo de `docs/referencia/anchor.js`, no estilo do Hypothesis. Tudo trabalha sobre o `textContent` do elemento do verso.

1. **Criar:** a partir da seleção (`Range`), calcular `start`/`end` no textContent, cortar os espaços das pontas e guardar `quote`, `prefix` (40 caracteres) e `suffix` (40 caracteres).
2. **Reencontrar:**
   1. se `text.slice(start, end) === quote`, usar essa posição;
   2. senão, procurar todas as ocorrências de `quote` e escolher a de maior pontuação, `(prefixo comum + sufixo comum) * 1000 − |posição − start|`;
   3. senão, repetir o passo 2 com os espaços colapsados (mapeando de volta para as posições originais);
   4. senão, **órfã**: não pinta e lista no painel.
3. **Pintar:** envolver os pedaços de nó de texto do intervalo em `<mark class="ann" data-aid="…">`, sem pintar pedaços só de espaço. Isso não altera o textContent, então as outras anotações continuam válidas, e anotações sobrepostas viram `<mark>` aninhados.
4. Aplicar as anotações em ordem de `start`.

## 6. Na revisão

- Ao virar o card, o verso recebe as anotações da nota (e do `group_key`, se houver), com o mesmo `anchor.ts` e as mesmas cores.
- Tocar num trecho com nota mostra a nota num balão. Não dá para criar grifo na revisão no MVP: o foco ali é se testar.
- Ajustes → "Mostrar grifos na revisão" (padrão: ligado).
- Na **frente** do card os grifos não aparecem, para não entregar a resposta.

## 7. Testes obrigatórios (jsdom)

- `describe`/`locate` de ida e volta num parágrafo simples.
- O mesmo trecho aparece 2× no texto e o contexto escolhe a ocorrência certa.
- Card editado com texto inserido **antes** do trecho: a anotação é reencontrada.
- Espaços e quebras de linha mudaram dentro do trecho: reencontra pelo passo 3.
- Trecho apagado do card: vira órfã e não lança erro.
- Seleção que atravessa `<b>`, `<span class="cloze">` e `<br>`: pinta todos os pedaços e o textContent continua igual.
- Duas anotações sobrepostas: as duas pintadas; apagar uma não estraga a outra.
- Performance: aplicar 50 anotações num verso de 5.000 caracteres em menos de 30 ms.

## 8. Ponte React Native ↔ WebView

Mensagens JSON com `{type, id?, payload}`. Respostas levam o mesmo `id` (padrão request/response, como o `send(cmd, payload, cb)` do add-on).

| direção | type | payload |
|---------|------|---------|
| RN → Web | `init` | `{theme, fontSize, lastColor, showFront}` |
| RN → Web | `append` | `{units: Unit[], hasMore}` |
| RN → Web | `replace` | `{units: Unit[]}` (depois de editar um card) |
| RN → Web | `goto` | `{unitIndex, annotationId?}` |
| Web → RN | `needMore` | `{after: unitIndex}` |
| Web → RN | `saveAnnotation` | `Annotation` (cria ou atualiza) → resposta com o registro gravado |
| Web → RN | `deleteAnnotation` | `{id}` → resposta `{ok}` |
| Web → RN | `restoreAnnotation` | `{id}` |
| Web → RN | `openEditor` | `{noteId}` |
| Web → RN | `position` | `{unitIndex, offset}` (com espera de 1 s) |
| Web → RN | `setFont` / `setColor` | número / cor |

`Unit = {index, noteId, groupKey?, deckPath, frontHtml, backHtml, tags[], suspended, annotations[]}`. O HTML chega já renderizado pelo `src/render` e é sanitizado na WebView antes de entrar no DOM.

## 9. Critérios de aceite

- Abrir a Consulta de um deck com 5.000 notas: primeiro lote visível em menos de 1 s; rolar até o fim sem travar.
- Grifar, fechar o app, reabrir: o grifo está lá, na posição certa.
- Editar o card inserindo uma frase antes do trecho grifado: o grifo continua no lugar certo, na Consulta e na revisão.
- Apagar o trecho grifado no editor: a anotação aparece em "Órfãs" no painel, com o trecho original.
- "Continuar lendo" volta à mesma unidade, com diferença de no máximo meia tela.
- Funciona igual nos temas claro e escuro, com fonte de 14 a 26 px.
