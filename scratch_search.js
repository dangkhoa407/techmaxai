const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const excludeDirs = ['node_modules', '.next', '.git'];

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    if (excludeDirs.includes(file)) continue;
    
    const filePath = path.join(currentDir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (/\.(ts|tsx|js|jsx|html)$/.test(file)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      const nativeConfirmRegex = /(?<!\w|\.)confirm\s*\(/g;
      const nativeAlertRegex = /(?<!\w|\.)alert\s*\(/g;
      const windowConfirmRegex = /window\.confirm/g;
      const windowAlertRegex = /window\.alert/g;
      
      let match;
      while ((match = nativeConfirmRegex.exec(content)) !== null) {
        console.log(`FOUND native confirm in ${filePath} at index ${match.index}`);
      }
      while ((match = nativeAlertRegex.exec(content)) !== null) {
        console.log(`FOUND native alert in ${filePath} at index ${match.index}`);
      }
      while ((match = windowConfirmRegex.exec(content)) !== null) {
        console.log(`FOUND window.confirm in ${filePath} at index ${match.index}`);
      }
      while ((match = windowAlertRegex.exec(content)) !== null) {
        console.log(`FOUND window.alert in ${filePath} at index ${match.index}`);
      }
    }
  }
}

walk(rootDir);
console.log('Scan complete.');
