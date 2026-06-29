const fs = require('fs');
const glob = require('glob');

glob('src/**/*.controller.ts', (err, files) => {
  let missing = false;
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let hasApiTags = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('@ApiTags')) hasApiTags = true;
      
      if (line.match(/^@(Get|Post|Patch|Put|Delete)\(/)) {
        // Look back a few lines to check for @ApiOperation
        let hasOperation = false;
        for (let j = Math.max(0, i - 5); j < i; j++) {
          if (lines[j].includes('@ApiOperation')) {
            hasOperation = true;
            break;
          }
        }
        
        if (!hasOperation) {
          console.log(`Missing @ApiOperation in ${file} at line ${i+1}: ${line}`);
          missing = true;
        }
      }
    }
    
    if (!hasApiTags && content.includes('@Controller')) {
      console.log(`Missing @ApiTags in ${file}`);
      missing = true;
    }
  });
  
  if (!missing) console.log("All endpoints have @ApiOperation and all controllers have @ApiTags.");
});
