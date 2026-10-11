/**
 * Estilos base da WebView de Card, integrando o design system do Folio (tokens do tema)
 * e regras fundamentais de legibilidade para flashcards (cloze, imagens, tabelas).
 */

export const BASE_CARD_STYLES = `
:root {
  --folio-canvas-light: #f0f4f0;
  --folio-elevated-light: #ffffff;
  --folio-border-light: #e0e6e6;
  --folio-fg-light: #203e3a;
  --folio-fg-muted-light: #5b858b;
  --folio-accent-light: #3a9d7f;
  --folio-learn-light: #b8941f;

  --folio-canvas-dark: #031417;
  --folio-elevated-dark: #062e32;
  --folio-border-dark: #083f44;
  --folio-fg-dark: #b2cacd;
  --folio-fg-muted-dark: #87a7ab;
  --folio-accent-dark: #169fb1;
  --folio-learn-dark: #d5971a;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
  background: transparent;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  user-select: text;
}

.card-root {
  min-height: 100vh;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Tema Claro (Calmcoder) */
.card-root.theme-light {
  background-color: var(--folio-canvas-light);
  color: var(--folio-fg-light);
}

/* Tema Escuro (Noctis Obscuro) */
.card-root.theme-dark {
  background-color: var(--folio-canvas-dark);
  color: var(--folio-fg-dark);
}

/* Estilo padrão do card */
.card-root .card {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  font-size: 19px;
  line-height: 1.55;
  word-break: break-word;
}

/* Lacunas Cloze */
.card-root.theme-light .cloze {
  color: var(--folio-accent-light);
  font-weight: 700;
}

.card-root.theme-dark .cloze {
  color: var(--folio-accent-dark);
  font-weight: 700;
}

/* Imagens */
.card-root img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 12px auto;
}

/* Tabelas */
.card-root table {
  border-collapse: collapse;
  margin: 12px auto;
  max-width: 100%;
}

.card-root.theme-light table,
.card-root.theme-light th,
.card-root.theme-light td {
  border: 1px solid var(--folio-border-light);
}

.card-root.theme-dark table,
.card-root.theme-dark th,
.card-root.theme-dark td {
  border: 1px solid var(--folio-border-dark);
}

.card-root th,
.card-root td {
  padding: 8px 12px;
}

/* Detalhes e Dicas */
.card-root details {
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: rgba(0, 0, 0, 0.03);
}

.card-root.theme-dark details {
  background-color: rgba(255, 255, 255, 0.05);
}

.card-root summary {
  cursor: pointer;
  font-weight: 600;
  color: inherit;
}

/* Estilos de Anotação (MODO_CONSULTA.md §3 e §6) */
.ann, .cq-mark {
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  border-radius: 3px;
  cursor: pointer;
}

/* Símbolo ✎ no trecho com nota */
.ann.has-note.end::after,
.cq-mark.cq-has-note.cq-end::after {
  content: " \\270E";
  font-size: 0.85em;
  opacity: 0.85;
  font-style: normal;
}

/* Grifos e Sublinhados - Tema Claro */
.theme-light .ann.hl.c-amarelo,
.theme-light .cq-mark.cq-hl.cq-c-amarelo {
  background-color: rgba(255, 208, 50, 0.45);
}
.theme-light .ann.hl.c-verde,
.theme-light .cq-mark.cq-hl.cq-c-verde {
  background-color: rgba(96, 200, 112, 0.36);
}
.theme-light .ann.hl.c-azul,
.theme-light .cq-mark.cq-hl.cq-c-azul {
  background-color: rgba(80, 160, 255, 0.32);
}
.theme-light .ann.hl.c-rosa,
.theme-light .cq-mark.cq-hl.cq-c-rosa {
  background-color: rgba(255, 110, 165, 0.32);
}
.theme-light .ann.hl.c-laranja,
.theme-light .cq-mark.cq-hl.cq-c-laranja {
  background-color: rgba(255, 145, 50, 0.38);
}

.theme-light .ann.ul.c-amarelo,
.theme-light .cq-mark.cq-ul.cq-c-amarelo {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #d6a400;
  text-decoration-thickness: 2.5px;
}
.theme-light .ann.ul.c-verde,
.theme-light .cq-mark.cq-ul.cq-c-verde {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #34a853;
  text-decoration-thickness: 2.5px;
}
.theme-light .ann.ul.c-azul,
.theme-light .cq-mark.cq-ul.cq-c-azul {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #2f80ed;
  text-decoration-thickness: 2.5px;
}
.theme-light .ann.ul.c-rosa,
.theme-light .cq-mark.cq-ul.cq-c-rosa {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #e0457b;
  text-decoration-thickness: 2.5px;
}
.theme-light .ann.ul.c-laranja,
.theme-light .cq-mark.cq-ul.cq-c-laranja {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #e8711c;
  text-decoration-thickness: 2.5px;
}

/* Grifos e Sublinhados - Tema Escuro */
.theme-dark .ann.hl.c-amarelo,
.theme-dark .cq-mark.cq-hl.cq-c-amarelo {
  background-color: rgba(255, 210, 70, 0.28);
}
.theme-dark .ann.hl.c-verde,
.theme-dark .cq-mark.cq-hl.cq-c-verde {
  background-color: rgba(120, 220, 130, 0.24);
}
.theme-dark .ann.hl.c-azul,
.theme-dark .cq-mark.cq-hl.cq-c-azul {
  background-color: rgba(100, 175, 255, 0.26);
}
.theme-dark .ann.hl.c-rosa,
.theme-dark .cq-mark.cq-hl.cq-c-rosa {
  background-color: rgba(255, 120, 175, 0.26);
}
.theme-dark .ann.hl.c-laranja,
.theme-dark .cq-mark.cq-hl.cq-c-laranja {
  background-color: rgba(255, 160, 80, 0.28);
}

.theme-dark .ann.ul.c-amarelo,
.theme-dark .cq-mark.cq-ul.cq-c-amarelo {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #f2c94c;
  text-decoration-thickness: 2.5px;
}
.theme-dark .ann.ul.c-verde,
.theme-dark .cq-mark.cq-ul.cq-c-verde {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #6fcf7f;
  text-decoration-thickness: 2.5px;
}
.theme-dark .ann.ul.c-azul,
.theme-dark .cq-mark.cq-ul.cq-c-azul {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #6cb2ff;
  text-decoration-thickness: 2.5px;
}
.theme-dark .ann.ul.c-rosa,
.theme-dark .cq-mark.cq-ul.cq-c-rosa {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #ff7eb0;
  text-decoration-thickness: 2.5px;
}
.theme-dark .ann.ul.c-laranja,
.theme-dark .cq-mark.cq-ul.cq-c-laranja {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #ffa25c;
  text-decoration-thickness: 2.5px;
}

/* Balão flutuante de nota (tooltip ao tocar no trecho) */
.card-note-tooltip {
  position: absolute;
  z-index: 1000;
  max-width: 280px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  cursor: pointer;
  word-break: break-word;
}

.theme-light .card-note-tooltip {
  background-color: var(--folio-elevated-light);
  color: var(--folio-fg-light);
  border: 1px solid var(--folio-border-light);
}

.theme-dark .card-note-tooltip {
  background-color: var(--folio-elevated-dark);
  color: var(--folio-fg-dark);
  border: 1px solid var(--folio-border-dark);
}
`;
