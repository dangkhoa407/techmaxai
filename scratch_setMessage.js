const fs = require('fs');
const content = fs.readFileSync('app/chat/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('setMessage')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
