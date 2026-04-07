const { app } = require('electron');
const path = require('path');

console.log('AppPath:', app.getAppPath());
console.log('CWD:', process.cwd());
console.log('ResourcesPath:', process.resourcesPath);
console.log('UserData:', app.getPath('userData'));

const possibleDir = path.join(app.getAppPath(), "src", "main", "assets", "fonts", "defaults");
console.log('Calculated defaultsDir:', possibleDir);

app.quit();
