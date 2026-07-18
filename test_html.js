const fs = require('fs');
let code = fs.readFileSync('workers/cloudflare-stream-manager-beta/index.js', 'utf8');
const htmlStart = code.indexOf('const html = `');
const responseStart = code.indexOf('return new Response(html');
let html = code.substring(htmlStart + 14, responseStart);
html = html.substring(0, html.lastIndexOf('`'));

// Since it's a template string, evaluate it with empty variables where needed
let currentPassword = 'test';
try {
  let evaluated = eval('`' + html + '`');
  fs.writeFileSync('workers/cloudflare-stream-manager-beta/test.html', evaluated);
  console.log('test.html written');
} catch(e) {
  console.log('Eval error:', e);
}
