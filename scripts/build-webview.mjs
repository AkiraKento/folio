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

async function buildEntry(entryName, entryPath, title = 'Folio WebView') {
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

  // Salva o módulo TypeScript exportando o HTML como string para o React Native
  const tsModulePath = path.join(outputDir, `${entryName}.html.ts`);
  const escapedHtml = JSON.stringify(html);
  const tsContent = `// Gerado automaticamente por scripts/build-webview.mjs - NÃO EDITAR MANUALMENTE
export const ${entryName}Html: string = ${escapedHtml};
`;
  fs.writeFileSync(tsModulePath, tsContent, 'utf-8');

  console.log(`✓ Webview '${entryName}' compilado com sucesso.`);
}

async function main() {
  console.log('Iniciando compilação dos módulos WebView...');
  await buildEntry('hello', path.join(webviewSrcDir, 'hello.ts'), 'Folio - Olá Mundo');
  await buildEntry('card', path.join(webviewSrcDir, 'card', 'index.ts'), 'Folio - Card');
  await buildEntry('consulta', path.join(webviewSrcDir, 'consulta', 'index.ts'), 'Folio - Consulta');
  console.log('Compilação WebView concluída.');
}

main().catch((err) => {
  console.error('Erro na compilação do WebView:', err);
  process.exit(1);
});
