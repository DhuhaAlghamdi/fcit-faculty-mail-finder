const fs = require('node:fs');
fs.mkdirSync('dist', {recursive: true});
for (const asset of ['index.html', 'app.js', 'visitor-counter.js', 'style.css', 'faculty.json', 'favicon.svg']) {
  fs.copyFileSync(asset, `dist/${asset}`);
}
