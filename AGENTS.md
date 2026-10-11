# AGENTS.md — Weiss

App Android de flashcards com repetição espaçada (FSRS) cujo diferencial é o **Modo Consulta**: os versos dos cards viram um texto corrido que a pessoa lê, grifa, sublinha e anota, e esses grifos reaparecem na revisão. Público: estudantes de medicina, concursos, direito e psicologia que acham o Anki difícil.

Antes de qualquer tarefa, leia:
1. `docs/PRD.md`: o produto, as telas e o modelo de dados.
2. `docs/MODO_CONSULTA.md`: a especificação da funcionalidade central. **Leia inteira antes de mexer em renderização de card, anotação ou revisão.**
3. `docs/PASSO_A_PASSO_REVIEWER_ANKI.md`: como renderizar os cards igual ao Anki. **Leia antes de mexer em `src/webview/card`, `src/render` ou na tela de revisão.**
4. `docs/ROADMAP.md`: a lista de tarefas, em ordem. Trabalhe sempre na primeira tarefa não marcada.

## Stack (não trocar sem perguntar)

- **Expo** (SDK estável mais recente) + **React Native** + **TypeScript** em modo `strict`, com **expo-router**.
- **expo-sqlite** + **drizzle-orm** (migrations com drizzle-kit). Banco local, offline-first.
- **ts-fsrs** para o agendamento. Não implementar o algoritmo à mão.
- **react-native-webview** para renderizar o HTML dos cards (revisão e Consulta).
- **DOMPurify**, dentro da WebView, para sanitizar o HTML dos cards.
- **zustand** para estado de UI. **jszip** para ler `.apkg`.
- Testes: **jest** + **jest-expo**; testes de DOM (âncoras) com **jsdom**.
- Build: **EAS Build**, perfil `preview` com `"buildType": "apk"`.

Dependências novas fora desta lista: pergunte antes e explique por quê.

## Estrutura de pastas

```
app/                    rotas (expo-router)
src/db/                 schema drizzle, migrations, repositórios
src/scheduler/          wrapper do ts-fsrs, montagem da fila do dia
src/render/             motor de template (campos, cloze, FrontSide, condicionais)
src/import/             CSV e .apkg
src/consulta/           montagem das unidades, bridge RN <-> WebView
src/webview/            código que roda DENTRO da WebView (TS puro, sem React)
  card/                 renderizador de card único (revisão)
  consulta/             lista da Consulta, âncoras, barra de grifo
  shared/anchor.ts      porte de docs/referencia/anchor.js
src/ui/                 componentes e tokens de tema
assets/decks-exemplo/   decks de exemplo (conteúdo autoral, ver regra de conteúdo)
```

O código de `src/webview/` é empacotado com **esbuild** num HTML/JS estático que a WebView carrega. Ele não pode importar nada de React Native. Assim o mesmo pacote serve depois para a versão web, num iframe.

## Convenções

- Identificadores, nomes de arquivo e de tabela **em inglês**. Textos da interface, comentários e mensagens de commit **em português do Brasil**.
- Todo texto de UI fica em `src/ui/strings.ts`. Nada de string solta em componente.
- IDs são UUID v4 em texto. Toda tabela tem `created_at`, `updated_at` e `deleted_at` (exclusão lógica), para a sincronização futura.
- Datas em milissegundos UTC (inteiro). O "dia de estudo" vira às 4h no fuso local (configurável), como no Anki.
- Funções puras (scheduler, render, âncora, import) têm teste unitário. UI pode ficar só com teste manual no MVP.
- Componentes pequenos; lógica fora dos componentes (hooks ou `src/*`).

## Antes de dar uma tarefa por concluída

1. `npx tsc --noEmit` sem erros.
2. `npm test` passando.
3. `npx eslint .` sem erros.
4. Testou no emulador ou aparelho Android quando a tarefa mexe em UI. Descreva o que testou no walkthrough.
5. Marque a caixa da tarefa em `docs/ROADMAP.md` e anote, numa linha, qualquer decisão tomada.

## Regras que não podem ser quebradas

- **Conteúdo (uso pessoal):** por enquanto o Weiss é usado só pelo Akira, que importa os próprios decks, inclusive os da Osler. Isso é permitido no aparelho dele e em testes locais. Mas: nenhum `.apkg` ou conteúdo de terceiros entra no git (o `.gitignore` já cobre `*.apkg`), no APK, nos decks de exemplo ou em fixtures versionadas. Fixtures de teste são sintéticas (ver `docs/referencia/modelos/*/exemplo.json`). Os decks de exemplo continuam autorais, marcados com `[EXEMPLO]`. **Se o app for distribuído a outras pessoas, esta regra precisa ser revista antes.**
- **Licença:** não copiar código do Anki (AGPL) nem do AnkiDroid (GPL). O formato `.apkg` pode ser lido, porque é um formato de arquivo. O algoritmo vem do `ts-fsrs`.
- **Anotações nunca são gravadas nos campos do card.** Elas vivem na tabela `annotations` e são ancoradas pelo texto (ver `MODO_CONSULTA.md`).
- **Segurança:** o HTML dos **campos** das notas sempre passa pelo DOMPurify antes de entrar no template; `<script>`, `on*=` e `javascript:` são removidos dos campos. Os `<script>` do **template** do modelo rodam (os modelos são do próprio usuário), com o interruptor Ajustes → "Executar scripts dos modelos" e as regras de `docs/PASSO_A_PASSO_REVIEWER_ANKI.md` (shims, bloqueio de rede, erros no log). A WebView roda com `originWhitelist` restrito, `baseUrl` na pasta de mídia e sem acesso a arquivos fora dela. Nenhuma requisição de rede sai de dentro de um card.
- **Sem segredos no repositório.** O MVP não tem backend. Quando entrar o Supabase (fora do MVP): RLS ligado em todas as tabelas, só a chave `anon` no app, nunca a `service_role`.
- **Privacidade:** nenhum SDK de analytics ou de anúncio no MVP. Nada sai do aparelho.
- **Dados do usuário são sagrados:** toda migration tem teste de ida sobre um banco com dados. Nunca apagar tabela ou coluna com dados sem migração de cópia.

## Design

Minimalista, calmo, com bastante espaço em branco. Tokens em `src/ui/theme.ts`:

| token      | claro (Calmcoder) | escuro (Noctis Obscuro) |
|------------|-------------------|-------------------------|
| canvas     | `#f0f4f0`         | `#031417`               |
| elevated   | `#ffffff`         | `#062e32`               |
| elevated2  | `#e0e8e8`         | `#083f44`               |
| border     | `#e0e6e6`         | `#083f44`               |
| fg         | `#203e3a`         | `#b2cacd`               |
| fgMuted    | `#5b858b`         | `#87a7ab`               |
| accent     | `#3a9d7f`         | `#169fb1`               |
| learn      | `#b8941f`         | `#d5971a`               |

- O app segue o tema claro/escuro do sistema, com opção manual em Ajustes.
- Fonte de interface sem serifa (Inter ou a do sistema). No **Modo Consulta**, o texto dos cards usa fonte serifada de leitura (Source Serif 4), porque é modo de leitura.
- As cores de grifo estão em `MODO_CONSULTA.md`.
- Alvos de toque com no mínimo 44 px. Toda ação destrutiva tem "Desfazer" num snackbar em vez de diálogo de confirmação.

## Como reportar

No fim de cada tarefa, escreva um walkthrough curto: o que mudou, como testar, o que ficou de fora e qualquer dúvida de produto. **Dúvida de produto vira pergunta, não suposição.**
