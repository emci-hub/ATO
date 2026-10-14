const fs = require('fs');
const { open, frame } = require('./lib.js');
(async () => {
  const [,, dev] = process.argv;
  const seed = fs.readFileSync(__dirname + '/seed.json', 'utf8');
  const { b, p, d } = await open(dev, 'http://localhost:8081/');
  await p.evaluate((s) => localStorage.setItem('ato.play.store.v1', s), seed);
  await p.goto('http://localhost:8081/play', { waitUntil: 'networkidle' }); await p.waitForTimeout(3500);
  const shot = (n) => frame(p, d, `${__dirname}/out/${dev}-${n}.png`);
  const tab = async (t) => { await p.locator(`[role=tablist] [aria-label="${t}"]`).first().click(); await p.waitForTimeout(2500); };
  const board = () => p.evaluate(() => { const s=[...document.querySelectorAll('svg[viewBox="0 0 100 100"]')].filter(e=>e.getBoundingClientRect().width>0).sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0]; if(!s) return null; const r=s.parentElement.getBoundingClientRect(); return [Math.round(r.top),Math.round(r.height)]; });
  await shot('block');
  await tab('Hideout'); await shot('hideout');
  await tab('Turf War'); await shot('turf-setup'); console.log('setup board', await board());
  await p.locator('[aria-label="Call wave"]').first().click(); await p.waitForTimeout(2500); await shot('turf-wave'); console.log('wave board', await board());
  await p.locator('[aria-label="Pause wave"]').first().click(); await p.waitForTimeout(1200); await shot('turf-paused'); console.log('paused board', await board());
  await p.goto('http://localhost:8081/play', { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
  await tab('Locker'); await shot('locker');
  await b.close();
  for (const [n, q] of [['dive', 'shot=dive&phase=mid'], ['catch', 'shot=catch']]) {
    const o = await open(dev, `http://localhost:8081/play?${q}&inset=${dev}`);
    await o.p.waitForTimeout(1500); await frame(o.p, o.d, `${__dirname}/out/${dev}-${n}.png`); await o.b.close();
  }
})();
