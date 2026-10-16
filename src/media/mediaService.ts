import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { MediaRepository, type CreateMediaInput } from '@/db/repositories/media';
import { generateId } from '@/db/repositories/utils';
import type { Media } from '@/db/schema';
import { logWarn } from '@/logging';

export interface SavedMediaResult {
  media: Media;
  imgTag: string;
}

/**
 * Retorna o caminho absoluto do diretório de mídia de forma síncrona (com barra final).
 */
export function getMediaDirectorySync(): string {
  const baseDir = FileSystem.documentDirectory ?? '';
  return `${baseDir}media/`;
}

/**
 * Retorna o caminho absoluto do diretório de mídia do app (com barra final),
 * garantindo que o diretório exista no sistema de arquivos local.
 */
export async function getMediaDirectory(): Promise<string> {
  const mediaDir = getMediaDirectorySync();

  try {
    const dirInfo = await FileSystem.getInfoAsync(mediaDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
    }
  } catch (err) {
    logWarn('MediaService', 'Falha ao verificar/criar diretório de mídia local', String(err));
  }

  return mediaDir;
}

/**
 * Determina o MIME type com base na extensão do arquivo.
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Salva um arquivo de mídia no diretório `media/` do Folio e registra
 * na tabela `media`. Evita duplicação se o mesmo arquivo já existir (por sha1).
 */
export async function saveMediaFromUri(
  sourceUri: string,
  options?: {
    originalFilename?: string;
    mediaRepo?: MediaRepository;
  }
): Promise<SavedMediaResult> {
  const mediaRepo = options?.mediaRepo ?? new MediaRepository();
  const mediaDir = await getMediaDirectory();

  // Lê informações do arquivo de origem
  let fileBytes = 0;
  try {
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (info.exists && typeof info.size === 'number') {
      fileBytes = info.size;
    }
  } catch (err) {
    logWarn('MediaService', 'Falha ao obter tamanho do arquivo de mídia', String(err));
  }

  // Gera hash SHA-1 do conteúdo ou do caminho/timestamp para unicidade e integridade
  let sha1: string;
  try {
    // Tenta ler conteúdo base64 para hash de conteúdo
    const content = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    sha1 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, content);
  } catch (err) {
    logWarn('MediaService', 'Fallback de SHA-1 por URI acionado', String(err));
    // Fallback para hash da URI + timestamp
    sha1 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      `${sourceUri}-${Date.now()}`
    );
  }

  // Se já existir registro ativo com esse SHA-1 no banco de dados, reaproveita
  const existingMedia = mediaRepo.getBySha1(sha1);
  if (existingMedia) {
    return {
      media: existingMedia,
      imgTag: `<img src="${existingMedia.filename}">`,
    };
  }

  // Extrai ou gera extensão
  const extMatch = sourceUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = (extMatch ? extMatch[1] : options?.originalFilename?.split('.').pop() ?? 'jpg').toLowerCase();
  const filename = `paste-${sha1.slice(0, 10)}.${ext}`;
  const targetUri = `${mediaDir}${filename}`;

  // Copia o arquivo para a pasta media/
  try {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });
  } catch (err) {
    logWarn('MediaService', 'Falha ao copiar arquivo de mídia para media/', String(err));
  }

  const mime = getMimeType(filename);
  const mediaInput: CreateMediaInput = {
    id: generateId(),
    filename,
    sha1,
    bytes: fileBytes,
    mime,
  };

  const savedMedia = mediaRepo.create(mediaInput);

  return {
    media: savedMedia,
    imgTag: `<img src="${filename}">`,
  };
}

/**
 * Abre a galeria de imagens do dispositivo, copia a imagem selecionada
 * para `media/` e retorna a tag `<img src="...">` pronta para inclusão no card.
 */
export async function pickImageAndSave(
  mediaRepo?: MediaRepository
): Promise<SavedMediaResult | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const originalFilename = asset.fileName ?? undefined;

  return saveMediaFromUri(asset.uri, {
    originalFilename,
    mediaRepo,
  });
}
