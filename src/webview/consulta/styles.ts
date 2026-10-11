/**
 * Estilos base da WebView do Modo Consulta.
 * Implementa as diretrizes visuais e tokens de MODO_CONSULTA.md §3 e AGENTS.md.
 */

export const BASE_CONSULTA_STYLES = `
:root {
  --folio-canvas-light: #f0f4f0;
  --folio-elevated-light: #ffffff;
  --folio-elevated2-light: #e0e8e8;
  --folio-border-light: #e0e6e6;
  --folio-fg-light: #203e3a;
  --folio-fg-muted-light: #5b858b;
  --folio-accent-light: #3a9d7f;
  --folio-learn-light: #b8941f;

  --folio-canvas-dark: #031417;
  --folio-elevated-dark: #062e32;
  --folio-elevated2-dark: #083f44;
  --folio-border-dark: #083f44;
  --folio-fg-dark: #b2cacd;
  --folio-fg-muted-dark: #87a7ab;
  --folio-accent-dark: #169fb1;
  --folio-learn-dark: #d5971a;

  --consulta-font-size: 17px;
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
  -webkit-user-select: text;
}

.consulta-root {
  min-height: 100vh;
  padding: 16px 12px 64px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Temas */
.consulta-root.theme-light {
  background-color: var(--folio-canvas-light);
  color: var(--folio-fg-light);
  --theme-canvas: var(--folio-canvas-light);
  --theme-elevated: var(--folio-elevated-light);
  --theme-elevated2: var(--folio-elevated2-light);
  --theme-border: var(--folio-border-light);
  --theme-fg: var(--folio-fg-light);
  --theme-fg-muted: var(--folio-fg-muted-light);
  --theme-accent: var(--folio-accent-light);
  --theme-learn: var(--folio-learn-light);
}

.consulta-root.theme-dark {
  background-color: var(--folio-canvas-dark);
  color: var(--folio-fg-dark);
  --theme-canvas: var(--folio-canvas-dark);
  --theme-elevated: var(--folio-elevated-dark);
  --theme-elevated2: var(--folio-elevated2-dark);
  --theme-border: var(--folio-border-dark);
  --theme-fg: var(--folio-fg-dark);
  --theme-fg-muted: var(--folio-fg-muted-dark);
  --theme-accent: var(--folio-accent-dark);
  --theme-learn: var(--folio-learn-dark);
}

/* Coluna de texto centralizada com até 720px */
.consulta-container {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

/* Cabeçalho de Deck (seção) */
.deck-section-header {
  margin-top: 32px;
  margin-bottom: 16px;
  padding: 10px 14px;
  border-radius: 8px;
  background-color: var(--theme-elevated2);
  color: var(--theme-fg-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  border-left: 4px solid var(--theme-accent);
}

.deck-section-header:first-child {
  margin-top: 8px;
}

/* Bloco da Unidade */
.consulta-unit {
  position: relative;
  padding: 18px 0;
  border-bottom: 1px solid var(--theme-border);
  transition: opacity 0.2s ease;
}

.consulta-unit.suspended {
  opacity: 0.55;
}

/* Selo de Suspenso */
.suspended-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
  background-color: var(--theme-elevated2);
  color: var(--theme-fg-muted);
  margin-bottom: 8px;
}

/* Frente esmaecida */
.unit-front {
  font-size: calc(var(--consulta-font-size) * 0.88);
  line-height: 1.45;
  color: var(--theme-fg-muted);
  margin-bottom: 10px;
  font-weight: 500;
  word-break: break-word;
}

/* init.showFront = false: só o verso */
.consulta-root.hide-front .unit-front {
  display: none;
}

/* Verso em serifa de leitura */
.unit-back {
  font-family: "Source Serif 4", Georgia, Cambria, "Times New Roman", serif;
  font-size: var(--consulta-font-size);
  line-height: 1.65;
  color: var(--theme-fg);
  word-break: break-word;
  user-select: text;
  -webkit-user-select: text;
}

/* Lacunas Cloze com todas reveladas */
.cloze {
  color: var(--theme-accent);
  font-weight: 700;
}

/* Rodapé da unidade: Tags e Menu */
.unit-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  min-height: 44px;
}

.unit-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.unit-tag {
  font-size: 12px;
  color: var(--theme-fg-muted);
  background-color: var(--theme-elevated2);
  padding: 3px 8px;
  border-radius: 6px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-weight: 500;
}

/* Botão de menu ⋯ (alvo de toque mínimo 44px) */
.unit-menu-button {
  min-width: 44px;
  min-height: 44px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--theme-fg-muted);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.unit-menu-button:active {
  background-color: var(--theme-elevated2);
  color: var(--theme-fg);
}

/* Menu Dropdown Flutuante */
.unit-menu-dropdown {
  position: absolute;
  right: 0;
  bottom: 48px;
  z-index: 100;
  background-color: var(--theme-elevated);
  border: 1px solid var(--theme-border);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
}

.unit-menu-item {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-fg);
  background: transparent;
  border: none;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
}

.unit-menu-item:active {
  background-color: var(--theme-elevated2);
}

.unit-menu-item.danger {
  color: #e0457b;
}

/* Estilos de Anotação (MODO_CONSULTA.md §3) */
.ann, .cq-mark {
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  border-radius: 3px;
  cursor: pointer;
}

/* Nota associada com símbolo ✎ no final */
.ann.has-note.end::after,
.cq-mark.cq-has-note.cq-end::after {
  content: " \\270E";
  font-size: 0.85em;
  opacity: 0.85;
  font-style: normal;
}

/* goto com annotationId: pisca o grifo */
@keyframes ann-flash-pulse {
  0%, 100% { outline-color: transparent; }
  25%, 75% { outline-color: var(--theme-accent); }
}

.ann.ann-flash {
  outline: 2px solid transparent;
  outline-offset: 1px;
  animation: ann-flash-pulse 0.8s ease-in-out 2;
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

/* Imagens */
.unit-back img, .unit-front img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  display: block;
  margin: 10px auto;
}

/* Tabelas */
.unit-back table, .unit-front table {
  border-collapse: collapse;
  margin: 10px auto;
  max-width: 100%;
}

.theme-light table, .theme-light th, .theme-light td {
  border: 1px solid var(--folio-border-light);
}

.theme-dark table, .theme-dark th, .theme-dark td {
  border: 1px solid var(--folio-border-dark);
}

th, td {
  padding: 6px 10px;
}

/* Detalhes / Dicas */
details {
  margin: 8px 0;
  padding: 6px 10px;
  border-radius: 6px;
  background-color: var(--theme-elevated2);
}

summary {
  cursor: pointer;
  font-weight: 600;
}

/* Sentinela de rolagem infinita */
.scroll-sentinel {
  width: 100%;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-fg-muted);
  font-size: 13px;
  font-weight: 500;
}

/* Barra flutuante de seleção (MODO_CONSULTA.md §3) */
.selection-toolbar {
  position: absolute;
  z-index: 1000;
  display: flex;
  align-items: center;
  background-color: var(--theme-elevated);
  border: 1px solid var(--theme-border);
  border-radius: 28px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 2px 6px;
  gap: 2px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: auto;
  box-sizing: border-box;
  animation: toolbar-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes toolbar-pop {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.toolbar-btn {
  min-width: 44px;
  min-height: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 22px;
  color: var(--theme-fg);
  cursor: pointer;
  padding: 0 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.toolbar-btn:active {
  background-color: var(--theme-elevated2);
  transform: scale(0.96);
}

.toolbar-color-btn {
  min-width: 44px;
  width: 44px;
  padding: 0;
}

.toolbar-color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.toolbar-color-btn:hover .toolbar-color-dot,
.toolbar-color-btn:active .toolbar-color-dot {
  transform: scale(1.15);
}

.toolbar-color-btn.active .toolbar-color-dot {
  box-shadow: 0 0 0 2px var(--theme-elevated), 0 0 0 4px var(--theme-accent);
}

.toolbar-color-dot.color-amarelo { background-color: #f2c94c; }
.toolbar-color-dot.color-verde { background-color: #34a853; }
.toolbar-color-dot.color-azul { background-color: #2f80ed; }
.toolbar-color-dot.color-rosa { background-color: #e0457b; }
.toolbar-color-dot.color-laranja { background-color: #e8711c; }

.toolbar-divider {
  width: 1px;
  height: 24px;
  background-color: var(--theme-border);
  margin: 0 2px;
}

.toolbar-u-icon {
  font-family: serif;
  font-size: 16px;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 2.5px;
}

.toolbar-note-icon {
  font-size: 16px;
}

.toolbar-copy-btn {
  min-width: 64px;
  padding: 0 12px;
}

.toolbar-copy-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--theme-fg);
}

/* Modo nota na barra flutuante */
.toolbar-note-form {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
}

.toolbar-note-input {
  height: 38px;
  min-width: 170px;
  max-width: 260px;
  padding: 0 12px;
  border-radius: 19px;
  border: 1px solid var(--theme-border);
  background-color: var(--theme-canvas);
  color: var(--theme-fg);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.toolbar-note-input:focus {
  border-color: var(--theme-accent);
}

.toolbar-note-save-btn {
  min-width: 44px;
  min-height: 44px;
  color: var(--theme-accent);
  font-size: 16px;
}

.toolbar-note-cancel-btn {
  min-width: 44px;
  min-height: 44px;
  color: var(--theme-fg-muted);
  font-size: 14px;
}

/* Popover do Grifo (MODO_CONSULTA.md §3) */
.highlight-popover {
  position: absolute;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  background-color: var(--theme-elevated);
  border: 1px solid var(--theme-border);
  border-radius: 18px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  padding: 6px 8px;
  gap: 6px;
  user-select: none;
  -webkit-user-select: none;
  pointer-events: auto;
  box-sizing: border-box;
  animation: popover-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  max-width: 95vw;
}

@keyframes popover-pop {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.popover-main-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.popover-btn {
  min-width: 44px;
  min-height: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 22px;
  color: var(--theme-fg);
  cursor: pointer;
  padding: 0 6px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.popover-btn:active {
  background-color: var(--theme-elevated2);
  transform: scale(0.96);
}

.popover-color-btn {
  min-width: 44px;
  width: 44px;
  padding: 0;
}

.popover-color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.popover-color-btn:hover .popover-color-dot,
.popover-color-btn:active .popover-color-dot {
  transform: scale(1.15);
}

.popover-color-btn.active .popover-color-dot {
  box-shadow: 0 0 0 2px var(--theme-elevated), 0 0 0 4px var(--theme-accent);
}

.popover-color-dot.color-amarelo { background-color: #f2c94c; }
.popover-color-dot.color-verde { background-color: #34a853; }
.popover-color-dot.color-azul { background-color: #2f80ed; }
.popover-color-dot.color-rosa { background-color: #e0457b; }
.popover-color-dot.color-laranja { background-color: #e8711c; }

.popover-divider {
  width: 1px;
  height: 24px;
  background-color: var(--theme-border);
  margin: 0 2px;
}

.popover-toggle-btn {
  min-width: 44px;
  width: 44px;
  font-family: serif;
  font-size: 16px;
  font-weight: 700;
}

.popover-toggle-btn.is-ul {
  text-decoration: underline;
  text-decoration-thickness: 2.5px;
}

.popover-delete-btn {
  min-width: 44px;
  width: 44px;
  color: #e0457b;
  font-size: 18px;
}

.popover-delete-btn:hover,
.popover-delete-btn:active {
  background-color: rgba(224, 69, 123, 0.12);
  color: #e0457b;
}

.theme-dark .popover-delete-btn {
  color: #ff7eb0;
}

.theme-dark .popover-delete-btn:hover,
.theme-dark .popover-delete-btn:active {
  background-color: rgba(255, 126, 176, 0.15);
  color: #ff7eb0;
}

.popover-note-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 2px;
  border-top: 1px solid var(--theme-border);
}

.popover-note-input {
  flex: 1;
  height: 38px;
  padding: 0 12px;
  border-radius: 19px;
  border: 1px solid var(--theme-border);
  background-color: var(--theme-canvas);
  color: var(--theme-fg);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.popover-note-input:focus {
  border-color: var(--theme-accent);
}
`;

