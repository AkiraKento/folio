/**
 * Utilitários para resolução e reescrita de imagens e mídias de cards.
 * Mídias locais do Anki/Folio são armazenadas em FileSystem.documentDirectory + 'media/'
 * e referenciadas por caminhos relativos no HTML (ex: "imagem.png").
 */

const ABSOLUTE_URL_REGEX = /^(https?:|data:|blob:|file:)/i;

/**
 * Resolve o atributo src de uma mídia relativa para o diretório base de mídias seguro do app.
 */
export function resolveMediaSrc(src: string, mediaBasePath?: string): string {
  if (!src || typeof src !== 'string') {
    return '';
  }

  const trimmed = src.trim();

  // Preserva URLs externas já absolutas ou dados embutidos (data/blob)
  if (ABSOLUTE_URL_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Se não foi fornecido diretório de mídia base, mantém original
  if (!mediaBasePath) {
    return trimmed;
  }

  // Remove tentativas de path traversal (..) e barras iniciais redundantes
  const sanitizedPath = trimmed
    .replace(/\.\.+[/\\]/g, '')
    .replace(/^(\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');

  const normalizedBase = mediaBasePath.endsWith('/') ? mediaBasePath : `${mediaBasePath}/`;
  return `${normalizedBase}${sanitizedPath}`;
}

/**
 * Percorre o DOM procurando elementos <img> e reescreve seus atributos src para
 * apontar para a pasta de mídia base quando forem referências locais relativas.
 */
export function rewriteMediaElements(container: Element | Document, mediaBasePath?: string): void {
  const images = container.querySelectorAll('img');

  images.forEach((img) => {
    const rawSrc = img.getAttribute('src');
    if (!rawSrc) return;

    const resolved = resolveMediaSrc(rawSrc, mediaBasePath);
    if (resolved !== rawSrc) {
      img.setAttribute('src', resolved);
    }

    // Configurações padrão de segurança e usabilidade para visualização de flashcards
    img.draggable = false;
  });
}
