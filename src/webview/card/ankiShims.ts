import type { CardRenderPayload } from './types';

export interface AnkiShimsConfig {
  cardId?: string;
  noteId?: string;
  cardOrd?: number;
  isNightMode?: boolean;
  fields?: Record<string, string>;
}

/**
 * Envolve cada bloco <script> inline do template em um try/catch que envia erros
 * para o log do Weiss (P0-5) sem interromper a execução dos scripts seguintes.
 * Para <script src="...">, adiciona handler onerror para registrar ausência na pasta de mídia.
 * Quando executeModelScripts === false, remove todos os <script> do template.
 */
export function processTemplateScripts(
  html: string,
  executeModelScripts = true
): string {
  if (!html) {
    return '';
  }

  // Protege comentários HTML para não processar <script> comentados (ex: <!-- <script src="_bionic-reading.js"></script> -->)
  const comments: string[] = [];
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, (match) => {
    const idx = comments.length;
    comments.push(match);
    return `__WEISS_HTML_COMMENT_${idx}__`;
  });

  let processed: string;

  if (!executeModelScripts) {
    processed = withoutComments
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?script\b[^>]*>/gi, '');
  } else {
    processed = withoutComments.replace(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
      (_full, attrs: string, body: string) => {
        const hasSrc = /\bsrc\s*=/i.test(attrs);
        if (hasSrc) {
          const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
          const rawSrc = srcMatch ? (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? '') : '';
          // Bloqueia scripts remotos http/https
          if (/^(?:https?:)?\/\//i.test(rawSrc.trim())) {
            return `<script>if(window.__weissLogScriptError){window.__weissLogScriptError("Bloqueado script remoto no template: " + ${JSON.stringify(rawSrc)});}</script>`;
          }
          return `<script${attrs} onerror="if(window.__weissLogScriptError){window.__weissLogScriptError('Arquivo de script de mídia não encontrado: ' + (this.getAttribute('src') || this.src));}"></script>`;
        }

        return `<script${attrs}>
try {
${body}
} catch (__weissScriptErr) {
  if (window.__weissLogScriptError) {
    window.__weissLogScriptError(__weissScriptErr);
  }
}
</script>`;
      }
    );
  }

  return processed.replace(/__WEISS_HTML_COMMENT_(\d+)__/g, (_m, idxStr) => {
    return comments[Number(idxStr)] ?? '';
  });
}

/**
 * Gera o código JS de shims do Anki injetado no <head> ANTES do conteúdo (#qa):
 * - window.pycmd / window.bridgeCommand
 * - window.onUpdateHook = [] / window.onShownHook = []
 * - window.AnkiDroidJS mínimo
 * - Interceptação de fetch para AnkiConnect local (http://127.0.0.1:8765) restrita ao card/nota atual
 * - Bloqueio de qualquer outra requisição de rede (fetch / XMLHttpRequest / sendBeacon)
 */
export function buildAnkiShimsScript(
  payload: Pick<
    CardRenderPayload,
    'cardId' | 'noteId' | 'cardOrd' | 'theme' | 'fields'
  >
): string {
  const config: AnkiShimsConfig = {
    cardId: payload.cardId ?? 'weiss-card-current',
    noteId: payload.noteId ?? 'weiss-note-current',
    cardOrd: payload.cardOrd ?? 0,
    isNightMode: payload.theme === 'dark',
    fields: payload.fields ?? {},
  };

  const serializedConfig = JSON.stringify(config).replace(/</g, '\\u003c');

  return `(function() {
  var __cfg = ${serializedConfig};
  window.__WEISS_ANKI_CONFIG__ = __cfg;
  window.__WEISS_NOTE_FIELDS__ = Object.assign({}, __cfg.fields || {});

  function postToRn(msg) {
    try {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
    } catch (_e) {}
  }

  window.__weissLogScriptError = function(err) {
    var message = err && err.message ? (err.message + (err.stack ? '\\n' + err.stack : '')) : String(err);
    postToRn({
      type: 'scriptError',
      payload: { message: message }
    });
  };

  window.onUpdateHook = window.onUpdateHook || [];
  window.onShownHook = window.onShownHook || [];

  if (typeof HTMLElement !== 'undefined' && !('innerText' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
      get: function() { return this.textContent || ''; },
      set: function(v) { this.textContent = v === null || v === undefined ? '' : String(v); },
      configurable: true
    });
  }

  window.pycmd = function(cmd) {
    var cmdStr = String(cmd || '');
    // Quando o AnKing tenta auto-flip na frente com pycmd("ans"), restaura #qa para não ficar em branco se não virar automaticamente
    if (cmdStr === 'ans') {
      var qa = document.getElementById('qa');
      if (qa && qa.style.display === 'none') {
        qa.style.display = '';
      }
    }
    // Suporte a EFDRC#<nid>#<base64Field>#<htmlVal> caso usado pelo bloco de notas
    if (cmdStr.indexOf('EFDRC#') === 0) {
      var parts = cmdStr.split('#');
      if (parts.length >= 4) {
        try {
          var fieldName = atob(parts[2]);
          var fieldVal = parts.slice(3).join('#');
          var patch = {};
          patch[fieldName] = fieldVal;
          window.__WEISS_NOTE_FIELDS__[fieldName] = fieldVal;
          postToRn({
            type: 'updateNoteFields',
            payload: { noteId: __cfg.noteId, fields: patch }
          });
        } catch (_e) {}
      }
    }
    postToRn({
      type: 'pycmd',
      payload: { cmd: cmdStr }
    });
  };
  window.bridgeCommand = window.pycmd;

  window.AnkiDroidJS = {
    ankiGetCardId: function() { return __cfg.cardId; },
    ankiGetNoteId: function() { return __cfg.noteId; },
    ankiGetCardType: function() { return __cfg.cardOrd || 0; },
    ankiGetCardOrd: function() { return __cfg.cardOrd || 0; },
    ankiIsInNightMode: function() { return Boolean(__cfg.isNightMode); },
    ankiGetCardMark: function() { return false; },
    ankiGetCardFlag: function() { return 0; },
    ankiShowToast: function(text) {
      // Quando o Bloco de Notas do AnKing salva no modo AnkiDroid, persiste também em Personal Notes da nota atual
      try {
        var textarea = document.getElementById('notepad-textarea');
        if (textarea && typeof textarea.value === 'string') {
          var formatted = textarea.value.trim().replace(/\\n/g, '<br>');
          window.__WEISS_NOTE_FIELDS__['Personal Notes'] = formatted;
          postToRn({
            type: 'updateNoteFields',
            payload: {
              noteId: __cfg.noteId,
              fields: { 'Personal Notes': formatted }
            }
          });
        }
      } catch (_e) {}
      postToRn({
        type: 'ankiToast',
        payload: { message: String(text || '') }
      });
    }
  };

  function makeJsonResponse(obj) {
    var bodyStr = JSON.stringify(obj);
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: function() { return Promise.resolve(obj); },
      text: function() { return Promise.resolve(bodyStr); }
    });
  }

  function isAnkiConnectUrl(urlStr) {
    return /^https?:\\/\\/(?:127\\.0\\.0\\.1|localhost):8765(?:\\/|$)/i.test(String(urlStr || '').trim());
  }

  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
    if (isAnkiConnectUrl(url)) {
      var reqBody = {};
      try {
        if (init && typeof init.body === 'string') {
          reqBody = JSON.parse(init.body);
        }
      } catch (_e) {
        return makeJsonResponse({ result: null, error: 'JSON inválido' });
      }

      var action = reqBody && reqBody.action ? String(reqBody.action) : '';
      var params = (reqBody && reqBody.params) || {};

      if (action === 'guiCurrentCard') {
        return makeJsonResponse({
          result: { cardId: __cfg.cardId },
          error: null
        });
      }

      if (action === 'cardsInfo') {
        var reqCards = Array.isArray(params.cards) ? params.cards.map(String) : [];
        if (reqCards.length > 0 && reqCards.indexOf(String(__cfg.cardId)) === -1) {
          return makeJsonResponse({
            result: [],
            error: 'não suportado para outro card no Weiss'
          });
        }
        return makeJsonResponse({
          result: [{ cardId: __cfg.cardId, note: __cfg.noteId, fields: window.__WEISS_NOTE_FIELDS__ }],
          error: null
        });
      }

      if (action === 'updateNoteFields') {
        var noteParam = params.note || {};
        var targetNoteId = noteParam.id !== undefined ? String(noteParam.id) : '';
        if (!targetNoteId || targetNoteId !== String(__cfg.noteId)) {
          return makeJsonResponse({
            result: null,
            error: 'não suportado no Weiss: alteração permitida apenas na nota atual'
          });
        }
        var updatedFields = noteParam.fields && typeof noteParam.fields === 'object' ? noteParam.fields : {};
        Object.keys(updatedFields).forEach(function(k) {
          window.__WEISS_NOTE_FIELDS__[k] = String(updatedFields[k]);
        });
        postToRn({
          type: 'updateNoteFields',
          payload: {
            noteId: __cfg.noteId,
            fields: updatedFields
          }
        });
        return makeJsonResponse({
          result: null,
          error: null
        });
      }

      return makeJsonResponse({
        result: null,
        error: 'não suportado no Weiss'
      });
    }

    // Bloqueia qualquer outra requisição de rede vinda do card
    window.__weissLogScriptError('Bloqueada requisição fetch externa no card: ' + url);
    return Promise.reject(new Error('Requisição de rede bloqueada pelo Weiss: ' + url));
  };

  if (typeof window.XMLHttpRequest !== 'undefined') {
    var OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      var xhr = new OrigXHR();
      var origOpen = xhr.open;
      var blockedUrl = null;
      xhr.open = function(method, url) {
        var urlStr = String(url || '');
        if (!isAnkiConnectUrl(urlStr) && /^(?:https?:|wss?:)?\\/\\//i.test(urlStr)) {
          blockedUrl = urlStr;
          window.__weissLogScriptError('Bloqueada requisição XHR externa no card: ' + urlStr);
        }
        return origOpen.apply(this, arguments);
      };
      var origSend = xhr.send;
      xhr.send = function() {
        if (blockedUrl) {
          try { xhr.abort(); } catch (_e) {}
          return;
        }
        return origSend.apply(this, arguments);
      };
      return xhr;
    };
  }
})();`;
}
