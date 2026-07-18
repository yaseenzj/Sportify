const fs = require('fs');
let html = fs.readFileSync('workers/cloudflare-stream-manager-beta/test.html', 'utf8');

// The HTML is exactly what is inside the template string.
// Let's manually convert the string just like Cloudflare's JS engine would when creating the string!
html = eval('`' + html + '`');

const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.indexOf('</script>', scriptStart);
let js = html.substring(scriptStart, scriptEnd);

fs.writeFileSync('workers/cloudflare-stream-manager-beta/test.js', js);
console.log('test.js written for syntax check');
