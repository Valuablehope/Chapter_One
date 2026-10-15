
import fs from 'fs';
const content = fs.readFileSync('frontend/src/pages/Sales.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  const matches = line.match(/className="[^"]*$/);
  if (matches) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
