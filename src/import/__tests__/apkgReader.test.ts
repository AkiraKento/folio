import JSZip from 'jszip';
import { readApkgPackage } from '../apkgReader';

describe('apkgReader', () => {
  it('deve extrair pacote .apkg contendo collection.anki2 e media json', async () => {
    const zip = new JSZip();
    const mockDbBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const mockImageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const mediaJson = JSON.stringify({ '0': 'coracao.png', '1': 'diagrama.jpg' });

    zip.file('collection.anki2', mockDbBytes);
    zip.file('media', mediaJson);
    zip.file('0', mockImageBytes);
    zip.file('1', new Uint8Array([255, 216, 255]));

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
    const pkg = await readApkgPackage(zipBuffer);

    expect(pkg.dbFileName).toBe('collection.anki2');
    expect(pkg.databaseBytes).toEqual(mockDbBytes);
    expect(pkg.mediaMap).toEqual({ '0': 'coracao.png', '1': 'diagrama.jpg' });

    const file0 = await pkg.getMediaFile('0');
    expect(file0).toEqual(mockImageBytes);

    const nonExistent = await pkg.getMediaFile('999');
    expect(nonExistent).toBeNull();
  });

  it('deve dar preferência a collection.anki21 se ambos existirem', async () => {
    const zip = new JSZip();
    const db2Bytes = new Uint8Array([2]);
    const db21Bytes = new Uint8Array([2, 1]);

    zip.file('collection.anki2', db2Bytes);
    zip.file('collection.anki21', db21Bytes);
    zip.file('media', '{}');

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
    const pkg = await readApkgPackage(zipBuffer);

    expect(pkg.dbFileName).toBe('collection.anki21');
    expect(pkg.databaseBytes).toEqual(db21Bytes);
  });

  it('deve avisar com mensagem clara do PRD §10 quando só houver collection.anki21b', async () => {
    const zip = new JSZip();
    zip.file('collection.anki21b', new Uint8Array([1, 2, 3]));
    zip.file('media', '{}');

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    await expect(readApkgPackage(zipBuffer)).rejects.toThrow(
      'Exporte de novo no Anki marcando *Suporte a versões antigas*'
    );
  });

  it('deve avisar com mensagem clara do PRD §10 quando houver collection.anki21b junto com collection.anki2 dummy', async () => {
    const zip = new JSZip();
    zip.file('collection.anki21b', new Uint8Array([1, 2, 3]));
    zip.file('collection.anki2', new Uint8Array([4, 5, 6])); // dummy criado pelo Anki moderno
    zip.file('media', '{}');

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    await expect(readApkgPackage(zipBuffer)).rejects.toThrow(
      'Exporte de novo no Anki marcando *Suporte a versões antigas*'
    );
  });

  it('deve avisar com mensagem clara do PRD §10 quando o arquivo de media for zstd', async () => {
    const zip = new JSZip();
    zip.file('collection.anki2', new Uint8Array([1, 2, 3]));
    // Magic bytes de zstandard: 0x28, 0xB5, 0x2F, 0xFD
    zip.file('media', new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x00, 0x01]));

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    await expect(readApkgPackage(zipBuffer)).rejects.toThrow(
      'Exporte de novo no Anki marcando *Suporte a versões antigas*'
    );
  });

  it('deve falhar se não houver nenhuma base de dados no arquivo', async () => {
    const zip = new JSZip();
    zip.file('arquivo_qualquer.txt', 'teste');

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    await expect(readApkgPackage(zipBuffer)).rejects.toThrow(
      'Arquivo .apkg inválido: nenhuma base de dados do Anki encontrada.'
    );
  });
});
