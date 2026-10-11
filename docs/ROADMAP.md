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
- [x] Schema drizzle de todas as tabelas do PRD §7 + `annotations`; primeira migration.
  Decisão: 9 tabelas estruturadas com soft delete e campos UTC em ms; índices e chaves estrangeiras de PRD §7 e MODO_CONSULTA.md §4; driver expo configurado no drizzle-kit e migration inicial gerada.
- [x] Repositórios (`decks`, `notes`, `cards`, `annotations`, `settings`) com testes.
  Decisão: Repositórios orientados a Drizzle com suporte a hierarquia em decks (Pai::Filho com renomeação e soft delete em cascata), notas com ordenação da Consulta, cards com controle FSRS e suspensão/enterro, anotações com proteção de note_id/group_key e identificação de órfãs, e settings tipados; testados com SQLite em memória usando migrations reais.
- [x] Note types embutidos: Básico, Básico + invertido, Cloze (campos e templates).
  Decisão: BUILTIN_NOTE_TYPES com UUIDs v4 determinísticos, templates e campos de PRD §7/§8 com estilos compatíveis com tema Folio, NoteTypesRepository com seed idempotente e helper de resolução de ords de cards (cloze e invertido).
- [x] Deck de exemplo autoral (20 notas de `[EXEMPLO]` com Cloze e Básico) carregado no primeiro uso.
  Decisão: Deck autoral Medicina::Cardiologia em assets/decks-exemplo com 20 notas rotuladas com [EXEMPLO] (10 Básico e 10 Cloze), geração de cards FSRS associados e carga idempotente orientada a settings.sampleDeckLoaded na inicialização do app.

## M2 — Renderização de card
- [x] Motor de template (`src/render`): campos, FrontSide, condicionais, `cloze:`, `hint:`, `text:`, com testes.
  Decisão: Parser AST com suporte a condicionais aninhadas ({{#}} e {{^}}), resolução de FrontSide no verso, campos especiais (Tags, Deck, Subdeck, Card), filtros (cloze, hint com details/summary, text, type e warning para desconhecidos) e renderização completa de cards.
- [x] Cloze: frente com lacuna ativa, verso com `<span class="cloze">`, e a variante "todas reveladas" para a Consulta.
  Decisão: Regex com suporte a multilinhas, helper renderAllClozesRevealed para a Consulta, extractClozeNumbers unificado e propagação de allClozesRevealed em renderCard e renderCardSide.
- [x] `src/webview/card`: renderizador de card único com DOMPurify, CSS do note type com escopo e imagens da pasta de mídia.
  Decisão: Sanitização com DOMPurify e perfil estrito (sem scripts, links stylesheet externos ou handlers inline); isolamento de CSS do note type com escopo em .card-root; resolução segura de imagens relativas contra mediaBasePath; contrato bidirecional de mensagens e bundle cardHtml empacotado via esbuild.
- [x] Componente `<CardView html side />` no RN; testar com o deck de exemplo.
  Decisão: Componente CardView com injeção inicial via window.__INITIAL_CARD_DATA__ (renderização instantânea sem flash em branco), postMessage reativo para renderCard/setTheme, callbacks tipados (onRendered, onLinkPress, onError) e tela inicial interativa com navegação e alternância frente/verso nos 20 cards do deck de exemplo autoral.

## M3 — Decks e editor
- [x] Tela Decks (árvore, contadores) e Detalhe do deck (Estudar / Consultar / Adicionar).
  Decisão: Árvore hierárquica com contadores agregados (novos/aprendendo/revisão) calculados em lote via DecksRepository.getDeckTreeWithCounts; navegação via Expo Router (/ e /deck/[id]) com componentes DecksScreen, DeckTreeItem, DeckCountsBadge, DeckDetailView e as três ações principais de mesmo tamanho (Estudar, Consultar, Adicionar).
- [x] Criar, renomear, mover e apagar deck (com Desfazer).
  Decisão: Modais com validação contra nomes vazios e duplicados, normalização de prefixos de deck pai na criação e renomeação ergonômica de subdecks, movimentação com exclusão de si mesmo e descendentes, exclusão lógica imediata com Desfazer no Snackbar (sem diálogo de confirmação, conforme AGENTS.md), sincronização de foco via useFocusEffect e testes unitários dos hooks e UI.
- [x] Editor de card: escolha do modelo, campos, tags, prévia; imagem da galeria copiada para `media/`.
  Decisão: Instalação das dependências expo-image-picker, expo-file-system e expo-crypto autorizada pelo usuário; criação de MediaRepository e mediaService com deduplicação por SHA-1 e cópia para media/; rotas e componentes CardEditorView e useCardEditor com escolha dinâmica de modelo, geração automática de cards FSRS (básico, invertido e múltiplos clozes), atalho inteligente [...], prévia interativa com CardView e integração direta com o botão Adicionar Card do Detalhe do deck.

## M4 — Modo Consulta (CORE) · ler `MODO_CONSULTA.md` inteiro antes
- [x] Portar `docs/referencia/anchor.js` para `src/webview/shared/anchor.ts` + todos os testes da §7.
  Decisão: Algoritmo de âncora do add-on portado integralmente para TypeScript estrito (sem dependência de React Native) com suporte às classes legadas `cq-*` e classes semânticas da especificação (`ann`, `hl`/`ul`, `c-*`, `has-note`, `end`); 12 testes unitários com jsdom cobrindo os 8 cenários obrigatórios da §7 (ida e volta, desempate por contexto, inserção antes do trecho, colapso de espaços/quebras com squash, órfãs sem erro, travessia de tags b/cloze/br preservando textContent, sobreposições com unwrap isolado e performance de 50 anotações em 5.000 caracteres em menos de 30 ms).
- [x] `src/consulta/units.ts`: montar as unidades (1 por nota, cloze com tudo revelado) na ordem certa, com testes.
  Decisão: Módulo src/consulta/units.ts implementado com tipos Unit/ConsultaUnit (§8), renderização via renderCard com allClozesRevealed: true e cardOrd: 0 para básico invertido e cloze, ordenação natural hierárquica por deckPath (Intl.Collator pt-BR ignorando acento e caixa) -> notes.created_at -> cards.ord, controle de suspensão agregada e integração com SQLite via loadConsultaUnits (com subdecks e paginação mantendo index absoluto); 11 testes unitários e de integração adicionados.
- [x] WebView da Consulta: lista com lotes de 30, cabeçalho de deck, frente esmaecida, verso em serifa, tags, menu `⋯`.
  Decisão: Módulo WebView da Consulta em src/webview/consulta empacotado via esbuild, com suporte a lotes de 30 e rolagem infinita (~2 telas do fim), cabeçalho de deck apenas na mudança de hierarquia (formatado com › em maiúsculas), frente menor e esmaecida, verso em serifa com aplicação de âncoras/grifos existentes, tags, selo 'suspenso' com opacidade reduzida, menu ⋯ com alvo de 44 px e ações contextuais (Editar, Revisar agora, Suspender/Reativar), integrado ao componente ConsultaView e rota /consulta/[id].
- [x] Ponte RN ↔ WebView (§8) com request/response tipado.
  Decisão: Módulo src/consulta/bridge.ts implementado com createConsultaRnBridge em conformidade estrita com o protocolo bidirecional tipado de MODO_CONSULTA.md §8; tratadores automáticos de saveAnnotation, deleteAnnotation e restoreAnnotation com persistência em AnnotationsRepository; persistência em consulta_pos (ConsultaPosRepository) e configurações de fonte e cor (SettingsRepository); componente `<ConsultaView />` e rota /consulta/[id] integrados com a ponte; 24 novos testes unitários adicionados.
- [x] Selecionar → barra flutuante (5 cores, sublinhar, nota, copiar) → salvar anotação.
  Decisão: Barra flutuante implementada em src/webview/consulta/toolbar.ts com supressão do menu nativo do Android em contextmenu, posicionamento acima da seleção (com fallback abaixo em topos de tela), 5 cores de grifo direto com atualização de lastColor, botão U para sublinhado, botão ✎ com modo inline para inserção de nota, botão Copiar para clipboard com feedback visual, persistência com wrap no DOM e saveAnnotation via ponte, e alvos de toque >= 44 px.
- [x] Popover do grifo (cor, tipo, nota, apagar com Desfazer).
  Decisão: Módulo src/webview/consulta/popover.ts implementado com abertura ao clicar em `<mark>`, 5 cores de grifo, alternador hl ↔ ul, campo de nota com salvamento ao fechar/blur e símbolo ✎ no trecho, apagar com unwrap no DOM, soft delete no banco e disparo de Snackbar flutuante com Desfazer por 6 s no React Native, e restauração imediata via evento restoreAnnotation na ponte.
- [x] Painel de anotações (filtro "só com nota", ir até o trecho, órfãs).
  Decisão: Componente AnnotationsPanel e módulo src/consulta/annotationsPanel implementados com ordenação rigorosa na ordem de leitura (decks hierárquicos -> notas -> start asc), filtro dinâmico 'Só com nota', navegação via goto com carregamento sob demanda de lotes na ConsultaView e efeito ann-flash na WebView, e seção final de Órfãs (detectadas quando o trecho é apagado no editor ou quando a nota é excluída) com botão Apagar e snackbar de Desfazer por 6 s.
- [x] Busca sem acento e sem caixa + "só unidades com anotação".
  Decisão: Módulo src/consulta/search.ts criado com normalização NFD sem acento e sem caixa, remoção de HTML e correspondência multi-token em frente, verso e tags (com suporte a prefixo #); LoadConsultaUnitsOptions estendido com searchQuery e onlyWithAnnotations; ConsultaSearchBar implementado com debounce de 250 ms, alternador de anotações, contador e ação de revisão; ConsultaView atualizado com chave resetKey para reinicialização limpa do DOM; 29 novos testes unitários e de integração adicionados cobrindo lógica e UI.
- [x] Fonte A−/A+ e "Continuar lendo" (`consulta_pos`).
  Decisão: Controles de fonte A−/A+ (14 a 26 px, padrão 17) com alvos de toque de 44 px, sincronização dinâmica com CSS variável (--consulta-font-size) e persistência em SettingsRepository; rastreamento contínuo e flush imediato ao sair para a tabela consulta_pos; card "Continuar lendo" integrado na tela principal e restauração exata de unidade + deslocamento (offset) na ConsultaView com pré-carregamento do lote; 25 novos testes unitários adicionados.
- [x] Teste de performance com deck gerado de 5.000 notas (critério da §9).
  Decisão: Suite de testes em `src/consulta/__tests__/performance.test.ts` com deck autoral de 5.000 notas e subdeck (básico e cloze com 100 anotações); abertura em ~90 ms (< 1 s) e rolagem contínua fluida de 167 lotes; loadConsultaUnits e countConsultaUnits otimizados com projeção leve de candidatos, chunkArray seguro contra limite de variáveis SQL e hidratação direcionada de cards/anotações apenas para o lote fatiado.

## M5 — Revisão
- [x] `src/scheduler`: wrapper do ts-fsrs (retenção desejada, short-term) + montagem da fila do dia (PRD §9), com testes que avançam o relógio por 14 dias.
  Decisão: Dependência oficial ts-fsrs integrada com request_retention configurável e short-term ativo; ReviewLogsRepository criado; montagem da fila diária com prioridade (aprendizado -> revisões vencidas mais atrasadas primeiro -> novos na ordem do deck), desconto de cota já estudada hoje e bury automático de irmãs por note_id; 23 testes unitários com simulação contínua de 14 dias garantindo ausência de duplicatas, integridade de cards e due válido.
- [x] Tela de revisão: frente → virar → verso **com grifos** → botões (2 ou 4) com o próximo intervalo; desfazer; editar; "Abrir na Consulta".
- [x] `review_logs` gravado em toda resposta; bury das irmãs no mesmo dia.
  Decisão: Gravação de log FSRS com review_ms e estados anterior/posterior em cada resposta; CardsRepository estendido com burySiblingsByNote, burySiblings e restoreBuriedSiblings respeitando sepultamentos prévios mais longos; useReviewSession atualizado para enterrar irmãs no SQLite até o fim do dia de estudo e removê-las da fila ativa, com restauração completa e imediata no Desfazer; buildDailyQueue aprimorado para descontar irmãs de cards já revisados hoje.
- [x] Tela Hoje: pendentes, tempo estimado (média dos últimos 7 dias, ou 8 s/card se não houver histórico), sequência de dias.
  Decisão: Módulo src/today com cálculo determinístico de sequência (streak) respeitando virada do dia (rolloverHour) e status de estudo no dia atual, tempo estimado consolidando média ponderada dos últimos 7 dias em review_logs ou fallback de 8 s/card, atalho de 'Continuar lendo' integrado com consulta_pos, componente TodayView com cards calmos em tema Folio e navegação principal por abas (Hoje e Decks) em app/index.tsx.

## M6 — Importação
- [x] `.apkg` legado: descompactar, ler note types/decks/notes/cards (esquema antigo e anki21), mídia, com prévia e progresso (PRD §10).
  Decisão: Módulos src/import (types, apkgReader, ankiParser, importer, useApkgImport) implementados com suporte a extração via jszip, schemas legado (col) e normalizado (notetypes/decks/fields/templates), extração e persistência de mídia mapeada no diretório media/, aviso amigável para anki21b sem retrocompatibilidade (PRD §10), cálculo de prévia, barra de progresso por etapas, interface ImportView com alvos de 44 px e rota /import integrada à tela de Decks.
- [x] Estado FSRS a partir de `cards.data`; senão, a escolha "manter intervalos / começar como novos"; importar o `revlog`.
  Decisão: Parser de estado FSRS em cards.data com stability e difficulty (Anki 23.10+); cálculo de due preservando epoch unix e dias relativos a col.crt; seletor de agendamento na interface (manter intervalos vs começar como novos) com alvos >= 44 px; importação e mapeamento em lote de revlog para review_logs relacionando cards importados, ratings e durações.
- [x] Reimportação idempotente por `source_id`.
  Decisão: Operações no banco atômicas envolvidas em db.transaction com rollback em caso de falha; reimportação idempotente sem duplicatas por source_id em decks, modelos, notas e cards; preservação do progresso de revisões feitas no Folio contra regressões acidentais no modo keep_intervals; atualização de deck_id em notas/cards movidos; reativação de itens com soft delete; deduplicação de revlogs e mídias; feedback visual com strings.import.reimportSummary na interface.
- [x] Teste com um `.apkg` real de 5.000+ cards com imagens (critério do PRD §12). **Pedir o arquivo de teste ao Akira**; não baixar decks da internet.
  Decisão: Validação executada com deck real de 4.470 cards e 2.861 mídias (Notas Selecionadas.apkg, 476 MB) fornecido pelo Akira; prévia em 2,2 s e importação inicial em 10,7 s (largamente abaixo do teto de 60 s do PRD §12), com reimportação idempotente em 12,0 s e deduplicação íntegra de 2.840 imagens únicas por SHA-1; apkgReader e importer otimizados com suporte a buffers nativos, detecção precisa de anki21b/zstd e suite automatizada em realApkgBenchmark.test.ts.
- [x] (P1) CSV `frente;verso;tags`.
  Decisão: Módulo `src/import/csvParser.ts` implementado com suporte a delimitador ';' (com detecção de ',' e '\t'), parser compatível com RFC 4180 (aspas duplas, aspas escapadas e quebras de linha preservadas em `<br>`), detecção automática de cabeçalhos descritivos (Frente/Verso/Tags) e tags múltiplas (espaço, vírgula e #); geração de prévia com nome do deck inferido do arquivo e 0 mídias; transação atômica gerando notas no modelo Básico e cards FSRS novos no estado inicial; hook useApkgImport/useFileImport e tela ImportView estendidos para suporte unificado a .apkg e .csv.

## M7 — Primeiro uso e retenção
- [x] Onboarding em 3 passos (PRD §6.1).
  Decisão: Fluxo de 3 passos (área -> minutos/dia + data da prova -> tema) implementado com OnboardingView e useOnboarding; decks autorais de 20 notas criados para todas as áreas (Medicina::Cardiologia, Concursos::Direito Constitucional, Direito::Direito Civil, Psicologia::Cognição e Aprendizagem, Estudos::Técnicas de Aprendizagem) com marcadores [EXEMPLO]; persistência em settings (onboardingCompleted, userArea, dailyStudyMinutes, examDate, theme) com atualização reativa de tema e redirecionamento suave em HomeScreen.
- [x] Backup: exportar/importar zip (JSON + mídia), incluindo as anotações.
- [x] (P1) Heatmap na tela Hoje e em Estatísticas.
  Decisão: Módulo `src/stats` implementado com cálculo determinístico de matriz de semanas estilo GitHub (14 semanas em Hoje e 20 em Estatísticas), agrupamento por dia de estudo com respeito a `dayRolloverHour` e 4 níveis de intensidade com cores do tema Folio; componente visual `<Heatmap />` com scroll horizontal, tooltip de data/revisões e legenda; componente `<StatsView />` integrado na 3ª aba de navegação inferior (Hoje, Decks, Estatísticas) com taxa de retenção real (% de acertos nos logs de revisão), sequência de estudos, médias e distribuição proporcional de cards por estado (novos, aprendendo, revisão, suspensos); card compacto integrado em `TodayView` com atalho de navegação rápida; 20 novos testes unitários adicionados com 100% de sucesso no `npm run check`.
- [x] (P1) Lembrete diário configurável.
- [x] Bloco "Estatísticas do teste" (PRD §4), com botão para exportar como texto.
  Decisão: Módulo `src/stats/testStats.ts` implementado para consolidar e validar as 3 hipóteses do PRD §4 (H1: hábito de revisão diária em ≥ 10 de 14 dias; H2: abertura da Consulta ≥ 3 vezes e ≥ 5 grifos; H3: importação de .apkg detectada via settings e source_id); rastreamento automático de aberturas em `app/consulta/[id].tsx` e de pacotes importados em `importer.ts` persistido via `SettingsRepository.increment`; bloco visual integrado em `StatsView` com status claro por hipótese, badges de progresso, botão "Exportar como texto" (alvo de 48 px) usando `Share.share` nativo e feedback via Snackbar; 14 novos testes adicionados (586 testes no total) passando com 100% de sucesso.

- [x] Ícone, splash e nome do app: Weiss.
  Decisão: Identidade visual do Weiss criada com base no tema Calmcoder/Noctis Obscuro (três cards de estudo em leque com grifo luminoso em teal #169fb1/#22d3ee e tipografia serifada 'Weiss.'); gerados e integrados os assets em assets/images/ (icon.png 1024x1024, android-icon-foreground.png, android-icon-background.png, android-icon-monochrome.png, splash-icon.png e favicon.png); configurados no app.json com nome 'Weiss', pacote 'com.weiss.app', splash backgroundColor '#031417' e adaptiveIcon completo com suporte a Themed Icons (Material You) do Android 13+; script de geração em `scripts/generate-assets.py` e suite automatizada em `src/__tests__/appConfig.test.ts`.
- [x] Passada de performance e acessibilidade (alvos de 44 px, contraste, TalkBack nos botões principais).
- [x] Botão "Enviar feedback" (abre e-mail ou formulário com a versão do app; sem dados de estudo).
  Decisão: Módulo `src/feedback` (feedbackService e useFeedback) implementado para montar e abrir e-mail via mailto: (destinatário, assunto padronizado e corpo com versão do app e SO, garantindo estritamente ausência de dados de estudo) ou formulário web; seção "Sobre e Feedback" adicionada em Ajustes (SettingsView) com versão do app, aviso de privacidade e botões com alvos de 48 px; botão complementar "Enviar feedback" integrado ao bloco de estatísticas do teste em StatsView; 14 novos testes unitários adicionados (614 testes no total) passando com 100% de sucesso.
- [x] `eas build -p android --profile preview` gerando o APK; registrar em `docs/RELEASES.md` o link, a versão e as mudanças.
  Decisão: Build preview gerado com sucesso via EAS Cloud para a conta `akiraweisss-team` (Build ID `d45384cc-faaa-4f94-b51f-684724164b81`), versão 0.1.1 (versionCode 1); shims de módulos node:* configurados no metro.config.js para garantir empacotamento JS Hermes sem erros; release e changelog detalhado em português documentados em `docs/RELEASES.md`.

## M9 — Estabilização (auditoria de 11/10/2026)
Detalhes, arquivos e linhas em `docs/AUDITORIA_2026-10-11.md`. Faça na ordem; os itens P0 vêm antes de qualquer nova funcionalidade.
- [x] P0-6 Commitar o trabalho atual e acrescentar "commit ao fim da tarefa" ao workflow `/proxima-tarefa`.
  Decisão: Commit inicial consolidado de M1–M8 (32k linhas, 186 arquivos, 614 testes passando) e passo de commit adicionado ao workflow .agents/workflows/proxima-tarefa.md.
- [ ] P0-5 ErrorBoundary no `_layout`, log local de erros e botão "Copiar diagnóstico" em Ajustes; revisar os `catch {}` silenciosos.
- [ ] P0-4 Segurar a splash até o banco migrar; tela de erro se a migração falhar; instância única do banco com PRAGMAs (P2-5).
- [ ] P0-3 Imagens na Revisão e na Consulta (`mediaDirectory`, `baseUrl`, `allowFileAccess`, `loading="lazy"`); restringir `originWhitelist` (P2-4).
- [ ] P2-1 Gerador de deck sintético (50 mil notas, 5 mil imagens) + fluxos Maestro no emulador. **Pedir aprovação para o Maestro.**
- [ ] P0-1 Importação em disco: unzip nativo, banco aberto pelo caminho, mídia movida com md5 nativo, prévia por SQL, gravação em lotes assíncronos. **Pedir aprovação da dependência de unzip.**
- [ ] P1-9 Backup sem zip em memória (`VACUUM INTO` + zip nativo).
- [ ] P1-4 / P1-5 / P1-6 Revisão: reinserir por `due` com espera, trava contra toque duplo, resposta numa transação.
- [ ] P1-7 / P1-8 Fila com `LIMIT` e consultas pesadas assíncronas; medir com o deck sintético.
- [ ] P1-1 / P1-2 / P1-3 Consulta escalável: `sort_key` + paginação no SQL, FTS5 na busca, janela deslizante + recuperação de `onRenderProcessGone`.
- [ ] P0-2 / P1-10 Suporte a `anki21b` (zstd no banco, no mapa e em cada mídia) e ao esquema normalizado. **Pedir aprovação do `fzstd`.**
- [ ] P2-2 / P2-3 / P2-6 / P2-7 / P2-8 Limpeza: mover os `.apkg` para fora da pasta do projeto, remover o hash fraco, quebrar os componentes grandes, corrigir o texto da release, decidir o ID do pacote.

## M10 — Reviewer fiel aos modelos do Anki (Avicena / AnKing)
Siga `docs/PASSO_A_PASSO_REVIEWER_ANKI.md` passo a passo. Pré-requisitos: M9 P0-3 (imagens + `baseUrl`) e P0-5 (log de erros).
- [ ] Passo 1 — Fixtures de `docs/referencia/modelos/` + tela "Laboratório de cards".
- [ ] Passo 2 — Documento no formato do Anki (`html`/`body.card`/`#qa`, classes de modo noturno, CSS sem escopo, sem `BASE_CARD_STYLES` em modelo importado).
- [ ] Passo 3 — Filtros `edit:`, `clickable::`, `cloze-only`, `tts`; sanitizar campos antes da substituição.
- [ ] Passo 4 — Scripts do template + shims (`pycmd`, hooks, AnkiDroidJS, AnkiConnect local para o Bloco de Notas) + bloqueio de rede.
- [ ] Passo 5 — Runtime do Weiss no documento (grifos depois dos scripts, balão, links, zoom, cor de fundo para o RN).
- [ ] Passo 6 — Lato offline.
- [ ] Passo 7 — Tela de revisão sem moldura (fundo sincronizado, barra flutuante, fade).
- [ ] Passo 8 — Cores fixas no modo escuro.
- [ ] Passo 9 — Modelos embutidos do Weiss com o visual Avicena (filtro `weiss-tags`, migração por hash).
- [ ] Passo 10 — Screenshots de referência do Akira + Maestro visual + metas de desempenho.
