// Electron chart access: read/operate the existing embedded document, never
// create a browser or change the user's viewport.
export async function desktopTvEval(page, jsCode) {
  return page.evaluate(async (code) => {
    const webview = document.querySelector("webview");
    if (!webview) throw Error("TradingView webview not found");
    return webview.executeJavaScript(`(()=>{
      const iframe=document.querySelector('iframe');
      if(!iframe?.contentDocument)throw Error('TradingView iframe not ready');
      const doc=iframe.contentDocument;
      ${code}
    })()`);
  }, jsCode);
}
