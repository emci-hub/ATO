const { chromium } = require('playwright');
const DEV = { max: { w: 430, h: 932, top: 59, bottom: 34 }, se: { w: 375, h: 667, top: 20, bottom: 0 } };
async function open(dev, url, ctxOpts = {}) {
  const d = DEV[dev];
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 2, ...ctxOpts });
  await ctx.addInitScript(({ top, bottom }) => {
    const css = `body > div[style*="safe-area-inset"]{padding-top:${top}px !important;padding-bottom:${bottom}px !important}`;
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  }, d);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(url, { waitUntil: 'networkidle', timeout: 300000 });
  await p.waitForTimeout(3000);
  return { b, ctx, p, d };
}
async function frame(p, d, out) {
  // Paint the status bar + home indicator zones so the shot reads like the phone.
  await p.evaluate(({ top, bottom }) => {
    document.querySelectorAll('.__inset').forEach((n) => n.remove());
    const mk = (css) => { const n = document.createElement('div'); n.className = '__inset'; n.style.cssText = 'position:fixed;left:0;right:0;z-index:99999;pointer-events:none;' + css; document.body.appendChild(n); };
    if (top) mk(`top:0;height:${top}px;background:repeating-linear-gradient(45deg,rgba(255,0,255,.18) 0 6px,transparent 6px 12px)`);
    if (bottom) mk(`bottom:0;height:${bottom}px;background:repeating-linear-gradient(45deg,rgba(255,0,255,.18) 0 6px,transparent 6px 12px)`);
  }, d);
  await p.screenshot({ path: out });
  await p.evaluate(() => document.querySelectorAll('.__inset').forEach((n) => n.remove()));
}
/** Rect of the first element matching aria-label (prefix) walked up until width >= minW. */
async function rectBy(p, sel, minW = 0, up = 0) {
  return p.evaluate(({ sel, minW, up }) => {
    let el = document.querySelector(sel);
    if (!el) return null;
    for (let i = 0; i < up; i++) el = el.parentElement;
    while (el && el.getBoundingClientRect().width < minW) el = el.parentElement;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width), left: Math.round(r.left) };
  }, { sel, minW, up });
}
module.exports = { open, frame, rectBy, DEV };
