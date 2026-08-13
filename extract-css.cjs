const fs = require('fs');
const css = fs.readFileSync('app/globals.css', 'utf8');
const rules = css.match(/([^{}]+)\{([^{}]+)\}/g) || [];
const targets = rules.filter(r => r.includes('composer') || r.includes('editor') || r.includes('slug') || r.includes('media-tab') || r.includes('drop-zone') || r.includes('gallery'));
console.log(targets.join('\n'));
