const fs = require('fs');
let code = fs.readFileSync('workers/cloudflare-stream-manager-beta/index.js', 'utf8');
const match = code.match(/const html = `([\s\S]*?)`;\s*return new Response\(html/);
if (match) {
  fs.writeFileSync('workers/cloudflare-stream-manager-beta/test.html', match[1]);
  console.log('test.html written properly!');
} else {
  console.log('Regex failed to match');
}
