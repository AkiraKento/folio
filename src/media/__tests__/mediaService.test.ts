import { createTestDatabase } from '@/db/__tests__/test-utils';
import { MediaRepository } from '@/db/repositories/media';
import {
  getMediaDirectory,
  saveMediaFromUri,
  pickImageAndSave,
} from '../mediaService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.folio/files/',
  EncodingType: { Base64: 'base64' },
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  copyAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA1: 'SHA-1' },
  digestStringAsync: jest.fn(),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

describe('mediaService', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let mediaRepo: MediaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    const context = createTestDatabase();
    db = context.db;
    mediaRepo = new MediaRepository(db);

    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      size: 2048,
    });
    (Crypto.digestStringAsync as jest.Mock).mockResolvedValue('abcdef1234567890');
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('base64content');
    (FileSystem.copyAsync as jest.Mock).mockResolvedValue(undefined);
  });

  test('getMediaDirectory retorna o caminho media/ e cria pasta se não existir', async () => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({ exists: false });

    const dir = await getMediaDirectory();
    expect(dir).toBe('file:///data/user/0/com.folio/files/media/');
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      'file:///data/user/0/com.folio/files/media/',
      { intermediates: true }
    );
  });

  test('saveMediaFromUri salva arquivo novo e retorna tag img', async () => {
    const result = await saveMediaFromUri('file:///cache/temp_pic.png', {
      originalFilename: 'temp_pic.png',
      mediaRepo,
    });

    expect(result.imgTag).toBe('<img src="paste-abcdef1234.png">');
    expect(result.media.filename).toBe('paste-abcdef1234.png');
    expect(result.media.sha1).toBe('abcdef1234567890');
    expect(result.media.mime).toBe('image/png');
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/temp_pic.png',
      to: 'file:///data/user/0/com.folio/files/media/paste-abcdef1234.png',
    });
  });

  test('saveMediaFromUri reaproveita mídia existente se sha1 já existir', async () => {
    // Primeiro salvamento
    await saveMediaFromUri('file:///cache/temp_pic.png', {
      mediaRepo,
    });

    (FileSystem.copyAsync as jest.Mock).mockClear();

    // Segundo salvamento do mesmo conteúdo
    const result2 = await saveMediaFromUri('file:///cache/other_pic.png', {
      mediaRepo,
    });

    expect(result2.imgTag).toBe('<img src="paste-abcdef1234.png">');
    // Não copia arquivo novamente se já existe
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });

  test('pickImageAndSave retorna null se cancelado pelo usuário', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: true,
      assets: null,
    });

    const result = await pickImageAndSave(mediaRepo);
    expect(result).toBeNull();
  });

  test('pickImageAndSave salva imagem da galeria com sucesso', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///gallery/photo.jpg',
          fileName: 'photo.jpg',
          fileSize: 4096,
        },
      ],
    });

    const result = await pickImageAndSave(mediaRepo);
    expect(result).not.toBeNull();
    expect(result?.imgTag).toBe('<img src="paste-abcdef1234.jpg">');
  });
});
