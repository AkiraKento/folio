import fs from 'fs';
import path from 'path';
import { strings } from '@/ui/strings';

function getPngDimensions(filePath: string): { width: number; height: number } {
  const buffer = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPng) {
    throw new Error(`Arquivo não é um PNG válido: ${filePath}`);
  }

  // IHDR chunk begins at offset 12 (length: 4, type 'IHDR': 4, width: 4, height: 4)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

describe('Configuração do App e Identidade Visual (M8)', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const appJsonPath = path.join(rootDir, 'app.json');

  test('app.json existe e possui nome, slug e identificadores corretos', () => {
    expect(fs.existsSync(appJsonPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    const expo = content.expo;

    expect(expo).toBeDefined();
    expect(expo.name).toBe('Weiss');
    expect(expo.slug).toBe('weiss');
    expect(expo.name).toBe(strings.common.appName);
    expect(expo.android?.package).toBe('com.weiss.app');
  });

  test('configuração de splash screen no app.json é válida e consistente com o tema', () => {
    const content = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    const splash = content.expo.splash;

    expect(splash).toBeDefined();
    expect(splash.image).toBe('./assets/images/splash-icon.png');
    expect(splash.resizeMode).toBe('contain');
    expect(splash.backgroundColor).toBe('#031417');

    const splashPath = path.resolve(rootDir, splash.image);
    expect(fs.existsSync(splashPath)).toBe(true);
    const dims = getPngDimensions(splashPath);
    expect(dims.width).toBeGreaterThanOrEqual(512);
    expect(dims.height).toBeGreaterThanOrEqual(512);
  });

  test('configuração de ícone universal e adaptiveIcon do Android é completa', () => {
    const content = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    const expo = content.expo;

    // Ícone universal (1024x1024)
    expect(expo.icon).toBe('./assets/images/icon.png');
    const iconPath = path.resolve(rootDir, expo.icon);
    expect(fs.existsSync(iconPath)).toBe(true);
    const iconDims = getPngDimensions(iconPath);
    expect(iconDims.width).toBe(1024);
    expect(iconDims.height).toBe(1024);

    // Adaptive icon Android
    const adaptive = expo.android.adaptiveIcon;
    expect(adaptive).toBeDefined();
    expect(adaptive.backgroundColor).toBe('#031417');

    const fgPath = path.resolve(rootDir, adaptive.foregroundImage);
    expect(fs.existsSync(fgPath)).toBe(true);
    const fgDims = getPngDimensions(fgPath);
    expect(fgDims.width).toBe(1024);
    expect(fgDims.height).toBe(1024);

    const bgPath = path.resolve(rootDir, adaptive.backgroundImage);
    expect(fs.existsSync(bgPath)).toBe(true);
    const bgDims = getPngDimensions(bgPath);
    expect(bgDims.width).toBe(1024);
    expect(bgDims.height).toBe(1024);

    const monoPath = path.resolve(rootDir, adaptive.monochromeImage);
    expect(fs.existsSync(monoPath)).toBe(true);
    const monoDims = getPngDimensions(monoPath);
    expect(monoDims.width).toBe(1024);
    expect(monoDims.height).toBe(1024);
  });

  test('favicon web está configurado e possui dimensões corretas', () => {
    const content = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    expect(content.expo.web?.favicon).toBe('./assets/images/favicon.png');

    const favPath = path.resolve(rootDir, content.expo.web.favicon);
    expect(fs.existsSync(favPath)).toBe(true);
    const favDims = getPngDimensions(favPath);
    expect(favDims.width).toBe(48);
    expect(favDims.height).toBe(48);
  });
});
