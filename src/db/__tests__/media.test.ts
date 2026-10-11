import { createTestDatabase } from './test-utils';
import { MediaRepository } from '../repositories/media';

describe('MediaRepository', () => {
  let db: ReturnType<typeof createTestDatabase>['db'];
  let mediaRepo: MediaRepository;

  beforeEach(() => {
    const context = createTestDatabase();
    db = context.db;
    mediaRepo = new MediaRepository(db);
  });

  test('cria e recupera mídia por id, filename e sha1', () => {
    const media = mediaRepo.create({
      id: 'media-1',
      filename: 'coracao.png',
      sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
      bytes: 10240,
      mime: 'image/png',
    });

    expect(media.id).toBe('media-1');
    expect(media.filename).toBe('coracao.png');
    expect(media.bytes).toBe(10240);

    const byId = mediaRepo.getById('media-1');
    expect(byId?.id).toBe('media-1');
    expect(byId?.filename).toBe('coracao.png');

    const byFilename = mediaRepo.getByFilename('coracao.png');
    expect(byFilename?.id).toBe('media-1');

    const bySha1 = mediaRepo.getBySha1('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(bySha1?.id).toBe('media-1');
  });

  test('lista mídias e lida com soft delete', () => {
    mediaRepo.create({
      id: 'm1',
      filename: 'img1.jpg',
      sha1: 'sha111',
      bytes: 500,
      mime: 'image/jpeg',
    });
    mediaRepo.create({
      id: 'm2',
      filename: 'img2.jpg',
      sha1: 'sha222',
      bytes: 800,
      mime: 'image/jpeg',
    });

    const listBefore = mediaRepo.listAll();
    expect(listBefore).toHaveLength(2);

    const deleted = mediaRepo.softDelete('m1');
    expect(deleted).toBe(true);

    const listAfter = mediaRepo.listAll();
    expect(listAfter).toHaveLength(1);
    expect(listAfter[0].id).toBe('m2');

    expect(mediaRepo.getById('m1')).toBeNull();
    expect(mediaRepo.getById('m1', { includeDeleted: true })).not.toBeNull();
  });
});
