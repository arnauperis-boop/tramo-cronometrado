// Drives whole stages with an autopilot, using the game's own physics, to check
// that the car stays stable and every stage can be finished.
//
//   npm test                                   stages 1-3 on gravel, asphalt and snow
//   STAGES=1,4,7 SURFACES=grava npm test       choose stages and surfaces
//   KEYBOARD=1 npm test                        all-or-nothing steering, like a keyboard
//   CHROMIUM_PATH=/path/to/chrome npm test     use an existing Chromium instead of Playwright's
//
// three.js is served from node_modules, so no network access is needed.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const three = readFileSync(new URL('node_modules/three/build/three.module.min.js', root));
const stages = (process.env.STAGES || '1,2,3').split(',').map(Number);
const surfaces = (process.env.SURFACES || 'grava,asfalto,nieve').split(',');
const keyboard = process.env.KEYBOARD === '1';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: three }));
await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
await page.route('http://tramo.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
await page.goto('http://tramo.test/');
const ready = () => page.waitForFunction(() => window.__tramo?.world && document.getElementById('loading').hidden && !document.getElementById('m-go').disabled, null, { timeout: 60000 });
await ready();

let failed = 0;
for (const surface of surfaces) {
  for (const num of stages) {
    await page.evaluate(([surface, num]) => {
      const radio = document.getElementById('s-' + surface);
      radio.checked = true; radio.dispatchEvent(new Event('change'));
      while (window.__tramo.stage.num < num) document.getElementById('m-next').click();
      while (window.__tramo.stage.num > num) document.getElementById('m-prev').click();
    }, [surface, num]);
    await page.waitForTimeout(300);
    await ready();
    const r = await page.evaluate((keyboard) => {
      const T = window.__tramo, st = T.stage, c = T.car, inp = T.input, g = T.game, DT = 1 / 240;
      T.settings.assists = true;
      T.startRun();
      for (let i = 0; i < 240 * 4.2; i++) T.stepGame(DT);
      const mu = T.world.S.mu * 0.85;
      const kAt = (i) => { const j = Math.min(st.n - 2, Math.max(0, i)); return (st.th[j + 1] - st.th[j]) / Math.max(0.01, st.s[j + 1] - st.s[j]); };
      let t = 0, maxV = 0, steerKeys = 0, bad = false;
      while (g.state === 'running' && t < 600) {
        const i = c.prog, v = Math.hypot(c.vx, c.vy);
        // pure pursuit aimed with the velocity vector, so it copes with drifts
        const ld = Math.max(7, Math.min(45, v * 0.95)), la = Math.min(st.n - 1, i + Math.round(ld));
        const aim = Math.atan2(st.x[la] - c.x, st.z[la] - c.z) - (c.th + Math.atan2(c.vy, Math.max(Math.abs(c.vx), 3)));
        const err = Math.atan2(Math.sin(aim), Math.cos(aim));
        const delta = Math.atan(((2 * Math.sin(err)) / ld) * 2.5 * (1 + 0.0015 * v * v));
        const want = Math.max(-1, Math.min(1, delta / (0.6 / (1 + Math.abs(c.vx) / 14) + 0.035)));
        if (keyboard) {
          const key = want > 0.25 ? 1 : want < -0.25 ? -1 : 0;
          if (key === 0 || key * steerKeys < 0) steerKeys = Math.abs(steerKeys) < 9 * DT ? 0 : steerKeys - Math.sign(steerKeys) * 9 * DT;
          else steerKeys = Math.max(-1, Math.min(1, steerKeys + key * 5.5 * DT));
          inp.steer = steerKeys;
        } else inp.steer = want;
        // brake for what is coming in the next 180 m
        let target = 60;
        for (let j = i; j < Math.min(st.n - 1, i + 180); j += 2) {
          const k = Math.abs(kAt(j)), vmax = k > 1e-4 ? Math.sqrt((mu * 9.81) / k) : 60;
          target = Math.min(target, Math.sqrt(vmax * vmax + 2 * 0.75 * mu * 9.81 * Math.max(0, st.s[j] - st.s[i] - 4)));
        }
        inp.throttle = v < target - 0.5 ? 1 : 0; inp.brake = v > target + 1.5 ? 1 : 0; inp.hb = false;
        T.stepGame(DT); t += DT;
        maxV = Math.max(maxV, v);
        if (!Number.isFinite(c.x) || !Number.isFinite(c.vx) || !Number.isFinite(c.y)) { bad = true; break; }
      }
      const out = { state: g.state, time: g.time, penalty: g.penalty, damage: c.damage, maxKmh: maxV * 3.6, km: st.sFinish / 1000, bad };
      document.getElementById('results').hidden = true;
      document.getElementById('r-menu').click();
      return out;
    }, keyboard);
    const ok = r.state === 'finished' && !r.bad;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} TC ${num} ${surface.padEnd(7)} ${r.km.toFixed(2)} km  ${r.state.padEnd(8)} ${r.time.toFixed(1).padStart(6)} s  +${r.penalty} s  daños ${r.damage.toFixed(0).padStart(3)} %  máx ${r.maxKmh.toFixed(0)} km/h${r.bad ? '  (NaN)' : ''}`);
  }
}
await browser.close();
if (errors.length) { console.log('Errores en la página:\n' + errors.join('\n')); failed++; }
console.log(failed ? `${failed} fallo(s)` : 'Todo correcto');
process.exit(failed ? 1 : 0);
