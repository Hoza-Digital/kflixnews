const fs = require('fs');
const files = [
  'app/all-article/page.tsx',
  'app/new-article/page.tsx',
  'app/photo-gallery/page.tsx',
  'app/settings/page.tsx',
  'app/user-management/page.tsx',
  'app/video-gallery/page.tsx'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import (.*?) from "\.\.\/\.\.\/\.\.\/(.*?)";/g, 'import $1 from "../../$2";');
  content = content.replace(/import (.*?) from "\.\.\/\.\.\/(.*?)";/g, 'import $1 from "../$2";');
  fs.writeFileSync(file, content);
}
console.log("Fixed!");
