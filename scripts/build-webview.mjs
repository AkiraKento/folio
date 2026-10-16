import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const webviewSrcDir = path.join(rootDir, 'src', 'webview');
const outputDir = path.join(rootDir, 'src', 'webview', 'generated');
const distHtmlDir = path.join(rootDir, 'dist', 'webview');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(distHtmlDir)) {
  fs.mkdirSync(distHtmlDir, { recursive: true });
}

async function buildEntry(entryName, entryPath, title = 'Weiss WebView') {
  if (!fs.existsSync(entryPath)) {
    console.log(`Pular ${entryName}: arquivo ${entryPath} ainda não existe.`);
    return;
  }

  const result = await esbuild.build({
    entryPoints: [entryPath],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020', 'chrome80'],
    minify: false,
  });

  const jsCode = result.outputFiles[0].text;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
${jsCode}
  </script>
</body>
</html>`;

  // Salva o HTML standalone para debug/inspeção
  const htmlPath = path.join(distHtmlDir, `${entryName}.html`);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  // Salva o módulo TypeScript exportando o HTML e o JS do runtime como string para o React Native
  const tsModulePath = path.join(outputDir, `${entryName}.html.ts`);
  const tsDirectModulePath = path.join(outputDir, `${entryName}.ts`);
  const escapedHtml = JSON.stringify(html);
  const escapedJs = JSON.stringify(jsCode);
  const tsContent = `// Gerado automaticamente por scripts/build-webview.mjs - NÃO EDITAR MANUALMENTE
export const ${entryName}Html: string = ${escapedHtml};
export const ${entryName}RuntimeJs: string = ${escapedJs};
`;
  fs.writeFileSync(tsModulePath, tsContent, 'utf-8');
  fs.writeFileSync(tsDirectModulePath, tsContent, 'utf-8');


  console.log(`✓ Webview '${entryName}' compilado com sucesso.`);
}

function buildModelFixtures() {
  const modelosDir = path.join(rootDir, 'docs', 'referencia', 'modelos');
  const fixturesDir = path.join(webviewSrcDir, 'card', '__fixtures__');
  const fixturesMediaDir = path.join(fixturesDir, 'media');

  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }
  if (!fs.existsSync(fixturesMediaDir)) {
    fs.mkdirSync(fixturesMediaDir, { recursive: true });
  }

  // PNG válido mínimo (64x64 em tom verde Calmcoder #3a9d7f) para exemplo-avicena.png
  const samplePngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVR4nO3PQREAMAgAoL9/Zzy4oI2Z0N17ng84A2gAagBqAGoAagBqAGoAagBqAGoAagBqAGoAagBqAGoAagBqAGoAagBqAGoAagBqAGoAagBqAGrgArs7AT44j1zBAAAAAElFTkSuQmCC';

  const samplePngPath = path.join(fixturesMediaDir, 'exemplo-avicena.png');
  fs.writeFileSync(samplePngPath, Buffer.from(samplePngBase64, 'base64'));

  const modelKeys = ['avicena', 'anking'];
  const loadedModels = {};

  for (const key of modelKeys) {
    const dir = path.join(modelosDir, key);
    if (!fs.existsSync(dir)) continue;

    const modelJson = JSON.parse(fs.readFileSync(path.join(dir, 'model.json'), 'utf-8'));
    const exemploJson = JSON.parse(fs.readFileSync(path.join(dir, 'exemplo.json'), 'utf-8'));
    const frontHtml = fs.readFileSync(path.join(dir, 'front.html'), 'utf-8');
    const backHtml = fs.readFileSync(path.join(dir, 'back.html'), 'utf-8');
    const styleCss = fs.readFileSync(path.join(dir, 'style.css'), 'utf-8');

    loadedModels[key] = {
      model: modelJson,
      example: exemploJson,
      frontHtml,
      backHtml,
      styleCss,
    };
  }

  const generatedTsPath = path.join(fixturesDir, 'generated.ts');
  const generatedContent = `// Gerado automaticamente por scripts/build-webview.mjs a partir de docs/referencia/modelos/*/ - NÃO EDITAR MANUALMENTE
export const EXEMPLO_AVICENA_PNG_BASE64 = ${JSON.stringify(samplePngBase64)};

export const RAW_MODEL_FIXTURES = ${JSON.stringify(loadedModels, null, 2)} as const;
`;

  fs.writeFileSync(generatedTsPath, generatedContent, 'utf-8');
  console.log("✓ Fixtures de 'docs/referencia/modelos/' geradas com sucesso.");
}

async function main() {
  console.log('Iniciando compilação dos módulos WebView...');
  buildModelFixtures();
  await buildEntry('hello', path.join(webviewSrcDir, 'hello.ts'), 'Weiss - Olá Mundo');
  await buildEntry('card', path.join(webviewSrcDir, 'card', 'index.ts'), 'Weiss - Card');
  await buildEntry('consulta', path.join(webviewSrcDir, 'consulta', 'index.ts'), 'Weiss - Consulta');
  console.log('Compilação WebView concluída.');
}

main().catch((err) => {
  console.error('Erro na compilação do WebView:', err);
  process.exit(1);
});

