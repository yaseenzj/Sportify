const fs = require('fs');
let code = fs.readFileSync('workers/cloudflare-stream-manager-beta/index.js', 'utf8');

const htmlStart = code.indexOf('const html = `');
const responseStart = code.indexOf('return new Response(html');

let pre = code.substring(0, htmlStart + 14);
let html = code.substring(htmlStart + 14, responseStart);
let post = code.substring(responseStart);

let lastBacktick = html.lastIndexOf('`');
if (lastBacktick !== -1) {
  let innerHtml = html.substring(0, lastBacktick);
  let afterLastBacktick = html.substring(lastBacktick);
  
  innerHtml = innerHtml.replace(/\\`/g, '`');
  innerHtml = innerHtml.replace(/\\\$/g, '$');
  
  innerHtml = innerHtml.replace(/`/g, '\\`');
  innerHtml = innerHtml.replace(/\$/g, '\\$');
  
  fs.writeFileSync('workers/cloudflare-stream-manager-beta/index.js', pre + innerHtml + afterLastBacktick + post);
  console.log('Fixed escaping!');
}
