/**
 * Estilos para o documento de card do Weiss:
 * - WEISS_RESET_STYLES: reset mínimo (margin/padding 0 e text-size-adjust)
 * - WEISS_OVERLAY_STYLES: grifos da Consulta, balão de nota e ocultações de compatibilidade
 * - BASE_CARD_STYLES: aplicado SOMENTE em modelos embutidos do Weiss ou quando o CSS do modelo está vazio
 */

export const WEISS_RESET_STYLES = `
html, body {
  margin: 0;
  padding: 0;
  -webkit-text-size-adjust: 100%;
}
`;

export const WEISS_OVERLAY_STYLES = `
/* Ocultações de compatibilidade AnKing (Passo 4) */
#pic {
  display: none !important;
}

/* Estilos de Anotação da Consulta (MODO_CONSULTA.md §3 e §6) */
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

/* Grifos e Sublinhados - Tema Claro (padrão body.card sem .nightMode ou .theme-light) */
body.card:not(.nightMode) .ann.hl.c-amarelo,
body.card:not(.nightMode) .cq-mark.cq-hl.cq-c-amarelo,
.theme-light .ann.hl.c-amarelo,
.theme-light .cq-mark.cq-hl.cq-c-amarelo {
  background-color: rgba(255, 208, 50, 0.45);
}
body.card:not(.nightMode) .ann.hl.c-verde,
body.card:not(.nightMode) .cq-mark.cq-hl.cq-c-verde,
.theme-light .ann.hl.c-verde,
.theme-light .cq-mark.cq-hl.cq-c-verde {
  background-color: rgba(96, 200, 112, 0.36);
}
body.card:not(.nightMode) .ann.hl.c-azul,
body.card:not(.nightMode) .cq-mark.cq-hl.cq-c-azul,
.theme-light .ann.hl.c-azul,
.theme-light .cq-mark.cq-hl.cq-c-azul {
  background-color: rgba(80, 160, 255, 0.32);
}
body.card:not(.nightMode) .ann.hl.c-rosa,
body.card:not(.nightMode) .cq-mark.cq-hl.cq-c-rosa,
.theme-light .ann.hl.c-rosa,
.theme-light .cq-mark.cq-hl.cq-c-rosa {
  background-color: rgba(255, 110, 165, 0.32);
}
body.card:not(.nightMode) .ann.hl.c-laranja,
body.card:not(.nightMode) .cq-mark.cq-hl.cq-c-laranja,
.theme-light .ann.hl.c-laranja,
.theme-light .cq-mark.cq-hl.cq-c-laranja {
  background-color: rgba(255, 145, 50, 0.38);
}

body.card:not(.nightMode) .ann.ul.c-amarelo,
body.card:not(.nightMode) .cq-mark.cq-ul.cq-c-amarelo,
.theme-light .ann.ul.c-amarelo,
.theme-light .cq-mark.cq-ul.cq-c-amarelo {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #d6a400;
  text-decoration-thickness: 2.5px;
}
body.card:not(.nightMode) .ann.ul.c-verde,
body.card:not(.nightMode) .cq-mark.cq-ul.cq-c-verde,
.theme-light .ann.ul.c-verde,
.theme-light .cq-mark.cq-ul.cq-c-verde {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #34a853;
  text-decoration-thickness: 2.5px;
}
body.card:not(.nightMode) .ann.ul.c-azul,
body.card:not(.nightMode) .cq-mark.cq-ul.cq-c-azul,
.theme-light .ann.ul.c-azul,
.theme-light .cq-mark.cq-ul.cq-c-azul {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #2f80ed;
  text-decoration-thickness: 2.5px;
}
body.card:not(.nightMode) .ann.ul.c-rosa,
body.card:not(.nightMode) .cq-mark.cq-ul.cq-c-rosa,
.theme-light .ann.ul.c-rosa,
.theme-light .cq-mark.cq-ul.cq-c-rosa {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #e0457b;
  text-decoration-thickness: 2.5px;
}
body.card:not(.nightMode) .ann.ul.c-laranja,
body.card:not(.nightMode) .cq-mark.cq-ul.cq-c-laranja,
.theme-light .ann.ul.c-laranja,
.theme-light .cq-mark.cq-ul.cq-c-laranja {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #e8711c;
  text-decoration-thickness: 2.5px;
}

/* Grifos e Sublinhados - Tema Escuro (.nightMode, .night_mode, .night-mode ou .theme-dark) */
.nightMode .ann.hl.c-amarelo,
.nightMode .cq-mark.cq-hl.cq-c-amarelo,
.theme-dark .ann.hl.c-amarelo,
.theme-dark .cq-mark.cq-hl.cq-c-amarelo {
  background-color: rgba(255, 210, 70, 0.28);
}
.nightMode .ann.hl.c-verde,
.nightMode .cq-mark.cq-hl.cq-c-verde,
.theme-dark .ann.hl.c-verde,
.theme-dark .cq-mark.cq-hl.cq-c-verde {
  background-color: rgba(120, 220, 130, 0.24);
}
.nightMode .ann.hl.c-azul,
.nightMode .cq-mark.cq-hl.cq-c-azul,
.theme-dark .ann.hl.c-azul,
.theme-dark .cq-mark.cq-hl.cq-c-azul {
  background-color: rgba(100, 175, 255, 0.26);
}
.nightMode .ann.hl.c-rosa,
.nightMode .cq-mark.cq-hl.cq-c-rosa,
.theme-dark .ann.hl.c-rosa,
.theme-dark .cq-mark.cq-hl.cq-c-rosa {
  background-color: rgba(255, 120, 175, 0.26);
}
.nightMode .ann.hl.c-laranja,
.nightMode .cq-mark.cq-hl.cq-c-laranja,
.theme-dark .ann.hl.c-laranja,
.theme-dark .cq-mark.cq-hl.cq-c-laranja {
  background-color: rgba(255, 160, 80, 0.28);
}

.nightMode .ann.ul.c-amarelo,
.nightMode .cq-mark.cq-ul.cq-c-amarelo,
.theme-dark .ann.ul.c-amarelo,
.theme-dark .cq-mark.cq-ul.cq-c-amarelo {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #f2c94c;
  text-decoration-thickness: 2.5px;
}
.nightMode .ann.ul.c-verde,
.nightMode .cq-mark.cq-ul.cq-c-verde,
.theme-dark .ann.ul.c-verde,
.theme-dark .cq-mark.cq-ul.cq-c-verde {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #6fcf7f;
  text-decoration-thickness: 2.5px;
}
.nightMode .ann.ul.c-azul,
.nightMode .cq-mark.cq-ul.cq-c-azul,
.theme-dark .ann.ul.c-azul,
.theme-dark .cq-mark.cq-ul.cq-c-azul {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #6cb2ff;
  text-decoration-thickness: 2.5px;
}
.nightMode .ann.ul.c-rosa,
.nightMode .cq-mark.cq-ul.cq-c-rosa,
.theme-dark .ann.ul.c-rosa,
.theme-dark .cq-mark.cq-ul.cq-c-rosa {
  background: transparent;
  text-decoration: underline;
  text-decoration-color: #ff7eb0;
  text-decoration-thickness: 2.5px;
}
.nightMode .ann.ul.c-laranja,
.nightMode .cq-mark.cq-ul.cq-c-laranja,
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
  background-color: #ffffff;
  color: #203e3a;
  border: 1px solid #e0e6e6;
}

.nightMode .card-note-tooltip,
.theme-dark .card-note-tooltip {
  background-color: #062e32;
  color: #b2cacd;
  border: 1px solid #083f44;
}
`;

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

body.card {
  padding: 20px 16px;
  background-color: var(--folio-canvas-light);
  color: var(--folio-fg-light);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 19px;
  line-height: 1.55;
  word-break: break-word;
}

body.card.nightMode {
  background-color: var(--folio-canvas-dark);
  color: var(--folio-fg-dark);
}

body.card #qa {
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
}

body.card:not(.nightMode) .cloze,
.card-root.theme-light .cloze {
  color: var(--folio-accent-light);
  font-weight: 700;
}

body.card.nightMode .cloze,
.card-root.theme-dark .cloze {
  color: var(--folio-accent-dark);
  font-weight: 700;
}

body.card img,
.card-root img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 12px auto;
}

body.card table,
.card-root table {
  border-collapse: collapse;
  margin: 12px auto;
  max-width: 100%;
}

body.card:not(.nightMode) table,
body.card:not(.nightMode) th,
body.card:not(.nightMode) td,
.card-root.theme-light table,
.card-root.theme-light th,
.card-root.theme-light td {
  border: 1px solid var(--folio-border-light);
}

body.card.nightMode table,
body.card.nightMode th,
body.card.nightMode td,
.card-root.theme-dark table,
.card-root.theme-dark th,
.card-root.theme-dark td {
  border: 1px solid var(--folio-border-dark);
}

body.card th,
body.card td,
.card-root th,
.card-root td {
  padding: 8px 12px;
}

${WEISS_OVERLAY_STYLES}
`;
