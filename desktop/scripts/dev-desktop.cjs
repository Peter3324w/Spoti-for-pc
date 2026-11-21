// Start a development preview; never creates production assets or an installer.
const {spawn} = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const {existsSync} = require('node:fs');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.SPOTI_DEV_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid SPOTI_DEV_PORT');
const url = process.env.SPOTI_DEV_URL || `http://localhost:${port}/`;
if (!/^http:\/\/localhost:[0-9]+\/$/.test(url)) throw new Error("SPOTI_DEV_URL must be a localhost URL ending with /.");
const vite = process.env.SPOTI_DEV_URL ? null : spawn(process.execPath, [path.join(root,'node_modules/vite/bin/vite.js'),'--host','localhost','--port',String(port),'--strictPort'], {cwd:root,stdio:'inherit'});
let desktop, closing = false;
function stop(code = 0) {
  if (closing) return;
  closing = true;
  desktop?.kill();
  vite?.kill();
  process.exitCode = code;
}
process.on('SIGINT',()=>stop());
process.on('SIGTERM',()=>stop());
vite?.once('error',error=>{console.error(error.message);stop(1);});
vite?.once('exit',code=>stop(code || 0));
async function ready() {
  for (let attempt=0;attempt<100 && !closing;attempt++) {
    const ok = await new Promise(resolve=>{
      const request = http.get(url,response=>{response.resume();resolve(response.statusCode===200);});
      request.on('error',()=>resolve(false));
      request.setTimeout(500,()=>request.destroy());
    });
    if (ok) return;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw new Error('The local development preview did not start.');
}
ready().then(async()=>{
  if (closing) return;
  const cached = path.join(process.env.USERPROFILE || '', '.codex/cache/spoti-playback/electron-v45.2.1-wvcus-win32-x64/electron.exe');
  const executable = process.env.SPOTI_ELECTRON_PATH || (process.platform === 'win32' && existsSync(cached) ? cached : require('electron'));
  const installedJava = path.join(process.env.LOCALAPPDATA || '', 'Programs/Spoti for PC/resources/runtime/bin/java.exe');
  const java = process.env.SPOTI_JAVA || (process.platform === 'win32' && existsSync(installedJava) ? installedJava : undefined);
  let backendLib = process.env.SPOTI_BACKEND_LIB;
  if (!backendLib && process.platform === 'win32' && root.startsWith('\\\\')) {
    const {stageBackend} = require('./stage-backend.cjs');
    backendLib = await stageBackend(path.resolve(root,'../base/desktop-server/build/install/desktop-server/lib'),
      path.join(process.env.USERPROFILE,'.codex/cache/spoti-playback/dev-backends'));
  }
  if (closing) return;
  const args=[root];
  if (process.env.SPOTI_DEV_PROFILE) args.push(`--user-data-dir=${process.env.SPOTI_DEV_PROFILE}`);
  desktop = spawn(executable,args, {cwd:root,stdio:'inherit',env:{...process.env,SPOTI_DEV_URL:url,...(java ? {SPOTI_JAVA:java} : {}),...(backendLib ? {SPOTI_BACKEND_LIB:backendLib} : {})}});
  console.log(`My Spoti development preview: ${url}`);
  desktop.once('error',error=>{console.error(error.message);stop(1);});
  desktop.once('exit',code=>stop(code || 0));
}).catch(error=>{console.error(error.message);stop(1);});
