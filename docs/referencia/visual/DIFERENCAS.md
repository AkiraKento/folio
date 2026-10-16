# Auditoria Visual Comparativa — Weiss vs AnkiDroid

Este documento registra a análise comparativa entre as capturas de tela do **AnkiDroid** (`<modelo>-<lado>-<tema>.png`) e as capturas geradas pelo **Weiss** (`weiss-<modelo>-<lado>-<tema>.png`) no Laboratório de Cards e na Tela de Revisão (M10 Passo 10).

---

## 1. Matriz de Comparação dos 8 Cenários

| Cenário | Referência AnkiDroid | Render Weiss | Status | Observações / Paridade |
|---|---|---|---|---|
| **Avicena Frente Claro** | `avicena-frente-claro.png` | `weiss-avicena-frente-claro.png` | **Alinhado** | Tipografia Lato offline (400/700) idêntica; card central com fundo elevado e cantos arredondados; tag em pílula colorida. |
| **Avicena Verso Claro** | `avicena-verso-claro.png` | `weiss-avicena-verso-claro.png` | **Alinhado** | Divisória `<hr id="answer">` correta; seção de referência com estilo sutil; tags em pílulas com o ciclo de 5 cores; fallback de zoom por toque duplo ativo sem interferir no zoom nativo do modelo. |
| **Avicena Frente Escuro** | `avicena-frente-escuro.png` | `weiss-avicena-frente-escuro.png` | **Alinhado** | Classes `.nightMode .night_mode .night-mode` ativadas no `<body>`; fundo noturno profundo (`#031417` / `#062e32`); contraste excelente da fonte Lato. |
| **Avicena Verso Escuro** | `avicena-verso-escuro.png` | `weiss-avicena-verso-escuro.png` | **Alinhado** | Cores de contraste do verso noturno fiéis; sem bordas brancas ou emendas visíveis; barra flutuante sem sobreposição ao conteúdo graças ao padding de 84px. |
| **AnKing Frente Claro** | `anking-frente-claro.png` | `weiss-anking-frente-claro.png` | **Alinhado** | Cloze colorido característico; tags renderizadas em elementos `<kbd>`; barra de controle de botões "One by one" / "Toggle All" visível e interativa. |
| **AnKing Verso Claro** | `anking-verso-claro.png` | `weiss-anking-verso-claro.png` | **Alinhado** | Cloze expandido; botões de acordeão de dicas interativos (Text, Extra, First Aid); bloco de notas funcional com persistência na nota via AnkiConnect local interceptado. |
| **AnKing Frente Escuro** | `anking-frente-escuro.png` | `weiss-anking-frente-escuro.png` | **Alinhado** | Remoção de cores escuras fixas inline (`color: rgb(0,0,0)`) pelo filtro de luminância < 0.25; texto herda cor clara; tags `<kbd>` adaptadas ao fundo noturno. |
| **AnKing Verso Escuro** | `anking-verso-escuro.png` | `weiss-anking-verso-escuro.png` | **Alinhado** | Remoção de cores pretas fixas nas notas antigas sem apagar realces semânticos (ex.: azul `rgb(0,0,255)` permanece visível); blocos de dica e bloco de notas integrados ao fundo escuro. |

---

## 2. Diferenças Deliberadas e Justificadas

As seguintes discrepâncias em relação ao AnkiDroid são **intencionais e conformes à especificação do Weiss** (`docs/PASSO_A_PASSO_REVIEWER_ANKI.md` e `AGENTS.md`):

1. **Bloqueio de Rede para Links Externos (Ex.: Pop-up da Wikipédia do AnKing):**
   - *AnkiDroid:* Pode tentar carregar recursos externos caso o dispositivo esteja online.
   - *Weiss:* 100% offline-first. Requisições externas são interceptadas e bloqueadas com aviso em log. O card renderiza perfeitamente em Modo Avião sem depender de conexões remotas.
2. **Ocultação do Ícone de Link Externo AnKing (`#pic`):**
   - *AnkiDroid:* Exibe o logo/ícone do AnKing com link externo para o site.
   - *Weiss:* Ocultado via CSS de compatibilidade em `#weiss-overlay` (`#pic { display: none !important; }`), mantendo a revisão focada e limpa.
3. **Barra de Respostas Flutuante e Sem Moldura:**
   - *AnkiDroid:* Usa barra sólida na parte inferior com linhas divisórias cinzas do sistema Android clássico.
   - *Weiss:* Reviewer contemporâneo sem moldura, com a barra de respostas flutuando a 92% de opacidade sobre o fundo do card com sombra suave para cima e transição de fundo de 150 ms na mudança de cor.
4. **Fonte Lato Local (`assets/fonts/lato/`):**
   - *AnkiDroid:* Depende de `@import url(fonts.googleapis.com)` (que falha em modo avião se não estiver em cache).
   - *Weiss:* A fonte Lato é servida diretamente do pacote offline via data URLs base64 injetadas no documento (`#weiss-fonts`).

---

## 3. Checklist de Auditoria de Elementos

- [x] Fonte Lato (400, 700, 400 itálico, 700 itálico) carregada localmente sem acesso à internet.
- [x] Zero flashes brancos ao virar o card de frente para verso ou alternar entre cards.
- [x] Barra de status e container superior com a cor exata do fundo do card (`effectiveCardBg`).
- [x] Pílulas de tags do Avicena com o ciclo de 5 cores (`tag-color-1` a `tag-color-5`).
- [x] Tags `<kbd>` e botões de revelação passo a passo do AnKing operacionais.
- [x] Bloco de notas do AnKing persiste dados em `Personal Notes` através do shim AnkiConnect (`127.0.0.1:8765`).
- [x] Ajuste automático de cores fixas no modo escuro sem alteração no modo claro.
- [x] Fallback de zoom por toque duplo disponível para cards e imagens normais.
- [x] Anotações e grifos do Modo Consulta ancorados com precisão após estabilização dos scripts do modelo.
