import JSZip from 'jszip';
import type { AnkiMediaMap, ExtractedApkg } from './types';

/**
 * Lê e descompacta um arquivo/pacote .apkg usando JSZip.
 * Identifica se é collection.anki21 ou collection.anki2, e mapeia a mídia.
 */
export async function readApkgPackage(
  data: Uint8Array | ArrayBuffer | string
): Promise<ExtractedApkg> {
  const zip = await JSZip.loadAsync(data);

  const anki21bEntry = zip.file('collection.anki21b');
  const anki21Entry = zip.file('collection.anki21');
  const anki2Entry = zip.file('collection.anki2');

  // Se houver collection.anki21b e não houver collection.anki21:
  // O Anki moderno exportou no formato novo (zstd), embutindo apenas um collection.anki2 dummy.
  if (anki21bEntry && !anki21Entry) {
    throw new Error(
      'Exporte de novo no Anki marcando *Suporte a versões antigas*'
    );
  }

  // 1. Procura pela base de dados legada do Anki
  let dbFileName: 'collection.anki21' | 'collection.anki2' | null = null;
  let dbZipEntry = anki21Entry;

  if (dbZipEntry) {
    dbFileName = 'collection.anki21';
  } else if (anki2Entry) {
    dbZipEntry = anki2Entry;
    dbFileName = 'collection.anki2';
  }

  // 2. Tratamento para formato novo zstd (.anki21b) conforme PRD §10
  if (!dbZipEntry) {
    if (anki21bEntry) {
      throw new Error(
        'Exporte de novo no Anki marcando *Suporte a versões antigas*'
      );
    }

    throw new Error(
      'Arquivo .apkg inválido: nenhuma base de dados do Anki encontrada.'
    );
  }

  const databaseBytes = await dbZipEntry.async('uint8array');

  // 3. Lê o mapeamento de mídia
  let mediaMap: AnkiMediaMap = {};
  const mediaEntry = zip.file('media');
  if (mediaEntry) {
    const mediaBytes = await mediaEntry.async('uint8array');
    // Se a mídia tiver compressão zstd (magic: 0x28, 0xB5, 0x2F, 0xFD), avisa para exportar com suporte a versões antigas
    if (
      mediaBytes.length >= 4 &&
      mediaBytes[0] === 0x28 &&
      mediaBytes[1] === 0xb5 &&
      mediaBytes[2] === 0x2f &&
      mediaBytes[3] === 0xfd
    ) {
      throw new Error(
        'Exporte de novo no Anki marcando *Suporte a versões antigas*'
      );
    }

    try {
      const decoder = new TextDecoder('utf-8');
      const mediaJsonText = decoder.decode(mediaBytes);
      mediaMap = JSON.parse(mediaJsonText) as AnkiMediaMap;
    } catch {
      mediaMap = {};
    }
  }

  return {
    databaseBytes,
    dbFileName: dbFileName!,
    mediaMap,
    getMediaFile: async (key: string): Promise<Uint8Array | null> => {
      const fileEntry = zip.file(key);
      if (!fileEntry) return null;
      return fileEntry.async('uint8array');
    },
  };
}
