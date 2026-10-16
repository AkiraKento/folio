/**
 * Processa o CSS do modelo para conformidade com o M10 Passo 6:
 * 1. Remove @import de fontes Lato do Google Fonts (pois a fonte já é carregada localmente offline em weiss-fonts).
 * 2. Remove qualquer outro @import remoto (http/https/protocol-relative) e registra no log.
 */
export function processModelCss(
  rawCss: string,
  onRemoteImportBlocked?: (url: string) => void
): string {
  if (!rawCss) return '';

  // Regex para capturar regras @import ... ;
  const importRegex =
    /@import\s+(?:url\s*\(\s*(?:(['"])(.*?)\1|([^"')]+))\s*\)|(['"])(.*?)\4)\s*[^;]*;?/gi;

  return rawCss.replace(importRegex, (fullMatch, _q1, url1, url2, _q2, url3) => {
    const rawUrl = (url1 ?? url2 ?? url3 ?? '').trim();

    // Se é a fonte Lato do Google Fonts, remove pois já está no weiss-fonts offline
    if (
      /fonts\.googleapis\.com\/css/i.test(rawUrl) &&
      /Lato/i.test(rawUrl)
    ) {
      return '';
    }

    // Se for qualquer outra URL remota, remove e registra em log
    if (/^(?:https?:)?\/\//i.test(rawUrl)) {
      if (onRemoteImportBlocked) {
        onRemoteImportBlocked(rawUrl);
      } else {
        console.warn(`[CardCss] Bloqueado @import remoto no CSS do modelo: ${rawUrl}`);
      }
      return '';
    }

    // Mantém imports locais se houver
    return fullMatch;
  });
}
