import fs from 'fs';
import path from 'path';

const srcDir = '.';
const destDir = './www';

// Helper to recursively copy directories
function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'www' && entry.name !== 'android' && entry.name !== 'netlify') {
        copyDirSync(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clear or create destDir
if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
fs.mkdirSync(destDir);

// Copy individual files
const filesToCopy = ['index.html', 'manifest.json', 'sw.js'];
for (const file of filesToCopy) {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
}

// Copy directories
const dirsToCopy = ['css', 'js', 'icons', '.well-known'];
for (const dir of dirsToCopy) {
  const srcPath = path.join(srcDir, dir);
  const destPath = path.join(destDir, dir);
  if (fs.existsSync(srcPath)) {
    copyDirSync(srcPath, destPath);
  }
}

console.log('Successfully copied web assets to www/ folder!');
