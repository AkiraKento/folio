# ROADMAP — protótipo Android

Faça **uma tarefa por vez, na ordem**. Ao terminar, marque `[x]` e escreva, numa linha abaixo, qualquer decisão tomada. Se uma tarefa for grande demais para um passo, divida-a aqui antes de começar.

O Modo Consulta (M4) vem logo depois da renderização, antes da revisão: é a funcionalidade central e precisa do maior tempo de teste.

## M0 — Base do projeto
- [x] Criar o app Expo (TypeScript strict, expo-router) com a estrutura de pastas do `AGENTS.md`.
  Decisão: Arquivos do projeto movidos para a raiz; Expo SDK 57 configurado em modo strict com expo-router.
- [x] ESLint + Prettier + jest/jest-expo configurados; script `npm run check` = tsc + eslint + jest.
  Decisão: ESLint 9 configurado com flat config ignorando pasta de docs; jest-expo com mapeamento @/*.
- [x] `src/ui/theme.ts` com os tokens claro/escuro e o hook `useTheme()` seguindo o sistema.
  Decisão: Tokens Calmcoder e Noctis Obscuro + cores de grifo de MODO_CONSULTA.md e strings centralizadas em src/ui/strings.ts.
- [x] `eas.json` com o perfil `preview` (`android.buildType: "apk"`) e o perfil `development`.
  Decisão: eas.json estruturado para build preview interno de APK Android.
- [x] Pipeline do esbuild que empacota `src/webview/*` num HTML/JS estático carregado pela WebView, com um "olá mundo" funcionando no Android.
  Decisão: esbuild gera standalone HTML e módulo TS exportando HTML string para carregamento direto em react-native-webview.


## M1 — Dados
- [ ] Schema drizzle de todas as tabelas do PRD §7 + `annotations`; primeira migration.
- [ ] Repositórios (`decks`, `notes`, `cards`, `annotations`, `settings`) com testes.
- [ ] Note types embutidos: Básico, Básico + invertido, Cloze (campos e templates).
- [ ] Deck de exemplo autoral (20 notas de `[EXEMPLO]` com Cloze e Básico) carregado no primeiro uso.

## M2 — Renderização de card
- [ ] Motor de template (`src/render`): campos, FrontSide, condicionais, `cloze:`, `hint:`, `text:`, com testes.
- [ ] Cloze: frente com lacuna ativa, verso com `<span class="cloze">`, e a variante "todas reveladas" para a Consulta.
- [ ] `src/webview/card`: renderizador de card único com DOMPurify, CSS do note type com escopo e imagens da pasta de mídia.
- [ ] Componente `<CardView html side />` no RN; testar com o deck de exemplo.

## M3 — Decks e editor
- [ ] Tela Decks (árvore, contadores) e Detalhe do deck (Estudar / Consultar / Adicionar).
- [ ] Criar, renomear, mover e apagar deck (com Desfazer).
- [ ] Editor de card: escolha do modelo, campos, tags, prévia; imagem da galeria copiada para `media/`.

## M4 — Modo Consulta (CORE) · ler `MODO_CONSULTA.md` inteiro antes
- [ ] Portar `docs/referencia/anchor.js` para `src/webview/shared/anchor.ts` + todos os testes da §7.
- [ ] `src/consulta/units.ts`: montar as unidades (1 por nota, cloze com tudo revelado) na ordem certa, com testes.
- [ ] WebView da Consulta: lista com lotes de 30, cabeçalho de deck, frente esmaecida, verso em serifa, tags, menu `⋯`.
- [ ] Ponte RN ↔ WebView (§8) com request/response tipado.
- [ ] Selecionar → barra flutuante (5 cores, sublinhar, nota, copiar) → salvar anotação.
- [ ] Popover do grifo (cor, tipo, nota, apagar com Desfazer).
- [ ] Painel de anotações (filtro "só com nota", ir até o trecho, órfãs).
- [ ] Busca sem acento e sem caixa + "só unidades com anotação".
- [ ] Fonte A−/A+ e "Continuar lendo" (`consulta_pos`).
- [ ] Teste de performance com deck gerado de 5.000 notas (critério da §9).

## M5 — Revisão
- [ ] `src/scheduler`: wrapper do ts-fsrs (retenção desejada, short-term) + montagem da fila do dia (PRD §9), com testes que avançam o relógio por 14 dias.
- [ ] Tela de revisão: frente → virar → verso **com grifos** → botões (2 ou 4) com o próximo intervalo; desfazer; editar; "Abrir na Consulta".
- [ ] `review_logs` gravado em toda resposta; bury das irmãs no mesmo dia.
- [ ] Tela Hoje: pendentes, tempo estimado (média dos últimos 7 dias, ou 8 s/card se não houver histórico), sequência de dias.

## M6 — Importação
- [ ] `.apkg` legado: descompactar, ler note types/decks/notes/cards (esquema antigo e anki21), mídia, com prévia e progresso (PRD §10).
- [ ] Estado FSRS a partir de `cards.data`; senão, a escolha "manter intervalos / começar como novos"; importar o `revlog`.
- [ ] Reimportação idempotente por `source_id`.
- [ ] Teste com um `.apkg` real de 5.000+ cards com imagens (critério do PRD §12). **Pedir o arquivo de teste ao Akira**; não baixar decks da internet.
- [ ] (P1) CSV `frente;verso;tags`.

## M7 — Primeiro uso e retenção
- [ ] Onboarding em 3 passos (PRD §6.1).
- [ ] Backup: exportar/importar zip (JSON + mídia), incluindo as anotações.
- [ ] (P1) Heatmap na tela Hoje e em Estatísticas.
- [ ] (P1) Lembrete diário configurável.
- [ ] Bloco "Estatísticas do teste" (PRD §4), com botão para exportar como texto.

## M8 — APK de teste
- [ ] Ícone, splash e nome do app (provisório: Folio).
- [ ] Passada de performance e acessibilidade (alvos de 44 px, contraste, TalkBack nos botões principais).
- [ ] Botão "Enviar feedback" (abre e-mail ou formulário com a versão do app; sem dados de estudo).
- [ ] `eas build -p android --profile preview` gerando o APK; registrar em `docs/RELEASES.md` o link, a versão e as mudanças.
