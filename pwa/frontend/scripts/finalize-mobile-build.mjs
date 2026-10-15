// The Capacitor shell and static hosts expect index.html at the root of the web dir.
import fs from 'fs';
import path from 'path';
const dir = path.resolve('dist-mobile');
fs.renameSync(path.join(dir, 'mobile.html'), path.join(dir, 'index.html'));
console.log('dist-mobile/index.html ready');
