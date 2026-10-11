# Auditoria do protótipo — Weiss 0.1.1

11/10/2026 · base: código do working tree + APK `d45384cc` · auditoria feita por leitura de código, `npm run check` e inspeção dos `.apkg` de teste. Nada foi alterado no código.

## Resumo

**O que está bom.** O M0–M8 foi entregue inteiro e segue a especificação: o Modo Consulta está completo (âncora portada com os testes da §7, barra, popover, painel, órfãs, busca, "Continuar lendo"), o FSRS está integrado via `ts-fsrs`, o `review_logs` é gravado desde o primeiro dia e a reimportação é idempotente por `source_id`. `tsc`, `eslint` e **614 testes passam**.

**O problema.** Os testes rodam no Node (`node:sqlite`, `node:crypto`, `fs`, jsdom), e quase tudo que quebra no celular está justamente no caminho que só existe no Android: `expo-sqlite`, `expo-file-system`, `expo-crypto` e a WebView. Daí a sensação de "instável": o benchmark de 476 MB passou em 11 s no Node, mas esse mesmo código no telefone tenta montar uma string base64 de mais de 600 MB.

**Por que o 01_MainDeck não importou.** O `CardsReligadosOsler.apkg` tem 2,1 GB (8.654 arquivos, quase tudo imagem), e são **duas causas somadas**:
1. **Memória:** o app lê o arquivo inteiro como texto base64 (cerca de 2,9 GB) antes de qualquer coisa. Não cabe na memória de nenhum Android (P0-1).
2. **Formato:** o arquivo está no formato novo do Anki (`collection.anki21b`, zstd), que o importador não suporta. Mesmo com memória sobrando, ele recusaria, só que depois de carregar os 2 GB (P0-2).

## Prioridades

| sev | o que significa |
|---|---|
| **P0** | trava, fecha o app, perde ou corrompe dado, ou funcionalidade central quebrada no aparelho |
| **P1** | comportamento errado ou lentidão forte com decks grandes |
| **P2** | qualidade, manutenção, segurança preventiva |

---

## P0 — corrigir antes de mandar para testadores

### P0-1 · A importação carrega o arquivo inteiro na memória, várias vezes
- `src/import/useApkgImport.ts:94` lê o `.apkg` inteiro com `readAsStringAsync(..., Base64)` e `:132` guarda essa string no **estado do React** (`setFileBase64`), além do `ref`.
- `src/import/apkgReader.ts:11`: `JSZip.loadAsync(data)` decodifica a string numa segunda cópia binária.
- `src/import/importer.ts:156`: `deserializeDatabaseSync(pkg.databaseBytes)` faz uma terceira cópia (o banco inteiro em RAM).
- `importer.ts:96-117`: cada imagem é convertida de bytes para base64 em JS para ser gravada.
- A prévia (`getApkgPreview`) e a importação (`importApkg`) **descompactam e parseiam tudo duas vezes**.
- `importer.ts:328`: notas, cards e revlog são gravados numa única transação **síncrona** na thread do JS. A tela congela, e a barra de progresso não atualiza porque o React não renderiza no meio de um bloco síncrono.

**Correção:**
1. Descompactar **nativamente para o disco** (ex.: `react-native-zip-archive`, que é dependência nova e precisa da sua aprovação), primeiro listando as entradas para detectar o formato sem carregar nada.
2. Abrir o `collection.anki21` extraído **pelo caminho do arquivo** com `expo-sqlite` (somente leitura), sem `deserialize`.
3. Mídia: **mover** cada arquivo extraído para `media/` com `FileSystem.moveAsync`, renomeando pelo mapa. Deduplicar com hash nativo (`getInfoAsync(uri, { md5: true })`) em vez de SHA-1 em JS.
4. Prévia por SQL (`SELECT count(*)…` por deck), sem montar a coleção em memória. A importação reaproveita a pasta já extraída.
5. Gravar em **lotes de ~500 linhas**, cada lote numa transação assíncrona (`withExclusiveTransactionAsync`), com `await` entre os lotes para a UI respirar e o progresso aparecer. Se a importação for interrompida, a reimportação idempotente por `source_id` já completa o que faltou.
6. Nunca guardar o conteúdo do arquivo em estado do React: só o caminho.

### P0-2 · O formato novo do Anki (`.anki21b`) não é suportado, e a detecção vem tarde demais
- O `01_MainDeck` (`CardsReligadosOsler.apkg`) é `anki21b`. O `Notas Selecionadas.apkg` é legado e por isso passou no benchmark.
- **Paliativo imediato (sem código):** no Anki, exportar marcando **"Suporte a versões antigas"** e, de preferência, por especialidade (como os arquivos da pasta `vega`). Mesmo assim, até o P0-1 ser corrigido, só arquivos pequenos (dezenas de MB) devem importar no celular.
- **Correção definitiva (sobe de P2 para P1):** suportar `anki21b`. O banco vem comprimido com zstd (no 01_MainDeck são só 3,6 MB, então dá para descomprimir em JS com `fzstd`, dependência nova), o mapa de mídia vem em protobuf + zstd e **cada arquivo de mídia vem comprimido com zstd individualmente**. Isso exige descompressão arquivo a arquivo no fluxo do P0-1.

### P0-3 · Imagens importadas não aparecem na Revisão nem na Consulta
- `src/ui/ReviewView.tsx:269`: o `<CardView>` é chamado **sem `mediaBasePath`**, e o `CardView` não tem valor padrão. As imagens ficam com `src="arquivo.jpg"` relativo a `about:blank`.
- Na Consulta (`src/consulta/units.ts` → `src/webview/consulta/*`) não existe reescrita de mídia nenhuma.
- As duas WebViews (`CardView.tsx:193`, `ConsultaView.tsx:444`) usam `source={{ html }}` sem `baseUrl` e sem `allowFileAccess`. No Android moderno, `file://` fica bloqueado por padrão.
- **Confirme no celular** se as imagens dos cards do `Notas Selecionadas` aparecem. Pelo código, não deveriam.

**Correção:** um hook `useMediaDirectory()` único, passado para a revisão e a Consulta; `source={{ html, baseUrl: mediaDir }}` + `allowFileAccess`; `<img loading="lazy" decoding="async">` na Consulta.

### P0-4 · O banco é usado antes de a migração terminar (primeira abertura)
- `app/_layout.tsx:15-31` dispara `initAppDatabase()` sem esperar o resultado e renderiza as telas na hora.
- `app/index.tsx:50-60`: `isOnboardingCompleted()` roda antes de as tabelas existirem, o erro é engolido pelo `catch {}` e a tela segue sem onboarding. Os hooks `useToday`, `useDecks` e `useStats` também consultam tabelas que ainda não existem.
- `src/db/init.ts:25-29`: se a migração falha, só sai um `console.warn` e o app continua com o banco quebrado.

**Correção:** segurar a splash (`SplashScreen.preventAutoHideAsync`) até `dbReady`. Se a migração falhar, mostrar uma tela de erro com "Copiar diagnóstico", e não seguir em frente.

### P0-5 · Sem ErrorBoundary e com 66 `catch {}` silenciosos
- Qualquer exceção de renderização fecha o app no release, e os erros somem sem deixar rastro. Por isso a instabilidade é difícil de diagnosticar.

**Correção:**
- Exportar um `ErrorBoundary` no `app/_layout.tsx` (expo-router suporta).
- Criar um **log local** de erros: arquivo circular em `documentDirectory`, sem dados de estudo, respeitando a regra de privacidade.
- Em Ajustes, botão **"Copiar diagnóstico"** para o testador mandar no WhatsApp.
- Revisar os 66 `catch {}`: cada um vira tratamento real ou `logError(...)`.

### P0-6 · Quase nada está no git
- Há **1 commit** (M0). Os outros ~29 mil linhas e 186 arquivos de M1–M8 estão fora do histórico. Um `git checkout` ou um erro do agente apaga semanas de trabalho.

**Correção:** commitar agora e acrescentar ao workflow `/proxima-tarefa` o passo "commit ao final de cada tarefa".

---

## P1 — decks grandes e comportamento

### P1-1 · Consulta reordena o deck inteiro a cada lote de 30
`src/consulta/units.ts:303-333`: em cada página, o app busca **todas** as notas do deck e ordena em JS com `Intl.Collator`. Com 5 mil notas são ~90 ms (o teste passou); com 48 mil notas, rodando a cada rolagem, vira segundos de travamento.

**Correção:** coluna `sort_key` (caminho do deck normalizado) mantida ao gravar + `ORDER BY sort_key, created_at LIMIT/OFFSET` no SQL. Alternativa: calcular a lista ordenada de ids uma vez por sessão da Consulta e paginar sobre ela.

### P1-2 · A busca da Consulta carrega o deck inteiro com HTML
`units.ts:398+`: com busca ou com o filtro "só com anotação", o app carrega todas as notas, cards e anotações e filtra em JS.

**Correção:** tabela **FTS5** (`notes_fts`, com o texto já sem HTML e sem acento), mantida no insert/update. Busca com `MATCH`. O filtro de anotação vira `EXISTS` no SQL.

### P1-3 · A WebView da Consulta cresce sem limite e não se recupera se morrer
`src/webview/consulta/app.ts` só acrescenta unidades e nunca remove. Lendo um deck com imagens, o processo da WebView acaba morto pelo Android e a tela fica branca: não há `onRenderProcessGone` nem `onContentProcessDidTerminate`.

**Correção:** janela deslizante (~150 unidades ao redor da tela; o resto vira um espaço com a mesma altura) e tratar `onRenderProcessGone` recarregando e voltando à posição salva (`consulta_pos`).

### P1-4 · Card em aprendizado reaparece antes da hora
`src/review/useReviewSession.ts:228-249`: depois de "Errei", o card vai para o fim da fila independentemente do `due`. Com poucos cards na fila, ele volta **na hora**, sem esperar o passo de 1 ou 10 min, e o FSRS registra uma revisão com intervalo ~0.

**Correção:** inserir o card ordenado por `due`. Se o próximo da fila ainda não venceu, mostrar "Próximo card em X min" (o Anki adianta até 20 min).

### P1-5 · Toque duplo responde o mesmo card duas vezes
`useReviewSession.ts:198` (`answerCard`) não tem trava. Dois toques rápidos geram dois `review_logs` e reagendam duas vezes. **Correção:** `ref` de bloqueio + botões desabilitados até o próximo card renderizar.

### P1-6 · A resposta não é atômica
`useReviewSession.ts:215-225`: o update do card, o log e o bury das irmãs são três escritas soltas. Se o app fechar no meio, o estado fica inconsistente. **Correção:** uma transação.

### P1-7 · A fila carrega todos os cards novos a cada montagem
`src/scheduler/queue.ts:118-128`: busca as linhas completas de **todos** os cards novos do deck (num deck tipo Osler, dezenas de milhares) para usar 20. **Correção:** `LIMIT` igual à cota × 3 (folga para as irmãs puladas), selecionando só as colunas necessárias.

### P1-8 · Tudo roda síncrono na thread do JS
Os repositórios usam a API síncrona do drizzle/expo-sqlite. Com coleção grande, os contadores da árvore de decks, as estatísticas sobre `review_logs` e o heatmap congelam a UI ao abrir a tela.

**Correção:** consultas pesadas na API assíncrona e contadores agregados no SQL (`GROUP BY deck_id`). Medir com um **banco sintético de 50 mil cards** (ver P2-1).

### P1-9 · O backup monta o zip inteiro na memória
`src/backup/backupService.ts:241-255`: `zip.generateAsync` + base64 em JS. Assim que alguém importar um deck grande, o backup falha do mesmo jeito que a importação.

**Correção:** `VACUUM INTO` para copiar o banco + zip nativo da pasta `media/` (mesma dependência do P0-1).

### P1-10 · O ramo do "esquema normalizado" do importador está incompleto
`src/import/ankiParser.ts:212-236`: os templates vêm sem `qfmt`/`afmt` (no Anki novo eles ficam num blob protobuf), o CSS fica vazio, o tipo cloze não é detectado e os nomes de deck usam `\x1f` em vez de `::`. Um `.apkg` desse tipo importaria cards em branco. **Correção:** implementar junto com o `anki21b` (P0-2) ou recusar com mensagem clara.

---

## P2 — qualidade e prevenção

- **P2-1 · Testes que não exercitam o aparelho.** Os 614 testes usam `node:sqlite`, `node:crypto` e jsdom; o caminho do Android nunca roda. Acrescentar:
  - fluxos **Maestro** no emulador: importar, revisar 20 cards, rolar 2.000 unidades na Consulta e grifar;
  - um **gerador de deck sintético** (`scripts/gerar-deck-teste.mjs`), com 50 mil notas e 5 mil imagens de placeholder, para os testes de carga.
- **P2-2 · Arquivos da Osler dentro do projeto.** (Atualizado: o uso pessoal dos decks da Osler foi liberado pelo Akira; ver `AGENTS.md`.) Os `.apkg` em `assets/` continuam fora do git pelo `.gitignore`. Para não pesar o editor nem arriscar entrar no bundle, mova-os para uma pasta fora do projeto (ex.: `C:/Users/akira/Projetos/weiss-decks/`) e aponte o benchmark para lá por variável de ambiente.
- **P2-3 · Hash fraco de mídia.** `src/import/importer.ts:57-62`: se o `expo-crypto` falhar, o app usa um hash de 32 bits completado com zeros até 40 caracteres. Duas imagens diferentes podem colidir, e uma imagem errada aparece no card. Remover esse fallback (vira irrelevante com o md5 nativo do P0-1).
- **P2-4 · `originWhitelist={['*']}`** em `CardView.tsx:196` e `ConsultaView.tsx:447` contraria a regra de segurança do `AGENTS.md`. Restringir a `['about:*', 'file://*']`; links externos continuam abrindo fora via `onLinkPress`.
- **P2-5 · `getDb()` em 40 lugares.** Trocar por uma instância única criada no init, com `PRAGMA journal_mode=WAL`, `foreign_keys=ON` e `busy_timeout`.
- **P2-6 · Componentes gigantes.** `SettingsView.tsx` (1.218 linhas), `StatsView.tsx` (970), `ImportView.tsx` (874) e `CardEditorView.tsx` (826) dificultam correções. Quebrar por seção.
- **P2-7 · Texto da release.** "FSRS… superando o SM-2 tradicional do Anki" está desatualizado: o Anki tem FSRS desde a versão 23.10. Num pitch, isso tira credibilidade. Trocar por "FSRS, o mesmo algoritmo do Anki moderno".
- **P2-8 · ID do pacote.** `com.weiss.app` vira permanente quando o app sai na Play Store. Decidir agora (ex.: `com.<seudominio>.weiss`).

## Ordem sugerida

1. P0-6 (commit), P0-5 (ErrorBoundary + log) e P0-4 (gate do banco): rápidos e tornam o resto diagnosticável.
2. P0-3 (imagens).
3. P0-1 (importação em disco e em lotes) + P1-9 (backup), que dividem a mesma base.
4. P1-4, P1-5 e P1-6 (revisão correta).
5. P2-1 (deck sintético + Maestro) **antes** de P1-1, P1-2, P1-3, P1-7 e P1-8, para medir em vez de chutar.
6. P0-2 / P1-10 (anki21b).
