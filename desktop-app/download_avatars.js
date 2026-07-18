const https = require('https'); 
const fs = require('fs'); 
const path = require('path');

const fetch = url => new Promise((resolve) => https.get(url, (res) => { 
  let data = ''; 
  res.on('data', c => data += c); 
  res.on('end', () => resolve(data)); 
})); 

(async () => { 
  fs.mkdirSync('public/assets/avatars', { recursive: true });
  const a1 = await fetch('https://api.dicebear.com/7.x/adventurer/svg?seed=Felix'); 
  fs.writeFileSync('public/assets/avatars/male1.svg', a1); 
  const a2 = await fetch('https://api.dicebear.com/7.x/adventurer/svg?seed=Jasper'); 
  fs.writeFileSync('public/assets/avatars/male2.svg', a2); 
  const a3 = await fetch('https://api.dicebear.com/7.x/adventurer/svg?seed=Mia'); 
  fs.writeFileSync('public/assets/avatars/female1.svg', a3); 
  const a4 = await fetch('https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe'); 
  fs.writeFileSync('public/assets/avatars/female2.svg', a4); 
})();
