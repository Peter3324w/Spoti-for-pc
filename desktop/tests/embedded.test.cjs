const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createEmbeddedPage, allowedNavigation } = require('../electron/embedded.cjs');
function fixture() {
  const wc = new EventEmitter();
  wc.url = 'https://open.spotify.com/';
  wc.getURL = () => wc.url;
  wc.getUserAgent = () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) spoti-for-pc/0.1.0 Chrome/158.0.0.0 Electron/45.2.1 Safari/537.36';
  wc.setUserAgent = value => {wc.userAgent=value;};
  wc.isDestroyed = () => false;
  wc.close = () => { wc.closed = true; };
  wc.setWindowOpenHandler = handler => { wc.open = handler; };
  wc.loadURL = async url => { wc.url = url; wc.loaded = true; };
  wc.debugger = new EventEmitter();
  wc.debugger.attach = () => {};
  wc.debugger.isAttached = () => true;
  wc.debugger.detach = () => {};
  const evaluations = [];
  wc.debugger.sendCommand = async (method, args) => { if(method==='Page.enable' && !wc.loaded) throw Error('No renderer exists before navigation'); evaluations.push({method, args}); return method==='Page.getFrameTree' ? {frameTree:{frame:{id:'main'}}} : {}; };
  const permissions = {};
  const ses = {
    setPermissionRequestHandler: handler => { permissions.request = handler; },
    setPermissionCheckHandler: handler => { permissions.check = handler; },
  };
  class View {
    constructor(options) { this.options = options; this.webContents = wc; }
    setBounds(bounds) { this.bounds = bounds; }
    setVisible(visible) { this.visible = visible; }
  }
  const window = new EventEmitter();
  window.getContentBounds = () => ({width: 1000, height: 700});
  window.contentView = {addChildView: view => { window.view = view; }, removeChildView: () => { window.removed = true; }};
  const messages = [], lifecycle = [];
  return {wc, window, evaluations, permissions, messages, lifecycle, electron: {WebContentsView:View, session:{fromPartition:()=>ses}}};
}
test('embedded page keeps remote content isolated, activates Play and closes without another window', async () => {
  const f = fixture();
  const page = await createEmbeddedPage(f.window, f.electron, {message: m => f.messages.push(m), lifecycle: m => f.lifecycle.push(m)});
  assert.equal(f.window.view.options.webPreferences.nodeIntegration, false);
  assert.equal(f.window.view.options.webPreferences.sandbox, true);
  assert.equal(f.window.view.options.webPreferences.preload, undefined);
  assert.equal(f.wc.userAgent, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36');
  await page.load();
  await page.evaluate('window.Myspoti.call(1,"player.resume",{})');
  const evaluation = f.evaluations.find(e => e.method === 'Runtime.evaluate');
  assert.equal(evaluation.args.userGesture, true);
  page.setLoginVisible(true);
  assert.equal(f.window.view.visible, true);
  assert.deepEqual(f.window.view.bounds, {x:0,y:52,width:1000,height:648});
  page.setLoginVisible(false);
  assert.equal(f.window.view.visible, false);
  await page.close();
  assert.equal(f.wc.closed, true);
  assert.equal(f.window.removed, true);
});
test('remote navigation cannot leave Spotify or use lookalike hostnames', () => {
  for (const url of ['https://open.spotify.com/','https://accounts.spotify.com/en/login']) assert.equal(allowedNavigation(url), true);
  for (const url of ['file:///etc/passwd','https://open.spotify.com.evil.test/','javascript:alert(1)','http://open.spotify.com/']) assert.equal(allowedNavigation(url), false);
});
test('bridge only accepts messages on Spotify and refuses evaluation during login navigation', async () => {
  const f = fixture();
  const page = await createEmbeddedPage(f.window, f.electron, {message: m => f.messages.push(m), lifecycle: m => f.lifecycle.push(m)});
  await page.load();
  f.wc.debugger.emit('message', {}, 'Runtime.executionContextCreated', {context:{id:1, origin:'https://open.spotify.com',auxData:{isDefault:true,frameId:'main'}}});
  f.wc.debugger.emit('message', {}, 'Runtime.bindingCalled', {executionContextId:1,name:'__mspHostPost', payload:'{"type":"ready"}'});
  assert.equal(f.messages.length, 1);
  f.wc.url = 'https://accounts.spotify.com/en/login';
  f.wc.debugger.emit('message', {}, 'Runtime.bindingCalled', {name:'__mspHostPost', payload:'{}'});
  assert.equal(f.messages.length, 1);
  await assert.rejects(page.evaluate('secret'), /Spotify player/);
  assert.deepEqual(f.wc.open({url:'https://evil.test/'}), {action:'deny'});
  await page.close();
});
test('script exceptions are reported rather than acknowledged as successful', async () => {
  const f = fixture();
  const page = await createEmbeddedPage(f.window, f.electron, {message:()=>{}, lifecycle:()=>{}});
  await page.load();
  f.wc.debugger.sendCommand = async () => ({exceptionDetails:{text:'sensitive error'}});
  await assert.rejects(page.evaluate('throw Error()'), /evaluate/);
  await page.close();
});
test('main-frame navigation uses the current Electron event object and blocks hostile destinations', async () => {
  const f = fixture();
  const page = await createEmbeddedPage(f.window, f.electron, {message:()=>{},lifecycle:()=>{}});
  let blocked = false;
  f.wc.emit('will-frame-navigate', {url:'https://evil.test', isMainFrame:true, preventDefault:()=>{blocked=true;}});
  assert.equal(blocked, true);
  await page.close();
});

test('foreign subframes cannot forge bridge results and protected-media permission stays on Spotify', async () => {
  const f=fixture();
  const page=await createEmbeddedPage(f.window,f.electron,{message:m=>f.messages.push(m),lifecycle:()=>{}});
  await page.load();
  f.wc.debugger.emit('message',{},'Runtime.executionContextCreated',{context:{id:2,origin:'https://evil.test',auxData:{isDefault:true,frameId:'child'}}});
  for(const type of ['ready','result','state']) f.wc.debugger.emit('message',{},'Runtime.bindingCalled',{executionContextId:2,name:'__mspHostPost',payload:JSON.stringify({type})});
  assert.equal(f.messages.length,0);
  assert.equal(f.permissions.check(f.wc,'mediaKeySystem','https://open.spotify.com',{isMainFrame:true}),true);
  assert.equal(f.permissions.check(f.wc,'mediaKeySystem','https://evil.test',{}),false);
  assert.equal(f.permissions.check(f.wc,'media','https://open.spotify.com',{}),false);
  let allowed;
  f.permissions.request(f.wc,'mediaKeySystem',value=>{allowed=value;},{requestingUrl:'https://open.spotify.com/',isMainFrame:true});
  assert.equal(allowed,true);
  await page.close();
});
test('closing the parent window still disposes its playback web contents', async () => {
  const f=fixture();
  const page=await createEmbeddedPage(f.window,f.electron,{message:()=>{},lifecycle:()=>{}});
  f.window.isDestroyed=()=>true;
  f.window.contentView.removeChildView=()=>{throw Error('Parent view is destroyed');};
  await page.close();
  assert.equal(f.wc.closed,true);
});
