# PRD — Weiss

Versão 0.1 · 06/10/2026 · escopo: protótipo Android (APK) para teste fechado

## 1. Em uma frase

**Seus flashcards também são o seu resumo.** Um app de repetição espaçada simples e bonito, em que os mesmos cards servem para *ler* (Modo Consulta, a fase passiva) e para *se testar* (Revisão, a fase ativa).

## 2. Problema

- O Anki funciona, mas tem barreira de entrada: configuração, modelos de card, add-ons e uma interface datada. Muita gente desiste antes de criar o hábito.
- Quem estuda com cards não tem onde *reler* o conteúdo de forma corrida. O card isolado não serve como resumo, e a pessoa acaba mantendo um material paralelo (PDF, caderno).
- Hoje o Modo Consulta com grifos só existe dentro de plataformas fechadas de curso (ex.: Osler, ~R$180/mês, só com o conteúdo delas).

## 3. Para quem (MVP)

- **Persona principal:** estudante de concurso ou de medicina que já tentou o Anki, ou que recebe decks prontos (de cursinho ou de colega) e quer estudar no celular.
- **Persona secundária:** usuário de Anki que quer trazer os decks dele e ganhar o Modo Consulta.

## 4. Hipóteses que o protótipo testa

1. Quem largou o Anki mantém revisão diária por 14 dias neste app (meta: ≥ 40% dos testadores revisam em 10 ou mais dos 14 dias).
2. O Modo Consulta é usado sem que a gente peça (meta: ≥ 50% dos testadores abrem a Consulta 3 ou mais vezes e criam pelo menos 5 grifos).
3. Importar do Anki é o caminho de entrada de quem já tem decks (meta: ≥ 30% dos testadores importam um `.apkg`).

As métricas são contadas **localmente**, numa tela "Estatísticas do teste" que o testador mostra ou exporta. Nada é enviado automaticamente.

## 5. Funcionalidades do MVP

Prioridade: **P0** = sem isso não há teste; **P1** = entra se couber; **P2** = depois do teste.

| # | Funcionalidade | Prioridade |
|---|----------------|------------|
| F1 | **Modo Consulta** (lista de versos, grifo, sublinhado, nota, painel de anotações, busca) | **P0, core** |
| F2 | Grifos da Consulta aparecem no verso durante a revisão | **P0, core** |
| F3 | Revisão com FSRS (`ts-fsrs`), modo de 2 botões (Errei/Acertei) e de 4 botões | P0 |
| F4 | Decks em árvore (`Pai::Filho`), criar/renomear/apagar | P0 |
| F5 | Editor de card: Básico, Básico + invertido, Cloze; imagem da galeria | P0 |
| F6 | Importar `.apkg` (formato legado `collection.anki2`/`anki21`) com mídia | P0 |
| F7 | Tela "Hoje": pendentes, tempo estimado, sequência de dias | P0 |
| F8 | Onboarding: área, minutos por dia, data da prova; cria deck de exemplo | P0 |
| F9 | Backup: exportar/importar tudo (zip com JSON + mídia) | P0 |
| F10 | Importar CSV (frente;verso;tags) | P1 |
| F11 | Heatmap de revisões (estilo GitHub) | P1 |
| F12 | Lembrete diário (expo-notifications) | P1 |
| F13 | Modelos de card prontos por área (ex.: "Artigo de lei", "Caso clínico → conduta") | P1 |
| F14 | Importar `.apkg` novo (`anki21b`, zstd) | P2 |
| F15 | Agrupar notas "irmãs" (mesmo texto, lacunas em notas diferentes) na Consulta | P2 |
| F16 | Login + sincronização (Supabase), versão web | P2 |
| F17 | Premium (plano de estudo, análise), anúncios | P2 |

## 6. Telas

1. **Onboarding** (3 passos): área → minutos/dia + data da prova → tema. No fim, cria o deck de exemplo da área e leva para "Hoje".
2. **Hoje** (início): "X cards para revisar · ~Y min", botão grande **Estudar**, sequência de dias, heatmap (P1), atalho "Continuar lendo" (última posição da Consulta).
3. **Decks**: árvore com contadores (novos / aprendendo / revisão). Cada deck abre o **Detalhe do deck**, com três ações do mesmo tamanho: **Estudar**, **Consultar** e **Adicionar card**.
4. **Revisão**: frente → toque para virar → verso (com grifos) → botões. Barra superior com desfazer, editar, "abrir na Consulta" e progresso.
5. **Consulta**: ver `MODO_CONSULTA.md`.
6. **Editor de card**: escolha do modelo, campos, tags, prévia.
7. **Importar**: escolher arquivo (`.apkg`/`.csv`), prévia (decks, nº de notas, mídia), importar com progresso.
8. **Estatísticas**: revisões por dia, retenção real, cards por estado e o bloco "Estatísticas do teste" (seção 4).
9. **Ajustes**: tema, cards novos por dia (padrão 20), máximo de revisões por dia (padrão 200), retenção desejada (padrão 0,90), modo de botões (2/4), virada do dia (padrão 4h), grifos na revisão (liga/desliga), backup.

## 7. Modelo de dados (SQLite via drizzle)

Toda tabela tem também `created_at`, `updated_at` e `deleted_at` (inteiros, ms UTC).

```
decks        id, name (caminho completo "A::B"), area, description,
             source_id (id original do Anki, se importado)
note_types   id, name, kind ('basic'|'basic_reversed'|'cloze'|'custom'),
             fields (json: [{name, ord}]),
             templates (json: [{name, ord, front, back}]), css, source_id
notes        id, note_type_id, deck_id, fields (json: {nome: html}),
             tags (json: string[]), source_id
cards        id, note_id, deck_id, ord,
             -- estado FSRS (espelha o Card do ts-fsrs)
             due, stability, difficulty, elapsed_days, scheduled_days,
             learning_steps, reps, lapses, state, last_review,
             suspended (0/1), buried_until, source_id
review_logs  id, card_id, rating, state, due, stability, difficulty,
             elapsed_days, last_elapsed_days, scheduled_days, review_ms,
             reviewed_at
annotations  (ver MODO_CONSULTA.md §4)
media        id, filename, sha1, bytes, mime
settings     key, value (json)
consulta_pos deck_query, unit_index, scroll_offset   -- "continuar lendo"
```

- `review_logs` é gravado desde o primeiro dia: ele permite otimizar os pesos do FSRS por usuário no futuro.
- A mídia fica em `FileSystem.documentDirectory + 'media/'` e é referenciada pelo nome do arquivo no HTML, como no Anki.

## 8. Renderização de card

- Motor de template próprio e simples em `src/render/`: `{{Campo}}`, `{{FrontSide}}`, `{{cloze:Campo}}`, `{{#Campo}}…{{/Campo}}`, `{{^Campo}}…{{/Campo}}`, `{{hint:Campo}}`, `{{text:Campo}}`, `{{type:Campo}}` (mostra o campo, sem digitação no MVP). Filtros desconhecidos: mostram o campo cru e registram um aviso.
- Cloze: `{{c1::texto}}` e `{{c1::texto::dica}}`. Na frente, o cloze ativo vira `[...]` (ou `[dica]`); no verso, `<span class="cloze">texto</span>`. Os inativos aparecem como texto normal.
- O HTML final passa pelo DOMPurify dentro da WebView. O CSS do note type é aplicado com escopo (`.card-root …`) para não vazar.

## 9. Agendamento

- `ts-fsrs` com os parâmetros padrão, `request_retention` vindo de Ajustes e `enable_short_term: true`.
- No modo de 2 botões: **Errei** = `Rating.Again`, **Acertei** = `Rating.Good`.
- Fila do dia: aprendizado vencido → revisões vencidas (mais atrasadas primeiro, até o limite) → novos (até o limite diário, na ordem do deck). Irmãs da mesma nota não aparecem no mesmo dia (bury simples).
- Mostrar sobre cada botão o próximo intervalo ("10 min", "3 d").

## 10. Importação `.apkg`

1. Descompactar com jszip. Se houver `collection.anki21b` sem `collection.anki21`/`anki2`, avisar: "Exporte de novo no Anki marcando *Suporte a versões antigas*" (o formato novo é P2).
2. Copiar o banco extraído para o diretório do SQLite e abrir com `expo-sqlite` (somente leitura).
3. Ler `col.models`/`col.decks` (JSON no esquema antigo) ou as tabelas `notetypes`/`decks`/`fields`/`templates` (esquema novo do anki21). Ler `notes` (campos separados por `\x1f`) e `cards`.
4. Estado de agendamento: se `cards.data` tiver `{"s":…, "d":…}` (FSRS do Anki 23.10+), importar stability e difficulty e calcular `due` a partir de `cards.due` e `ivl`. Senão, oferecer duas opções: "manter intervalos (aproximado)", que usa `stability ≈ ivl`, ou "começar como novos".
5. Importar o `revlog` para `review_logs`.
6. Mídia: o arquivo `media` (JSON `{"0": "nome.jpg"}`) mapeia os arquivos numerados.
7. Tudo numa transação; cada linha guarda `source_id`, para que reimportar o mesmo deck atualize em vez de duplicar.

## 11. Fora do escopo do MVP

Login, nuvem, web, iOS, pagamentos, anúncios, IA dentro do app, oclusão de imagem, áudio/TTS, decks compartilhados, edição de templates por interface (os templates importados são usados como vieram).

## 12. Critérios de pronto do MVP (para gerar o APK de teste)

- Um `.apkg` legado de 5.000 cards com imagens importa em menos de 60 s num Android intermediário, sem perder mídia.
- A Consulta de um deck de 5.000 cards mostra o primeiro lote em menos de 1 s, e a rolagem não engasga.
- Um grifo criado na Consulta aparece no verso na revisão e sobrevive à edição do card (desde que o trecho continue existindo).
- 14 dias de uso simulado (avançando o relógio em teste) não geram card perdido, duplicado ou com `due` inválido.
- Backup exportado e reimportado num aparelho limpo reproduz decks, cards, estados FSRS, anotações e mídia.
