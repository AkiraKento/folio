/**
 * Âncoras de texto (compartilhado entre a Consulta e a revisão).
 * Porte direto de docs/referencia/anchor.js para TypeScript estrito.
 * Ver docs/MODO_CONSULTA.md §5 e §7.
 *
 * Uma anotação guarda o trecho exato (quote), ~40 caracteres antes/depois
 * (prefix/suffix) e a posição no texto do card (start/end). Para reencontrar:
 *   1. a posição ainda tem o mesmo trecho -> usa;
 *   2. senão, procura o trecho e escolhe a ocorrência com o contexto mais
 *      parecido (e mais perto da posição antiga);
 *   3. senão, tenta de novo ignorando diferenças de espaço;
 *   4. senão, a anotação fica "órfã" (o card mudou) e é listada à parte.
 *
 * Grifar = embrulhar os pedaços de texto em <mark class="cq-mark ann ...">.
 * Isso não muda o textContent, preservando posições de outras anotações
 * e permitindo sobreposições aninhadas.
 */

export const CTX = 40;

const SKIP: Record<string, boolean> = {
  SCRIPT: true,
  STYLE: true,
  NOSCRIPT: true,
  TEXTAREA: true,
  BUTTON: true,
};

/**
 * Verifica se um elemento deve ser ignorado como texto âncora (M10 Passo 5):
 * tags de script/estilo/botão e containers de tags/bloco de notas dos modelos Anki.
 */
export function shouldSkipAnchorElement(el: Element): boolean {
  const tagName = el.nodeName ? el.nodeName.toUpperCase() : '';
  if (SKIP[tagName]) {
    return true;
  }
  const id = el.id || '';
  if (id === 'tags-container' || id === 'action-container' || id === 'reload-imgs-btn') {
    return true;
  }
  const cn = el.className;
  if (typeof cn === 'string' && cn.length > 0) {
    if (
      cn.indexOf('tags-container') !== -1 ||
      cn.indexOf('notepad-wrapper') !== -1 ||
      cn.indexOf('tag-pill') !== -1 ||
      cn.indexOf('card-note-tooltip') !== -1 ||
      cn.indexOf('weiss-zoom-overlay') !== -1
    ) {
      return true;
    }
  }
  return false;
}

// Constantes numéricas do DOM para compatibilidade sem depender de variáveis globais
const DOCUMENT_NODE_TYPE = 9;
const TEXT_NODE_TYPE = 3;

export type AnnotationKind = 'hl' | 'ul';

export type AnnotationColor = 'amarelo' | 'verde' | 'azul' | 'rosa' | 'laranja';

export interface DescribedRange {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
}

export interface AnnotationData {
  id: string;
  note_id?: string;
  group_key?: string | null;
  kind: AnnotationKind;
  color: AnnotationColor;
  quote: string;
  prefix?: string;
  suffix?: string;
  start?: number;
  end?: number;
  note?: string;
  label?: string;
}

export interface AnnotationLocateQuery {
  quote?: string;
  prefix?: string;
  suffix?: string;
  start?: number;
  end?: number;
}

export interface AnnotationDecorateInput {
  id: string;
  kind?: string;
  color?: string;
  note?: string;
}

function getOwnerDocument(node: Node): Document {
  if (node.nodeType === DOCUMENT_NODE_TYPE) {
    return node as Document;
  }
  return (
    node.ownerDocument ||
    (typeof document !== 'undefined' ? document : (null as unknown as Document))
  );
}

export function extractAnchorText(root: Node): string {
  if (!root.lastChild && (!root.childNodes || root.childNodes.length === 0)) {
    return root.textContent || '';
  }
  const nodes = textNodes(root);
  let out = '';
  for (let i = 0; i < nodes.length; i++) {
    out += nodes[i].data;
  }
  return out;
}

function textOffset(root: Node, node: Node, offset: number): number {
  const nodes = textNodes(root);
  if (node.nodeType === TEXT_NODE_TYPE) {
    let pos = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] === node) {
        return pos + Math.min(Math.max(0, offset), nodes[i].data.length);
      }
      pos += nodes[i].data.length;
    }
  }

  const doc = getOwnerDocument(root);
  if (!doc) return -1;
  const r = doc.createRange();
  r.setStart(root, 0);
  try {
    r.setEnd(node, offset);
  } catch {
    return -1;
  }

  if (typeof r.comparePoint === 'function') {
    let pos = 0;
    for (let i = 0; i < nodes.length; i++) {
      const tn = nodes[i];
      try {
        if (r.comparePoint(tn, tn.data.length) <= 0) {
          pos += tn.data.length;
          continue;
        }
        if (r.comparePoint(tn, 0) > 0) {
          break;
        }
      } catch {
        return r.toString().length;
      }
    }
    return pos;
  }

  return r.toString().length;
}

/**
 * Seleção (Range dentro de root) -> {start, end, quote, prefix, suffix}
 */
export function describe(root: Element, range: Range): DescribedRange | null {
  const r = range.cloneRange();
  if (!root.contains(r.startContainer)) {
    r.setStart(root, 0);
  }
  if (!root.contains(r.endContainer)) {
    r.setEnd(root, root.childNodes.length);
  }
  const text = extractAnchorText(root);
  let start = textOffset(root, r.startContainer, r.startOffset);
  let end = textOffset(root, r.endContainer, r.endOffset);
  if (start < 0 || end < 0) return null;

  while (start < end && /\s/.test(text.charAt(start))) start++;
  while (end > start && /\s/.test(text.charAt(end - 1))) end--;
  if (end <= start) return null;

  return {
    start,
    end,
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CTX), start),
    suffix: text.slice(end, end + CTX),
  };
}

function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charAt(i) === b.charAt(i)) i++;
  return i;
}

function commonSuffix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charAt(a.length - 1 - i) === b.charAt(b.length - 1 - i)) i++;
  return i;
}

function score(
  text: string,
  s: number,
  e: number,
  ann: { prefix?: string; suffix?: string; start?: number }
): number {
  const pre = commonSuffix(text.slice(Math.max(0, s - CTX), s), ann.prefix || '');
  const suf = commonPrefix(text.slice(e, e + CTX), ann.suffix || '');
  return (pre + suf) * 1000 - Math.abs(s - (ann.start || 0));
}

function bestOf(
  text: string,
  quote: string,
  ann: { prefix?: string; suffix?: string; start?: number }
): [number, number] | null {
  if (!quote) return null;
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    const sc = score(text, i, i + quote.length, ann);
    if (sc > bestScore) {
      bestScore = sc;
      best = [i, i + quote.length];
    }
  }
  return best;
}

/**
 * Texto com espaços colapsados + mapa índice-normalizado -> índice-original
 */
export function squash(text: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let inWs = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charAt(i);
    if (/\s/.test(c)) {
      if (inWs) continue;
      inWs = true;
      out.push(' ');
    } else {
      inWs = false;
      out.push(c);
    }
    map.push(i);
  }
  map.push(text.length);
  return { text: out.join(''), map };
}

/**
 * Reencontra o trecho no elemento root conforme as 4 etapas de MODO_CONSULTA.md §5.
 */
export function locate(root: Node, ann: AnnotationLocateQuery): [number, number] | null {
  const text = extractAnchorText(root);
  const q = ann.quote || '';
  if (!q) return null;

  // 1. Posição exata salva
  if (
    typeof ann.start === 'number' &&
    typeof ann.end === 'number' &&
    ann.start >= 0 &&
    ann.end <= text.length &&
    text.slice(ann.start, ann.end) === q
  ) {
    return [ann.start, ann.end];
  }

  // 2. Busca exata com contexto mais semelhante
  const hit = bestOf(text, q, ann);
  if (hit) return hit;

  // 3. Busca com espaços colapsados
  const sq = squash(text);
  const nq = squash(q).text.trim();
  if (!nq) return null;

  const nann = {
    prefix: squash(ann.prefix || '').text,
    suffix: squash(ann.suffix || '').text,
    start: 0,
  };

  // Posição antiga traduzida para o texto normalizado (aproximada)
  for (let k = 0; k < sq.map.length; k++) {
    if (sq.map[k] >= (ann.start || 0)) {
      nann.start = k;
      break;
    }
  }

  const nh = bestOf(sq.text, nq, nann);
  if (!nh) return null;

  return [sq.map[nh[0]], sq.map[nh[1] - 1] + 1];
}

function textNodes(root: Node): Text[] {
  if (root.nodeType === TEXT_NODE_TYPE) {
    return [root as Text];
  }
  const out: Text[] = [];
  const stack: Node[] = [];
  let child = root.lastChild;
  while (child) {
    stack.push(child);
    child = child.previousSibling;
  }
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.nodeType === TEXT_NODE_TYPE) {
      out.push(node as Text);
    } else if (node.nodeType === 1) {
      if (!shouldSkipAnchorElement(node as Element)) {
        let c = node.lastChild;
        while (c) {
          stack.push(c);
          c = c.previousSibling;
        }
      }
    }
  }
  return out;
}

function applyClasses(
  marks: HTMLElement[] | NodeListOf<HTMLElement>,
  ann: AnnotationDecorateInput
): number {
  const kind = ann.kind === 'ul' ? 'ul' : 'hl';
  const color = ann.color || 'amarelo';
  const hasNote = Boolean(ann.note && ann.note.trim().length > 0);
  const baseClass = `cq-mark ann cq-${kind} ${kind} cq-c-${color} c-${color}${
    hasNote ? ' cq-has-note has-note' : ''
  }`;
  const endClass = `${baseClass} cq-end end`;

  const total = marks.length;
  for (let i = 0; i < total; i++) {
    marks[i].className = i === total - 1 ? endClass : baseClass;
  }
  return total;
}

/**
 * Retorna todos os elementos <mark> associados a um id de anotação.
 */
export function marksOf(root: Element, aid: string): NodeListOf<HTMLElement> {
  const safeAid = aid.replace(/"/g, '\\"');
  return root.querySelectorAll<HTMLElement>(`mark[data-aid="${safeAid}"]`);
}

/**
 * Atualiza classes de estilização nos <mark> da anotação conforme kind, color e note.
 */
export function decorate(root: Element, ann: AnnotationDecorateInput): number {
  return applyClasses(marksOf(root, ann.id), ann);
}

/**
 * Envolve os trechos de nós de texto no intervalo [start, end] em elementos <mark>.
 */
export function wrap(
  root: Element,
  start: number,
  end: number,
  ann: AnnotationDecorateInput
): HTMLElement[] {
  const nodes = textNodes(root);
  let pos = 0;
  const marks: HTMLElement[] = [];
  const doc = getOwnerDocument(root);
  if (!doc) return marks;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const len = node.data.length;
    const ns = pos;
    const ne = pos + len;
    pos = ne;

    if (ne <= start) continue;
    if (ns >= end) break;
    if (!node.parentNode || SKIP[node.parentNode.nodeName.toUpperCase()]) continue;

    const a = Math.max(start, ns) - ns;
    const b = Math.min(end, ne) - ns;
    let target = node;

    if (b < len) {
      target.splitText(b);
    }
    if (a > 0) {
      target = target.splitText(a);
    }

    if (!/\S/.test(target.data)) continue; // espaço entre blocos: não pinta

    const m = doc.createElement('mark');
    m.setAttribute('data-aid', ann.id);
    target.parentNode?.insertBefore(m, target);
    m.appendChild(target);
    marks.push(m);
  }

  applyClasses(marks, ann);
  return marks;
}

/**
 * Remove os elementos <mark> de uma anotação, preservando seus filhos e o DOM.
 */
export function unwrap(root: Element, aid: string): void {
  const ms = marksOf(root, aid);
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const p = m.parentNode;
    if (!p) continue;
    while (m.firstChild) {
      p.insertBefore(m.firstChild, m);
    }
    p.removeChild(m);
    p.normalize();
  }
}

/**
 * Remove todos os <mark> de anotação de root.
 */
export function unwrapAll(root: Element): void {
  const ms = root.querySelectorAll<HTMLElement>('mark[data-aid], mark.cq-mark, mark.ann');
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i];
    const p = m.parentNode;
    if (!p) continue;
    while (m.firstChild) {
      p.insertBefore(m.firstChild, m);
    }
    p.removeChild(m);
    p.normalize();
  }
}

/**
 * Aplica uma lista de anotações; devolve as que não acharam lugar (órfãs).
 */
export function apply<T extends AnnotationDecorateInput & AnnotationLocateQuery>(
  root: Element,
  anns: T[]
): T[] {
  const orphans: T[] = [];
  const sorted = anns.slice().sort((x, y) => (x.start || 0) - (y.start || 0));
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const loc = locate(root, a);
    if (!loc || !wrap(root, loc[0], loc[1], a).length) {
      orphans.push(a);
    }
  }
  return orphans;
}

// Expõe globalmente em window.CQA quando rodando no navegador / WebView
if (typeof window !== 'undefined') {
  (window as unknown as { CQA?: unknown }).CQA = {
    describe,
    locate,
    wrap,
    unwrap,
    unwrapAll,
    decorate,
    marksOf,
    apply,
    squash,
  };
}
