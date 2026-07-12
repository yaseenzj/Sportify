const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const { appOutDir } = context;
    const localesDir = path.join(appOutDir, 'locales');
    
    if (fs.existsSync(localesDir)) {
        const files = fs.readdirSync(localesDir);
        for (const file of files) {
            // Keep only en-US.pak
            if (file !== 'en-US.pak') {
                fs.unlinkSync(path.join(localesDir, file));
            }
        }
        console.log(`\n\n[Build Optimization] Stripped ${files.length - 1} unused locales to save space.\n\n`);
    }
};
