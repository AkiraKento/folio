/*
 * REFERÊNCIA: âncoras de texto do add-on ConsultaCards (Anki desktop, do Akira).
 * Portar para src/webview/shared/anchor.ts mantendo o comportamento.
 * Ver docs/MODO_CONSULTA.md §5 e §7.
 */
/*
 * Âncoras de texto (compartilhado entre a Consulta e a revisão).
 *
 * Uma anotação guarda o trecho exato (quote), ~40 caracteres antes/depois
 * (prefix/suffix) e a posição no texto do card (start/end). Para reencontrar:
 *   1. a posição ainda tem o mesmo trecho -> usa;
 *   2. senão, procura o trecho e escolhe a ocorrência com o contexto mais
 *      parecido (e mais perto da posição antiga);
 *   3. senão, tenta de novo ignorando diferenças de espaço;
 *   4. senão, a anotação fica "órfã" (o card mudou) e é listada à parte.
 *
 * Grifar = embrulhar os pedaços de texto em <mark class="cq-mark">. Isso
 * não muda o textContent, então as posições das outras anotações seguem
 * valendo e anotações sobrepostas viram <mark> aninhados.
 */
(function () {
  "use strict";

  var CTX = 40;
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };

  function textOffset(root, node, offset) {
    var r = document.createRange();
    r.setStart(root, 0);
    try {
      r.setEnd(node, offset);
    } catch (e) {
      return -1;
    }
    return r.toString().length;
  }

  /* Seleção (Range dentro de root) -> {start, end, quote, prefix, suffix} */
  function describe(root, range) {
    var r = range.cloneRange();
    if (!root.contains(r.startContainer)) r.setStart(root, 0);
    if (!root.contains(r.endContainer)) r.setEnd(root, root.childNodes.length);
    var text = root.textContent;
    var start = textOffset(root, r.startContainer, r.startOffset);
    var end = textOffset(root, r.endContainer, r.endOffset);
    if (start < 0 || end < 0) return null;
    while (start < end && /\s/.test(text.charAt(start))) start++;
    while (end > start && /\s/.test(text.charAt(end - 1))) end--;
    if (end <= start) return null;
    return {
      start: start,
      end: end,
      quote: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CTX), start),
      suffix: text.slice(end, end + CTX),
    };
  }

  function commonPrefix(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charAt(i) === b.charAt(i)) i++;
    return i;
  }

  function commonSuffix(a, b) {
    var n = Math.min(a.length, b.length), i = 0;
    while (i < n && a.charAt(a.length - 1 - i) === b.charAt(b.length - 1 - i)) i++;
    return i;
  }

  function score(text, s, e, ann) {
    var pre = commonSuffix(text.slice(Math.max(0, s - CTX), s), ann.prefix || "");
    var suf = commonPrefix(text.slice(e, e + CTX), ann.suffix || "");
    return (pre + suf) * 1000 - Math.abs(s - (ann.start || 0));
  }

  function bestOf(text, quote, ann) {
    var best = null, bestScore = -Infinity;
    if (!quote) return null;
    for (var i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
      var sc = score(text, i, i + quote.length, ann);
      if (sc > bestScore) {
        bestScore = sc;
        best = [i, i + quote.length];
      }
    }
    return best;
  }

  /* texto com espaços colapsados + mapa índice-normalizado -> índice-original */
  function squash(text) {
    var out = [], map = [], inWs = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (/\s/.test(c)) {
        if (inWs) continue;
        inWs = true;
        out.push(" ");
      } else {
        inWs = false;
        out.push(c);
      }
      map.push(i);
    }
    map.push(text.length);
    return { text: out.join(""), map: map };
  }

  function locate(root, ann) {
    var text = root.textContent;
    var q = ann.quote || "";
    if (!q) return null;
    if (text.slice(ann.start, ann.end) === q) return [ann.start, ann.end];
    var hit = bestOf(text, q, ann);
    if (hit) return hit;
    var sq = squash(text);
    var nq = squash(q).text.trim();
    var nann = {
      prefix: squash(ann.prefix || "").text,
      suffix: squash(ann.suffix || "").text,
      start: 0,
    };
    // posição antiga traduzida para o texto normalizado (aproximada)
    for (var k = 0; k < sq.map.length; k++) {
      if (sq.map[k] >= (ann.start || 0)) {
        nann.start = k;
        break;
      }
    }
    var nh = bestOf(sq.text, nq, nann);
    if (!nh) return null;
    return [sq.map[nh[0]], sq.map[nh[1] - 1] + 1];
  }

  function textNodes(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var out = [], n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  function wrap(root, start, end, ann) {
    var nodes = textNodes(root), pos = 0, marks = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], len = node.data.length;
      var ns = pos, ne = pos + len;
      pos = ne;
      if (ne <= start) continue;
      if (ns >= end) break;
      if (!node.parentNode || SKIP[node.parentNode.nodeName]) continue;
      var a = Math.max(start, ns) - ns, b = Math.min(end, ne) - ns;
      var target = node;
      if (b < len) target.splitText(b);
      if (a > 0) target = target.splitText(a);
      if (!/\S/.test(target.data)) continue; // espaço entre blocos: não pinta
      var m = document.createElement("mark");
      m.className = "cq-mark";
      m.setAttribute("data-aid", ann.id);
      target.parentNode.insertBefore(m, target);
      m.appendChild(target);
      marks.push(m);
    }
    decorate(root, ann);
    return marks;
  }

  function marksOf(root, aid) {
    return root.querySelectorAll('mark.cq-mark[data-aid="' + aid + '"]');
  }

  function decorate(root, ann) {
    var ms = marksOf(root, ann.id);
    for (var i = 0; i < ms.length; i++) {
      ms[i].className =
        "cq-mark cq-" + (ann.kind === "ul" ? "ul" : "hl") +
        " cq-c-" + ann.color +
        (ann.note ? " cq-has-note" : "") +
        (i === ms.length - 1 ? " cq-end" : "");
    }
    return ms.length;
  }

  function unwrap(root, aid) {
    var ms = marksOf(root, aid);
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], p = m.parentNode;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    }
  }

  function unwrapAll(root) {
    var ms = root.querySelectorAll("mark.cq-mark");
    for (var i = ms.length - 1; i >= 0; i--) {
      var m = ms[i], p = m.parentNode;
      if (!p) continue;
      while (m.firstChild) p.insertBefore(m.firstChild, m);
      p.removeChild(m);
      p.normalize();
    }
  }

  /* Aplica uma lista de anotações; devolve as que não acharam lugar. */
  function apply(root, anns) {
    var orphans = [];
    var sorted = anns.slice().sort(function (x, y) {
      return (x.start || 0) - (y.start || 0);
    });
    for (var i = 0; i < sorted.length; i++) {
      var a = sorted[i];
      var loc = locate(root, a);
      if (!loc || !wrap(root, loc[0], loc[1], a).length) orphans.push(a);
    }
    return orphans;
  }

  window.CQA = {
    describe: describe,
    locate: locate,
    wrap: wrap,
    unwrap: unwrap,
    unwrapAll: unwrapAll,
    decorate: decorate,
    marksOf: marksOf,
    apply: apply,
  };
})();
