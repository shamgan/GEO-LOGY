// ארבע ההדמיות הדינמיות של היחידה — ציור Canvas עם מרקמי צילום (Poly Haven, CC0) ותאורה מדומה.
const W = 1200, H = 620;
const TEX = { ground: 'assets/tex/ground-Diffuse.jpg', cliff: 'assets/tex/cliff_side-Diffuse.jpg', basalt: 'assets/tex/dark_rock_02-Diffuse.jpg' };
const cache = {};
function loadTex(k) {
  if (!cache[k]) cache[k] = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = TEX[k]; });
  return cache[k];
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);

// מילוי צורה במרקם צילום עם גוון ותאורה
function texFill(ctx, img, pathFn, { tint = null, tintAlpha = 0.45, scale = 0.5, ox = 0, oy = 0, shade = null, mode = 'multiply' } = {}) {
  ctx.save();
  ctx.beginPath(); pathFn(ctx); ctx.clip();
  if (img) {
    const pat = ctx.createPattern(img, 'repeat');
    const m = new DOMMatrix().translateSelf(ox, oy).scaleSelf(scale, scale);
    pat.setTransform(m);
    ctx.fillStyle = pat; ctx.fillRect(-50, -50, W + 100, H + 100);
  } else { ctx.fillStyle = tint || '#777'; ctx.fillRect(0, 0, W, H); }
  if (tint) { ctx.globalCompositeOperation = mode; ctx.globalAlpha = tintAlpha; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); }
  if (shade) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = shade(ctx); ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
function sky(ctx, h, warm = false) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, warm ? '#6f93b8' : '#5d8fc4'); g.addColorStop(0.7, warm ? '#c9d9e4' : '#bcd5ea'); g.addColorStop(1, '#e9eef0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  const s = ctx.createRadialGradient(W * 0.82, h * 0.25, 4, W * 0.82, h * 0.25, 260);
  s.addColorStop(0, 'rgba(255,250,230,.85)'); s.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = s; ctx.fillRect(0, 0, W, h);
}
function waterGrad(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(38,128,170,.92)'); g.addColorStop(0.35, 'rgba(18,84,130,.94)'); g.addColorStop(1, 'rgba(6,36,70,.97)');
  return g;
}
function mantle(ctx, top, t) {
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#b4471b'); g.addColorStop(0.5, '#8e2f12'); g.addColorStop(1, '#5a1a0b');
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
}
function glow(ctx, x, y, r, a = 1, c = '255,150,40') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,240,170,${a})`); g.addColorStop(0.35, `rgba(${c},${a * 0.75})`); g.addColorStop(1, `rgba(${c},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
}
function label(ctx, text, x, y, { size = 22, color = '#fff', bg = 'rgba(8,24,32,.72)', align = 'center' } = {}) {
  ctx.save(); ctx.font = `700 ${size}px Assistant, Arial`; ctx.direction = 'rtl'; ctx.textAlign = align; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 22, h = size + 14;
  const lx = align === 'center' ? x - w / 2 : align === 'right' ? x - w + 11 : x - 11;
  ctx.fillStyle = bg; roundRect(ctx, lx, y - h / 2, w, h, 9); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(text, x, y + 1); ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function arrow(ctx, x, y, dir, len = 70, color = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - 14, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len / 2 + 4, 0); ctx.lineTo(len / 2 - 20, -15); ctx.lineTo(len / 2 - 20, 15); ctx.closePath(); ctx.fill(); ctx.restore();
}
function smoke(ctx, x, y, t, scale = 1) {
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const k = ((t * 0.35 + i / 14) % 1), r = (14 + k * 60) * scale;
    const px = x + Math.sin(i * 2.3 + t) * 10 * scale + k * 70 * scale, py = y - k * 170 * scale;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(70,66,64,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(70,66,64,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------- מסגרת כללית: Canvas, לולאת הנפשה ופקדים ----------
function frame(host, { title, modes, duration = 14, render, caption, timeLabel }) {
  host.innerHTML = `<div class="sim-shell">
    <div class="sim-stage"><canvas width="${W}" height="${H}" aria-label="${title}" role="img"></canvas><div class="sim-caption" aria-live="polite"></div></div>
    <div class="sim-controls">
      ${modes ? `<div class="sim-modes" role="group" aria-label="מצב ההדמיה">${modes.map((m, i) => `<button type="button" data-mode="${i}" aria-pressed="${i === 0}">${m}</button>`).join('')}</div>` : ''}
      <div class="sim-transport">
        <button type="button" class="sim-play primary">▶ הפעלה</button>
        <button type="button" class="sim-reset">↺ מההתחלה</button>
        <label class="sim-time"><span class="sr-only">ציר הזמן</span><input type="range" min="0" max="1000" value="0" aria-label="ציר הזמן"></label>
        <output class="sim-clock"></output>
      </div>
    </div></div>`;
  const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
  const playB = host.querySelector('.sim-play'), range = host.querySelector('input[type=range]'), clock = host.querySelector('.sim-clock'), cap = host.querySelector('.sim-caption');
  const st = { t: 0, playing: false, mode: 0, real: 0, tex: {}, started: false };
  let raf = 0, last = 0, alive = true;
  const draw = () => {
    ctx.save(); ctx.fillStyle = '#0d2a36'; ctx.fillRect(0, 0, W, H); render(ctx, st); ctx.restore();
    range.value = Math.round(st.t * 1000);
    clock.textContent = timeLabel ? timeLabel(st.t, st) : '';
    const c = caption(st.t, st); if (cap.textContent !== c) cap.textContent = c;
  };
  const loop = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; st.real += dt;
    if (st.playing) { st.t += dt / duration; if (st.t >= 1) { st.t = 1; setPlaying(false); } }
    draw(); raf = requestAnimationFrame(loop);
  };
  const setPlaying = p => { st.playing = p; if (p) { st.started = true; host.dispatchEvent(new CustomEvent('simplay', { bubbles: true })); } playB.textContent = p ? '❚❚ עצירה' : (st.t >= 1 ? '▶ שוב' : '▶ הפעלה'); };
  playB.onclick = () => { if (st.t >= 1) st.t = 0; setPlaying(!st.playing); };
  host.querySelector('.sim-reset').onclick = () => { st.t = 0; setPlaying(false); };
  range.oninput = () => { st.t = range.value / 1000; st.started = true; setPlaying(false); };
  host.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    st.mode = +b.dataset.mode; st.t = 0;
    host.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b));
    setPlaying(true);
  });
  Promise.all(Object.keys(TEX).map(k => loadTex(k).then(i => st.tex[k] = i))).then(() => { raf = requestAnimationFrame(loop); });
  return { destroy() { alive = false; cancelAnimationFrame(raf); } };
}

// ---------- הדמיה 1: פתיחה והתרחקות ----------
function divergent(host) {
  const cx = 600, sea = 120, v = 26; // v: פיקסלים למיליון שנה
  const floorY = x => 300 - 70 * Math.exp(-(((x - cx) / 210) ** 2));
  const ageColor = a => { const k = clamp(a / 20, 0, 1); return `rgb(${Math.round(lerp(196, 70, k))},${Math.round(lerp(70, 92, k))},${Math.round(lerp(40, 120, k))})`; };
  return frame(host, {
    title: 'הדמיה 1: תנועת פתיחה והתרחקות', duration: 16,
    timeLabel: t => `${Math.round(t * 20)} מיליון שנה`,
    caption: t => t < 0.02 ? 'הפעילו את ההדמיה ועקבו אחר גילי הסלעים משני צדי אזור הפתיחה.' : t < 0.5 ? 'הלוחות מתרחקים. מגמה עולה מהמעטפת ומתמצקת באזור הפתיחה.' : 'הסלע שנוצר באזור הפתיחה מתרחק ממנו עם הלוח — הסלעים הצעירים סמוכים לאזור הפתיחה, העתיקים רחוקים ממנו.',
    render(ctx, st) {
      const T = st.t * 20, tex = st.tex;
      sky(ctx, sea);
      // מעטפת
      mantle(ctx, 200, st.real);
      texFill(ctx, tex.cliff, c => c.rect(0, 200, W, H - 200), { tint: '#c2410c', tintAlpha: 0.8, scale: 1.15, mode: 'color' });
      // זרמים במעטפת
      ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,214,150,.55)'; ctx.lineWidth = 3; ctx.setLineDash([14, 14]); ctx.lineDashOffset = -st.real * 30;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 20, 600); ctx.bezierCurveTo(cx + s * 30, 430, cx + s * 160, 400, cx + s * 470, 420); ctx.stroke(); }
      ctx.restore();
      // מגמה עולה
      const pulse = 0.75 + 0.25 * Math.sin(st.real * 3);
      glow(ctx, cx, 330, 120 * pulse, 0.9);
      for (let i = 0; i < 18; i++) {
        const k = (st.real * 0.25 + i / 18) % 1, x = cx + Math.sin(i * 7.1) * 40 * (1 - k), y = lerp(600, 260, k);
        glow(ctx, x, y, 16 * (1 - k * 0.5), 0.55 * (1 - k * 0.6));
      }
      // ליתוספרה: פסים לפי גיל
      const strip = 6;
      for (let x = 0; x < W; x += strip) {
        const dx = Math.abs(x + strip / 2 - cx), age = dx / v; const top = floorY(x + strip / 2), thick = 26 + Math.min(80, dx * 0.18);
        if (dx < 6) continue;
        const birth = T - age; const band = Math.floor((birth + 400) / 2.5) % 2;
        ctx.fillStyle = ageColor(age); ctx.globalAlpha = 1; ctx.fillRect(x, top, strip + 0.6, thick);
        if (band) { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x, top, strip + 0.6, thick); }
      }
      // החלת המרקם על הליתוספרה בשקיפות (overlay)
      ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.85;
      texFill(ctx, tex.basalt, c => { for (let x = 0; x < W; x += 6) { const dx = Math.abs(x - cx); c.rect(x, floorY(x), 6.6, 26 + Math.min(80, dx * 0.18)); } }, { scale: 0.45, ox: (st.t * 0) });
      ctx.restore();
      // סדק ומגמה במרכז
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(cx - 7, floorY(cx) + 4); ctx.lineTo(cx + 7, floorY(cx) + 4); ctx.lineTo(cx + 14, 370); ctx.lineTo(cx - 14, 370); ctx.fill();
      glow(ctx, cx, floorY(cx) + 10, 46, 0.9);
      // מים
      ctx.fillStyle = waterGrad(ctx, sea, 300);
      ctx.beginPath(); ctx.moveTo(0, sea); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, sea + Math.sin(x / 60 + st.real * 1.5) * 2); ctx.lineTo(W, 0); ctx.lineTo(W, 330);
      for (let x = W; x >= 0; x -= 6) ctx.lineTo(x, floorY(x)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, sea + Math.sin(x / 60 + st.real * 1.5) * 2); ctx.stroke();
      // דגימות סלע שנעות עם הלוח
      for (const s of [-1, 1]) for (const born of [2, 9]) {
        if (T < born) continue; const x = cx + s * (T - born) * v;
        if (x < 30 || x > W - 30) continue;
        const y = floorY(x);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0b2530'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 2, 8, 0, 7); ctx.fill(); ctx.stroke();
        label(ctx, `גיל ${Math.round(T - born)} מ' שנה`, x, y - 34, { size: 17 });
      }
      // חצים ותוויות
      arrow(ctx, cx - 300, 470, Math.PI, 110); arrow(ctx, cx + 300, 470, 0, 110);
      label(ctx, 'אזור הפתיחה — רכס מרכז־אוקייני', cx, 40, { size: 20 });
      label(ctx, 'מעטפת', 120, 560, { size: 20 }); label(ctx, 'מגמה עולה', cx, 520, { size: 19, bg: 'rgba(120,40,10,.8)' });
      // מקרא גילים
      const lx = 930, ly = 560; const lg = ctx.createLinearGradient(lx, 0, lx + 220, 0);
      for (let i = 0; i <= 10; i++) lg.addColorStop(i / 10, ageColor(i * 2));
      ctx.fillStyle = 'rgba(8,24,32,.75)'; roundRect(ctx, lx - 14, ly - 34, 248, 72, 10); ctx.fill();
      ctx.fillStyle = lg; ctx.fillRect(lx, ly - 4, 220, 16);
      ctx.font = '700 16px Assistant, Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.fillText('גיל הסלעים:', lx + 220, ly - 16);
      ctx.textAlign = 'left'; ctx.fillText('צעיר', lx, ly + 28); ctx.textAlign = 'right'; ctx.fillText('עתיק', lx + 220, ly + 28);
      vignette(ctx);
    }
  });
}

// ---------- הדמיה 2: הפחתה והתקרבות — שלושה מצבים ----------
function convergent(host) {
  const modes = ['אוקיינית ויבשתית', 'אוקיינית ואוקיינית', 'יבשתית ויבשתית'];
  const sea = 150, bx = 560;
  return frame(host, {
    title: 'הדמיה 2: תנועת הפחתה והתקרבות', modes, duration: 15,
    timeLabel: t => `${Math.round(t * 30)} מיליון שנה`,
    caption: (t, st) => {
      if (t < 0.02) return 'בחרו מצב והפעילו: מה קורה כאשר שני לוחות נעים זה לעבר זה?';
      return [
        'הליתוספרה האוקיינית, הכבדה, שוקעת מתחת ליבשתית. נוצרים תהום אוקיינית ורכס הרי געש ביבשה, ומתרחשות רעידות אדמה.',
        'אחת שוקעת מתחת לשנייה. נוצרים תהום אוקיינית ושרשרת איים געשיים, ומתרחשות רעידות אדמה.',
        'שתיהן קלות, ואף אחת אינה שוקעת עמוק. הקרום מתקצר, מתעבה ומתרומם לרכס הרים גבוה. רעידות אדמה, ללא שרשרת הרי געש.'
      ][st.mode];
    },
    render(ctx, st) {
      const t = st.t, m = st.mode, tex = st.tex, R = st.real;
      sky(ctx, 240);
      mantle(ctx, 200, R);
      texFill(ctx, tex.cliff, c => c.rect(0, 200, W, H - 200), { tint: '#b4390d', tintAlpha: 0.82, scale: 1.15, mode: 'color' });
      const quake = (Math.sin(R * 2.7) > 0.93 && st.playing);
      if (m < 2) {
        // לוח אוקייני שוקע (שמאל) — קו מרכזי של הלוח השוקע
        const slabLen = 120 + t * 360;
        const slabPt = s => { // s: מרחק לאורך הלוח מהתהום
          const a = Math.min(1, s / 260) * 0.75 + Math.max(0, (s - 260) / 400) * 0.25;
          const ang = a * 1.05; return [bx + Math.cos(ang) * s * 0.92, 245 + Math.sin(ang) * s * 0.92 * (s / (s + 120)) * 1.25];
        };
        const th = 64;
        const pts = []; for (let s = 0; s <= slabLen; s += 8) pts.push(slabPt(s));
        // הלוח השוקע: קו מרכזי עבה המצויר במרקם בזלת
        const center = [[-80, 262], [bx - 30, 262], ...pts.map(p => [p[0] - 20, p[1] + 30])];
        const strokeLine = () => { ctx.beginPath(); center.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); };
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
        strokeLine(); ctx.strokeStyle = '#1d2226'; ctx.lineWidth = th + 8; ctx.stroke();
        if (tex.basalt) { const pat = ctx.createPattern(tex.basalt, 'repeat'); pat.setTransform(new DOMMatrix().translateSelf(t * 260, 0).scaleSelf(0.4, 0.4)); ctx.strokeStyle = pat; ctx.lineWidth = th; strokeLine(); ctx.stroke(); }
        ctx.globalCompositeOperation = 'multiply'; ctx.strokeStyle = 'rgba(160,165,170,.45)'; ctx.lineWidth = th; strokeLine(); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.setLineDash([3, 26]); ctx.lineDashOffset = -t * 700; strokeLine(); ctx.stroke();
        ctx.restore();
        // התכה בעומק
        if (t > 0.25) { const e = slabPt(Math.min(slabLen, 300)); glow(ctx, e[0] + 20, e[1] - 10, 70 * ease(clamp((t - 0.25) * 3, 0, 1)), 0.8); }
        // צלחת עליונה
        const vx = m === 0 ? 800 : 760;
        const vh = ease(clamp((t - 0.35) / 0.55, 0, 1));
        if (m === 0) {
          // יבשת עבה
          const topY = x => 175 - (x > 600 ? Math.min(1, (x - 600) / 120) * 25 : 0) - vh * 150 * Math.exp(-(((x - vx) / 70) ** 2)) - vh * 40 * Math.exp(-(((x - 980) / 60) ** 2));
          const path = c => { c.moveTo(bx - 20, 232); for (let x = bx - 20; x <= W; x += 6) c.lineTo(x, topY(x)); c.lineTo(W, 330); c.lineTo(bx + 220, 330); pts.forEach((p, i) => { if (i % 2 === 0 && p[0] > bx + 10) c.lineTo(p[0] + 4, Math.min(330, p[1] - 4)); }); c.lineTo(bx - 20, 232); c.closePath(); };
          texFill(ctx, tex.cliff, path, { tint: '#9b7a55', tintAlpha: 0.3, scale: 0.5 });
          // קרקע עליונה
          texFill(ctx, tex.ground, c => { c.moveTo(bx + 20, topY(bx + 20)); for (let x = bx + 20; x <= W; x += 6) c.lineTo(x, topY(x)); for (let x = W; x >= bx + 20; x -= 6) c.lineTo(x, topY(x) + 14); c.closePath(); }, { tint: '#6c8a3a', tintAlpha: 0.35, scale: 0.35 });
          if (vh > 0.05) {
            for (const [x, s] of [[vx, 1], [980, 0.55]]) {
              const y = topY(x); ctx.save(); ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 6 * s; ctx.shadowColor = '#ff8a00'; ctx.shadowBlur = 18;
              ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 8, (y + 330) / 2, x - 50, 330); ctx.stroke(); ctx.restore();
              glow(ctx, x, y, 34 * s * vh, 0.95); smoke(ctx, x, y - 6, R, s * vh);
            }
          }
          label(ctx, 'ליתוספרה יבשתית', 1010, 290, { size: 18 }); label(ctx, 'רכס הרי געש ביבשה', vx, 60, { size: 19 });
        } else {
          // לוח אוקייני עליון ואיים
          const topY = x => 232 - vh * 175 * Math.exp(-(((x - vx) / 60) ** 2)) - vh * 135 * Math.exp(-(((x - 900) / 50) ** 2));
          const path = c => { c.moveTo(bx - 10, 232); for (let x = bx - 10; x <= W; x += 6) c.lineTo(x, topY(x)); c.lineTo(W, 290); c.lineTo(bx + 200, 290); c.closePath(); };
          texFill(ctx, tex.basalt, path, { tint: '#4a5560', tintAlpha: 0.3, scale: 0.42 });
          if (vh > 0.05) for (const [x, s] of [[vx, 1], [900, 0.7]]) { const y = topY(x); glow(ctx, x, y, 30 * s * vh, 0.9); if (y < sea) smoke(ctx, x, y - 4, R, s * vh); }
          label(ctx, 'שרשרת איים געשיים', vx, 60, { size: 19 });
        }
        // מים
        const waterTop = sea, floorLeft = 230;
        ctx.fillStyle = waterGrad(ctx, waterTop, 300);
        ctx.beginPath(); ctx.moveTo(0, waterTop); for (let x = 0; x <= (m === 0 ? bx + 70 : bx - 10); x += 20) ctx.lineTo(x, waterTop + Math.sin(x / 50 + R) * 2);
        if (m === 0) { ctx.lineTo(bx + 70, 200); ctx.lineTo(bx + 20, 248); } else { ctx.lineTo(bx - 10, 232); }
        ctx.lineTo(bx + 10, 252); ctx.lineTo(bx - 20, 262); ctx.lineTo(bx - 60, floorLeft); ctx.lineTo(0, floorLeft); ctx.closePath();
        ctx.save(); ctx.clip(); ctx.fillRect(0, 0, W, H);
        if (m === 1) { // הסתרת המים מעל האיים
        }
        ctx.restore();
        if (m === 1) {
          const vh2 = vh; const topY = x => 232 - vh2 * 175 * Math.exp(-(((x - vx) / 60) ** 2)) - vh2 * 135 * Math.exp(-(((x - 900) / 50) ** 2));
          ctx.fillStyle = waterGrad(ctx, sea, 300); ctx.beginPath(); ctx.moveTo(bx - 12, sea); for (let x = bx - 12; x <= W; x += 6) ctx.lineTo(x, sea + Math.sin(x / 50 + R) * 2); for (let x = W; x >= bx - 4; x -= 6) ctx.lineTo(x, Math.max(sea, topY(x))); ctx.lineTo(bx - 12, 236); ctx.closePath(); ctx.fill();
          // חלקי איים מעל המים — חוף
          texFill(ctx, tex.ground, c => { c.moveTo(vx - 70, sea + 2); for (let x = vx - 70; x <= 960; x += 4) c.lineTo(x, Math.min(sea + 2, topY(x))); c.closePath(); }, { tint: '#3f5d2a', tintAlpha: 0.4, scale: 0.3 });
          for (const [x, s] of [[vx, 1], [900, 0.7]]) { const y = topY(x); if (vh > 0.05 && y < sea) { glow(ctx, x, y, 26 * s, 0.9); smoke(ctx, x, y - 4, R, s * vh); } }
        }
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 0; x <= (m === 0 ? bx + 70 : W); x += 20) ctx.lineTo(x, sea + Math.sin(x / 50 + R) * 2); ctx.stroke();
        label(ctx, 'תהום אוקיינית', bx - 10, 292, { size: 18 }); label(ctx, 'ליתוספרה אוקיינית', 210, 300, { size: 18 });
        if (t > 0.3) label(ctx, 'התכה ← מגמה', 830, 470, { size: 18, bg: 'rgba(120,40,10,.8)' });
        arrow(ctx, 260, 205, 0, 100);
        if (quake) { const p = slabPt(140 + (R * 37 % 140)); glow(ctx, p[0], p[1], 40, 1, '255,255,255'); label(ctx, 'רעידת אדמה', p[0], p[1] - 40, { size: 16, bg: 'rgba(160,20,20,.85)' }); }
      } else {
        // יבשתית ויבשתית — התנגשות ורכס מקומט
        const close = ease(t), gap = 140 * (1 - close);
        const up = close * 230;
        const ridge = x => Math.exp(-(((x - 600) / (150 + close * 60)) ** 2));
        const topY = x => 210 - up * ridge(x) * (0.75 + 0.25 * Math.sin(x / 23) * Math.sin(x / 61)) ;
        const lE = 600 - gap / 2, rE = 600 + gap / 2;
        // שכבות מקומטות (רצועות)
        const layers = 6;
        for (let i = 0; i < layers; i++) {
          const yA = i / layers, yB = (i + 1) / layers;
          const base = 330 + close * 70 * 1;
          const yAt = (x, f) => { const top = topY(x), bot = base + close * 60 * ridge(x); return lerp(top, bot, f) + Math.sin(x / 30) * 14 * close * ridge(x) * Math.sin(f * Math.PI); };
          const path = c => { c.moveTo(0, yAt(0, yA)); for (let x = 0; x <= W; x += 6) { if (x > lE && x < rE) continue; c.lineTo(x, yAt(x, yA)); } for (let x = W; x >= 0; x -= 6) { if (x > lE && x < rE) continue; c.lineTo(x, yAt(x, yB)); } c.closePath(); };
          texFill(ctx, tex.cliff, path, { tint: i % 2 ? '#7d5b3c' : '#b49270', tintAlpha: 0.4, scale: 0.4, ox: i * 90 });
        }
        if (gap > 4) { ctx.fillStyle = waterGrad(ctx, 200, 300); ctx.fillRect(lE, 214, rE - lE, 80); }
        // שלג ופני שטח
        texFill(ctx, tex.ground, c => { for (const [a, b] of [[0, lE], [rE, W]]) { c.moveTo(a, topY(a)); for (let x = a; x <= b; x += 5) c.lineTo(x, topY(x)); for (let x = b; x >= a; x -= 5) c.lineTo(x, topY(x) + 12); c.closePath(); } }, { tint: '#6d8a42', tintAlpha: 0.3, scale: 0.3 });
        if (close > 0.45) { ctx.save(); ctx.fillStyle = 'rgba(245,248,252,.92)'; ctx.beginPath(); for (let x = 420; x <= 780; x += 4) { const y = topY(x); if (210 - y > 150) { ctx.moveTo(x, y); ctx.lineTo(x + 4, topY(x + 4)); ctx.lineTo(x + 4, topY(x + 4) + (210 - y - 150) * 0.35); ctx.lineTo(x, y + (210 - y - 150) * 0.35); } } ctx.fill(); ctx.restore(); }
        arrow(ctx, 200, 260, 0, 110); arrow(ctx, 1000, 260, Math.PI, 110);
        label(ctx, 'ליתוספרה יבשתית', 190, 380, { size: 18 }); label(ctx, 'ליתוספרה יבשתית', 1010, 380, { size: 18 });
        if (close > 0.5) label(ctx, 'רכס הרים גבוה — ללא שרשרת הרי געש', 600, 40, { size: 19 });
        if (quake && close > 0.2) { const x = 560 + (R * 53 % 90); glow(ctx, x, 300, 40, 1, '255,255,255'); label(ctx, 'רעידת אדמה', x, 262, { size: 16, bg: 'rgba(160,20,20,.85)' }); }
      }
      label(ctx, 'מעטפת', 110, 575, { size: 18 });
      vignette(ctx);
    }
  });
}

// ---------- הדמיה 3: החלקה (מבט מלמעלה) ----------
function transform(host) {
  const fx = 600, roadY = 300, fenceY = 410, wdt = 190, threshold = 64, cycle = 1 / 3;
  return frame(host, {
    title: 'הדמיה 3: תנועת החלקה', duration: 18,
    timeLabel: t => `${Math.round(t * 600)} שנה`,
    caption: (t, st) => {
      if (t < 0.02) return 'מבט מלמעלה על שבר. הפעילו: מה יקרה לסלעים, לדרך ולגדר?';
      const ph = (t % cycle) / cycle;
      return ph > 0.9 ? 'המאמץ גבר על החיכוך: תזוזה פתאומית — רעידת אדמה.' : 'החיכוך מעכב את התנועה לאורך השבר. הסלעים מתעוותים בהדרגה, והמאמץ מצטבר.';
    },
    render(ctx, st) {
      const t = st.t, tex = st.tex;
      const D = t * 3 * threshold; // תנועת לוחות כוללת
      const n = Math.floor(t / cycle + 1e-6), ph = (t % cycle) / cycle;
      const slipDone = n * threshold + (ph > 0.9 ? threshold * ease(clamp((ph - 0.9) / 0.04, 0, 1)) : 0);
      const S = Math.min(D, t >= 1 ? 3 * threshold : slipDone);
      const strain = (D - S) / threshold;
      const shakeK = ph > 0.9 && ph < 0.99 ? (1 - (ph - 0.9) / 0.09) : 0;
      const sx = shakeK ? (Math.random() - 0.5) * 14 * shakeK : 0, sy = shakeK ? (Math.random() - 0.5) * 14 * shakeK : 0;
      ctx.translate(sx, sy);
      // u(x): שמאל זז למעלה (שלילי), ימין למטה
      const u = x => { const d = x - fx, s = Math.sign(d) || 1; return s * (S / 2 + (D - S) / 2 * (1 - Math.exp(-Math.abs(d) / wdt))); };
      // קרקע במרקם — עמודות מוזזות
      const img = tex.ground, step = 6;
      if (img) {
        const sc = img.width / 900;
        for (let x = -10; x < W + 10; x += step) {
          const off = u(x + step / 2);
          const srcX = ((x + 2000) * sc) % (img.width - step * sc);
          for (let k = -1; k <= 1; k++) {
            const y0 = -((off % (H)) + H) % H + k * H; // גלילה מחזורית
            ctx.drawImage(img, srcX, 0, step * sc, img.height, x, y0 + (k === 0 ? 0 : 0), step + 0.7, H);
          }
        }
        ctx.fillStyle = 'rgba(170,120,70,.18)'; ctx.fillRect(0, 0, W, H);
      }
      // קו השבר
      ctx.strokeStyle = 'rgba(30,18,10,.85)'; ctx.lineWidth = 4; ctx.beginPath();
      for (let y = 0; y <= H; y += 10) ctx.lineTo(fx + Math.sin(y / 23) * 3 + Math.sin(y / 7) * 1.4, y); ctx.stroke();
      // דרך
      const path = (y0, side) => { const pts = []; for (let x = side < 0 ? 0 : fx + 1; x <= (side < 0 ? fx - 1 : W); x += 6) pts.push([x, y0 + u(x)]); return pts; };
      for (const side of [-1, 1]) {
        const p = path(roadY, side);
        ctx.lineCap = 'butt'; ctx.strokeStyle = '#3a3b3d'; ctx.lineWidth = 46; ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.stroke();
        ctx.strokeStyle = '#555759'; ctx.lineWidth = 40; ctx.stroke();
        ctx.strokeStyle = 'rgba(240,235,220,.9)'; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.stroke(); ctx.setLineDash([]);
        const f = path(fenceY, side);
        ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 4; ctx.beginPath(); f.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.stroke();
        ctx.fillStyle = '#4b311b'; f.forEach((q, i) => { if (i % 5 === 0) { ctx.fillRect(q[0] - 3, q[1] - 7, 6, 14); } });
      }
      // גלים סייסמיים
      if (shakeK > 0) { for (let i = 0; i < 4; i++) { const r = (1 - shakeK) * 380 + i * 50; ctx.strokeStyle = `rgba(255,255,255,${0.7 * shakeK})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, roadY + 20, r, 0, 7); ctx.stroke(); } glow(ctx, fx, roadY + 20, 60, shakeK, '255,220,180'); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // חצים
      arrow(ctx, 300, 110, -Math.PI / 2, 110); arrow(ctx, 900, 110, Math.PI / 2, 110);
      label(ctx, 'שבר', fx + 50, 40, { size: 20 });
      // מד מאמץ
      const gx = 40, gy = 520, gw = 300;
      ctx.fillStyle = 'rgba(8,24,32,.78)'; roundRect(ctx, gx - 12, gy - 40, gw + 24, 86, 12); ctx.fill();
      ctx.font = '700 18px Assistant, Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.fillText('מאמץ מצטבר בסלעים', gx + gw, gy - 14);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(gx, gy, gw, 18);
      const sg = ctx.createLinearGradient(gx, 0, gx + gw, 0); sg.addColorStop(0, '#f3c969'); sg.addColorStop(1, '#e2462b');
      ctx.fillStyle = sg; ctx.fillRect(gx + gw * (1 - clamp(strain, 0, 1)), gy, gw * clamp(strain, 0, 1), 18);
      ctx.strokeStyle = '#fff'; ctx.strokeRect(gx, gy, gw, 18);
      if (shakeK > 0) label(ctx, 'רעידת אדמה!', W / 2, H - 50, { size: 26, bg: 'rgba(170,20,20,.9)' });
      vignette(ctx);
    }
  });
}

// ---------- הדמיה 4: צונאמי ----------
function tsunami(host) {
  const sea = 250, shoreX = 230; // חוף משמאל
  const depthAt = x => x < shoreX ? -(shoreX - x) * 0.32 : Math.min(300, (x - shoreX) * 0.9 * (1 - Math.exp(-(x - shoreX) / 260)) + 6);
  const floor = (x, lift) => sea + depthAt(x) - (x > 900 && x < 1080 ? lift : 0);
  return frame(host, {
    title: 'הדמיה 4: תהליך הצונאמי', duration: 18,
    timeLabel: t => `${Math.round(t * 60)} דקות`,
    caption: t => t < 0.02 ? 'הפעילו: רעידה חזקה מתחת לקרקעית האוקיינוס. מה קורה לים ולחוף לפני שגל הצונאמי מגיע?'
      : t < 0.12 ? 'רעידה מטלטלת את קרקעית האוקיינוס ומזיזה את המים שמעליה.'
      : t < 0.55 ? 'בים העמוק הגל נמוך ומהיר.'
      : t < 0.72 ? 'לפני שהגל מגיע, המים נסוגים מהחוף.'
      : 'במים רדודים הגל מאט ומתגבה, ומציף את החוף.',
    render(ctx, st) {
      const t = st.t, tex = st.tex, R = st.real;
      const lift = 40 * ease(clamp(t / 0.06, 0, 1));
      sky(ctx, sea + 10, true);
      // מיקום הגל: עמוק=מהיר, רדוד=איטי
      const p = t < 0.08 ? 990 : (() => { let x = 990; const steps = Math.round((t - 0.08) * 900); for (let i = 0; i < steps; i++) x -= Math.sqrt(Math.max(8, depthAt(x))) * 0.057; return x; })();
      const h = Math.max(8, depthAt(Math.max(shoreX + 1, p)));
      const amp = t < 0.08 ? lift * 0.6 : Math.min(150, 16 * Math.pow(300 / h, 0.5));
      const trough = t < 0.08 ? 0 : clamp(amp * 0.8, 0, 75);
      const eta = x => {
        if (t < 0.08) return -lift * 0.6 * Math.exp(-(((x - 990) / 90) ** 2));
        const cw = 90 * Math.max(0.35, Math.sqrt(h / 300));
        let e = amp * Math.exp(-(((x - p) / cw) ** 2)) - trough * Math.exp(-(((x - (p - cw * 2.6)) / (cw * 1.9)) ** 2));
        e += amp * 0.25 * Math.exp(-(((x - (2 * 990 - p)) / 90) ** 2)); // גל לכיוון הים הפתוח
        return e;
      };
      const surf = x => sea - eta(x) + Math.sin(x / 40 + R * 2) * 1.5;
      // קרקעית
      const floorPath = c => { c.moveTo(0, H); for (let x = 0; x <= W; x += 6) c.lineTo(x, floor(x, lift)); c.lineTo(W, H); c.closePath(); };
      texFill(ctx, tex.cliff, floorPath, { tint: '#8a6a48', tintAlpha: 0.25, scale: 0.5 });
      // שבר
      ctx.strokeStyle = 'rgba(25,15,8,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(900, floor(905, lift)); ctx.lineTo(930, H); ctx.stroke();
      if (t < 0.12 && t > 0.001) { glow(ctx, 915, 520, 60, 1 - t / 0.12, '255,200,140'); }
      // חוף: חול ובתים
      texFill(ctx, tex.ground, c => { c.moveTo(0, floor(0, 0)); for (let x = 0; x <= shoreX + 120; x += 6) c.lineTo(x, floor(x, 0)); c.lineTo(shoreX + 120, floor(shoreX + 120, 0) + 16); for (let x = shoreX + 120; x >= 0; x -= 6) c.lineTo(x, floor(x, 0) + 16); c.closePath(); }, { tint: '#d9c08f', tintAlpha: 0.45, scale: 0.3 });
      // בתים
      const flood = clamp((t - 0.78) / 0.15, 0, 1);
      for (const [x, w, hh, col] of [[40, 70, 70, '#e8dcc6'], [120, 60, 56, '#f0e2c4'], [180, 46, 44, '#e6d3b8']]) {
        const by = floor(x + w / 2, 0);
        const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, col); g.addColorStop(1, '#b9a68a');
        ctx.fillStyle = g; ctx.fillRect(x, by - hh, w, hh);
        ctx.fillStyle = '#a5472d'; ctx.beginPath(); ctx.moveTo(x - 6, by - hh); ctx.lineTo(x + w / 2, by - hh - 26); ctx.lineTo(x + w + 6, by - hh); ctx.fill();
        ctx.fillStyle = '#3d5568'; for (let k = 0; k < 2; k++) ctx.fillRect(x + 10 + k * (w / 2 - 4), by - hh + 14, 12, 14);
      }
      // מים
      let shore = shoreX; // קו המים בפועל
      for (let x = 0; x < W; x += 2) { if (surf(x) < floor(x, lift) - 0.5) { shore = x; break; } }
      ctx.fillStyle = waterGrad(ctx, sea - 150, sea + 300);
      ctx.beginPath(); ctx.moveTo(shore, surf(shore)); for (let x = shore; x <= W; x += 4) ctx.lineTo(x, Math.min(surf(x), floor(x, lift))); for (let x = W; x >= shore; x -= 6) ctx.lineTo(x, floor(x, lift)); ctx.closePath(); ctx.fill();
      // אור על המים ובועות קצף בשפת הגל
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let x = shore; x <= W; x += 4) ctx.lineTo(x, Math.min(surf(x), floor(x, lift))); ctx.stroke();
      if (amp > 50 && t > 0.08) { for (let i = 0; i < 40; i++) { const x = p - 30 + Math.random() * 40, y = surf(x) + Math.random() * 14; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.arc(x, y, 2 + Math.random() * 4, 0, 7); ctx.fill(); } }
      // הצפה
      if (flood > 0) {
        const fx2 = lerp(shoreX, 0, flood);
        ctx.fillStyle = 'rgba(40,110,140,.82)'; ctx.beginPath(); ctx.moveTo(fx2, floor(fx2, 0)); for (let x = fx2; x <= shoreX + 40; x += 6) ctx.lineTo(x, floor(x, 0) - 40 * flood * (1 - (x - fx2) / 400)); for (let x = shoreX + 40; x >= fx2; x -= 6) ctx.lineTo(x, floor(x, 0)); ctx.fill();
        for (let i = 0; i < 25; i++) { const x = fx2 + Math.random() * 60, y = floor(x, 0) - 30 * flood - Math.random() * 20; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x, y, 3 + Math.random() * 5, 0, 7); ctx.fill(); }
      }
      // חוף שנחשף — חול רטוב
      if (shore > shoreX + 4) { ctx.fillStyle = 'rgba(70,55,35,.35)'; ctx.beginPath(); ctx.moveTo(shoreX, floor(shoreX, 0)); for (let x = shoreX; x <= shore; x += 4) ctx.lineTo(x, floor(x, 0)); ctx.lineTo(shore, floor(shore, 0) + 5); ctx.lineTo(shoreX, floor(shoreX, 0) + 5); ctx.fill(); }
      // תוויות
      if (t > 0.001 && t < 0.15) { label(ctx, 'רעידת אדמה מזיזה את הקרקעית', 990, 160, { size: 19 }); ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; for (const x of [960, 1020]) { ctx.beginPath(); ctx.moveTo(x, floor(x, lift) - 10); ctx.lineTo(x, floor(x, lift) - 70); ctx.stroke(); } ctx.restore(); }
      if (t > 0.12 && t < 0.55) { arrow(ctx, p - 20, sea - amp - 40, Math.PI, 120); label(ctx, 'ים עמוק: גל נמוך ומהיר', p, sea - amp - 90, { size: 19 }); }
      if (shore > shoreX + 25 && t < 0.8) label(ctx, 'המים נסוגים מהחוף', (shoreX + shore) / 2 + 30, sea - 110, { size: 20, bg: 'rgba(170,20,20,.88)' });
      if (t >= 0.7) label(ctx, 'מים רדודים: הגל מאט ומתגבה', Math.max(330, p + 60), Math.max(50, sea - amp - 50), { size: 19 });
      if (flood > 0.3) label(ctx, 'הצפת החוף', 120, 120, { size: 20, bg: 'rgba(170,20,20,.88)' });
      vignette(ctx);
    }
  });
}

const SIMS = { divergent, convergent, transform, tsunami };
export function mountSim(host, id) { return SIMS[id](host); }
export const SIM_NAMES = { divergent: 'הדמיה 1: תנועת פתיחה והתרחקות', convergent: 'הדמיה 2: תנועת הפחתה והתקרבות', transform: 'הדמיה 3: תנועת החלקה', tsunami: 'הדמיה 4: תהליך הצונאמי' };
