const fs = require('fs');
const path = require('path');

// Encontrar todos os arquivos de assets
const assetsDir = './public/assets';
const allAssets = new Set();

function walkDir(dir, relativePath = '') {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    let relPath = path.join(relativePath, file);
    relPath = relPath.split('\').join('/');
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath, relPath);
    } else {
      allAssets.add(`/assets/${relPath}`);
    }
  });
}

walkDir(assetsDir);

// Encontrar todas as referencias em arquivos HTML
const htmlFiles = [];
function findHtmlFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.')) {
      findHtmlFiles(filePath);
    } else if (file.endsWith('.html')) {
      htmlFiles.push(filePath);
    }
  });
}

findHtmlFiles('./public');

const usedAssets = new Set();
htmlFiles.forEach(htmlFile => {
  const content = fs.readFileSync(htmlFile, 'utf-8');

  allAssets.forEach(asset => {
    if (content.includes(asset)) {
      usedAssets.add(asset);
    }
  });
});

// Assets nao utilizados
const unusedAssets = Array.from(allAssets)
  .filter(asset => !usedAssets.has(asset))
  .sort();

console.log(`\n=== ANALISE DE ASSETS ===\n`);
console.log(`Total de arquivos em assets: ${allAssets.size}`);
console.log(`Arquivos utilizados: ${usedAssets.size}`);
console.log(`Arquivos NAO utilizados: ${unusedAssets.length}`);
console.log(`\n=== ARQUIVOS NAO UTILIZADOS (TOP 50) ===\n`);

unusedAssets.slice(0, 50).forEach(asset => {
  console.log(asset);
});

if (unusedAssets.length > 50) {
  console.log(`\n... e mais ${unusedAssets.length - 50} arquivos`);
}

// Listar libs nao utilizadas
console.log(`\n=== LIBS NAO UTILIZADAS ===\n`);
const libsDir = './public/assets/libs';
const libs = fs.readdirSync(libsDir).filter(f => {
  return fs.statSync(path.join(libsDir, f)).isDirectory();
});

libs.forEach(lib => {
  const libAssets = Array.from(allAssets).filter(a => a.includes(`/assets/libs/${lib}`));
  const libUsed = Array.from(usedAssets).filter(a => a.includes(`/assets/libs/${lib}`));

  if (libUsed.length === 0 && libAssets.length > 0) {
    console.log(`- ${lib} (${libAssets.length} arquivos)`);
  }
});

// Salvar lista de assets nao utilizados em arquivo
fs.writeFileSync('unused-assets.json', JSON.stringify({
  total: allAssets.size,
  used: usedAssets.size,
  unused: unusedAssets.length,
  unusedAssets: unusedAssets
}, null, 2));

console.log(`\nLista completa salva em: unused-assets.json`);
