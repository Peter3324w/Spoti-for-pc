const PLAYER = 'https://open.spotify.com';
function allowedNavigation(url) {
  try {
    const target = new URL(url);
    return target.protocol === 'https:' && ['open.spotify.com', 'accounts.spotify.com'].includes(target.hostname);
  } catch { return false; }
}
function isPlayer(url) {
  try { return new URL(url).origin === PLAYER; } catch { return false; }
}
async function createEmbeddedPage(window, {WebContentsView, session}, callbacks) {
  const playbackSession = session.fromPartition('persist:spoti-embedded-playback');
  playbackSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(permission === 'mediaKeySystem' && isPlayer(wc.getURL()) && details.isMainFrame === true && isPlayer(details.requestingUrl));
  });
  playbackSession.setPermissionCheckHandler((wc, permission, origin, details) =>
    permission === 'mediaKeySystem' && !!wc && isPlayer(wc.getURL()) && isPlayer(origin) && details.isMainFrame === true);

  const view = new WebContentsView({webPreferences: {
    session: playbackSession, contextIsolation: true, nodeIntegration: false,
    sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
  }});
  const wc = view.webContents;
  // Request the desktop Web Player rather than Spotify's limited embedded-browser site.
  wc.setUserAgent(wc.getUserAgent()
    .replace(/(\(KHTML, like Gecko\)) .*?(Chrome\/)/, '$1 $2')
    .replace(/\sElectron\/\S+/g, ''));
  let closed = false;
  let loginVisible = false;
  let loading = false;
  const licenseFilter = {urls: ['https://*.spotify.com/widevine-license/*']};
  playbackSession.webRequest.onCompleted(licenseFilter, details => {
    if (closed || !isPlayer(wc.getURL())) return;
    const url = new URL(details.url);
    if (url.pathname === '/widevine-license/v1/audio/license' && details.statusCode >= 400) {
      callbacks.playbackError?.({kind: 'audio-license', status: details.statusCode});
    }
  });
  let mainFrameId;
  let trustedContext;
  const bounds = () => {
    const {width, height} = window.getContentBounds();
    view.setBounds({x: 0, y: 52, width, height: Math.max(0, height - 52)});
  };
  window.contentView.addChildView(view);
  view.setVisible(false);
  bounds();
  window.on('resize', bounds);
  wc.setWindowOpenHandler(({url}) => {
    if (allowedNavigation(url)) wc.loadURL(url).catch(() => callbacks.lifecycle('failed'));
    return {action: 'deny'};
  });
  const guard = (event, url) => { if (!allowedNavigation(url)) event.preventDefault(); };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);
  wc.on('will-frame-navigate', event => {
    if (event.isMainFrame && !allowedNavigation(event.url)) event.preventDefault();
  });
  wc.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
    if (!closed && mainFrame && !inPlace) {
      loading = true;
      view.setVisible(false);
      callbacks.lifecycle('starting');
    }
  });
  wc.on('did-finish-load', () => {
    if (closed) return;
    loading = false;
    view.setVisible(loginVisible);
    if (isPlayer(wc.getURL())) callbacks.lifecycle('loaded');
  });
  wc.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) callbacks.lifecycle('failed');
  });
  wc.on('render-process-gone', () => callbacks.lifecycle('failed'));
  wc.on('content-bounds-updated', event => event.preventDefault());
  wc.debugger.on('message', (_event, method, params) => {
    if (closed) return;
    if (method === 'Page.frameNavigated' && !params.frame.parentId) {
      mainFrameId = params.frame.id;
      trustedContext = undefined;
    }
    if (method === 'Runtime.executionContextsCleared' ||
        (method === 'Runtime.executionContextDestroyed' && params.executionContextId === trustedContext)) trustedContext = undefined;
    if (method === 'Runtime.executionContextCreated') {
      const context = params.context;
      if (context.auxData?.isDefault && context.auxData.frameId === mainFrameId && context.origin === PLAYER) trustedContext = context.id;
    }
    if (isPlayer(wc.getURL()) && method === 'Runtime.bindingCalled' && params.name === '__mspHostPost' &&
        trustedContext !== undefined && params.executionContextId === trustedContext) callbacks.message(params.payload);
  });
  try {
    // A WebContentsView has no renderer until its first navigation.
    // Start it locally before sending CDP commands, which otherwise never answer.
    await wc.loadURL('about:blank');
    wc.debugger.attach('1.3');
    await wc.debugger.sendCommand('Page.enable');
    const tree = await wc.debugger.sendCommand('Page.getFrameTree');
    mainFrameId = tree.frameTree.frame.id;
    await wc.debugger.sendCommand('Runtime.enable');
    await wc.debugger.sendCommand('Runtime.addBinding', {name: '__mspHostPost'});
  } catch (error) {
    window.removeListener('resize', bounds);
    playbackSession.webRequest.onCompleted(licenseFilter, null);
    if (!window.isDestroyed?.()) window.contentView.removeChildView(view);
    wc.close();
    throw error;
  }
  return {
    load: () => wc.loadURL(`${PLAYER}/`),
    async evaluate(script) {
      if (closed || wc.isDestroyed() || !isPlayer(wc.getURL())) throw new Error('Spotify player is not ready.');
      const result = await wc.debugger.sendCommand('Runtime.evaluate', {
        expression: script, awaitPromise: false, userGesture: true,
      });
      if (result.exceptionDetails) throw new Error('Could not evaluate the playback command.');
    },
    setLoginVisible(visible) {
      loginVisible = visible;
      if (!closed) { bounds(); view.setVisible(visible && !loading); }
    },
    async close() {
      if (closed) return;
      closed = true;
      window.removeListener('resize', bounds);
      playbackSession.webRequest.onCompleted(licenseFilter, null);
      if (!window.isDestroyed?.()) window.contentView.removeChildView(view);
      if (!wc.isDestroyed()) {
        if (wc.debugger.isAttached()) wc.debugger.detach();
        wc.close();
      }
    },
  };
}
module.exports = {createEmbeddedPage, allowedNavigation};
