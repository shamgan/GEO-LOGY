import { UNIT, CHAPTERS, EXAM, SUMMARY, SKILLS, LETTERS } from './content.js';
import { mountSim, SIM_NAMES } from './sims.js';
import { Tracker, uid } from './tracking.js';
import { TRACKING } from './config.js';

const CONFIG = { key: 'hive-geology-u1-v1', regKey: 'hive-geology-u1-registration', teacherCode: '74646', practiceWeight: 0.3, examWeight: 0.7, release: '1.1.0' };
const tracker = new Tracker(TRACKING);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- בניית רצף המסכים ----------
const screens = [{ kind: 'welcome' }, { kind: 'instructions' }, { kind: 'journey' }];
CHAPTERS.forEach((c, ci) => {
  screens.push({ kind: 'cover', chapter: c, ci });
  c.screens.forEach((s, si) => screens.push({ kind: s.question ? 'question' : s.forum ? 'forum' : 'lesson', chapter: c, ci, s, si }));
});
screens.push({ kind: 'examIntro' });
EXAM.forEach((q, i) => screens.push({ kind: 'exam', q, i }));
screens.push({ kind: 'summary' }, { kind: 'results' });
const PRACTICE = screens.filter(s => s.kind === 'question').map(s => s.s.question);
const FIRST_EXAM = screens.findIndex(s => s.kind === 'examIntro');

// ---------- מצב ושמירה ----------
let session = null, simHandle = null;
const load = () => { try { const s = JSON.parse(localStorage.getItem(CONFIG.key) || 'null'); if (s && !s.id) s.id = uid(); return s; } catch { return null; } };
const save = () => { try { if (session && !session.teacher) localStorage.setItem(CONFIG.key, JSON.stringify(session)); } catch {} };
const newSession = (name, teacher = false) => ({ id: uid(), name, teacher, screen: 1, max: 1, answers: {}, forum: '', board: '', startedAt: new Date().toISOString(), completedAt: null });

// ---------- ניקוד ----------
function practiceScore() {
  let pts = 0, done = 0, first = 0, second = 0;
  PRACTICE.forEach(q => { const a = session.answers[q.id] || []; if (a.some(x => x.correct)) { pts++; a[0].correct ? first++ : second++; } if (a.some(x => x.correct) || a.length >= 2) done++; });
  return { score: pts / PRACTICE.length * 100, done, total: PRACTICE.length, first, second, pts };
}
function examScore() {
  let c = 0, done = 0; EXAM.forEach(q => { const a = session.answers[q.id]; if (a) { done++; if (a[0].correct) c++; } });
  return { score: c / EXAM.length * 100, correct: c, done, total: EXAM.length };
}
function grade() { const p = practiceScore(), e = examScore(); return { p, e, final: Math.round(p.score * CONFIG.practiceWeight + e.score * CONFIG.examWeight) }; }
function skillFeedback() {
  const out = {};
  Object.keys(SKILLS).forEach(k => out[k] = { label: SKILLS[k], pq: 0, pFirst: 0, pOk: 0, eq: 0, eOk: 0, miss: [] });
  PRACTICE.forEach(q => { const o = out[q.skill], a = session.answers[q.id] || []; o.pq++; if (a[0]?.correct) o.pFirst++; if (a.some(x => x.correct)) o.pOk++; else o.miss.push(q); });
  EXAM.forEach(q => { const o = out[q.skill], a = session.answers[q.id]; o.eq++; if (a?.[0]?.correct) o.eOk++; else o.miss.push(q); });
  return Object.values(out).filter(o => o.pq + o.eq).map(o => {
    const ratio = (o.pFirst + o.eOk * 2) / (o.pq + o.eq * 2 || 1);
    o.status = ratio >= 0.85 ? 'שליטה טובה' : ratio >= 0.6 ? 'בדרך הנכונה' : 'לחיזוק';
    o.text = ratio >= 0.85 ? 'בחרת בעקביות במסקנות מבוססות ראיות בתחום זה.' : ratio >= 0.6 ? 'רוב הבחירות שלך נכונות; כדאי לעיין שוב במשוב לשאלות שבהן טעית.' : 'מומלץ לחזור לפרק המתאים, להפעיל שוב את ההדמיות ולעיין בהסברים.';
    return o;
  });
}

// ---------- ניווט ----------
function canEnter(i) { return session.teacher || i <= session.max; }
function screenDone(i) {
  const s = screens[i];
  if (session.teacher) return true;
  if (s.kind === 'question') { const a = session.answers[s.s.question.id] || []; return a.some(x => x.correct) || a.length >= 2; }
  if (s.kind === 'exam') return !!session.answers[s.q.id];
  if (s.kind === 'forum') return session.forum.trim().length >= 15;
  if (s.kind === 'summary') return session.board.trim().length >= 15;
  if (s.kind === 'examIntro') return practiceScore().done === PRACTICE.length;
  return true;
}
function go(i) {
  i = Math.max(1, Math.min(screens.length - 1, i));
  if (!canEnter(i)) return;
  // לאחר תחילת הבוחן אין חזרה לשאלות התרגול
  const from = session.screen;
  session.screen = i; session.max = Math.max(session.max, i); save();
  if (screens[i].kind === 'exam' && screens[from].kind === 'examIntro' && !session.examStartSent) { session.examStartSent = true; save(); track('exam_start'); }
  track('progress', { from: from + 1 });
  render();
}
// ---------- מעקב ----------
function track(kind, detail = {}) { if (session && !session.teacher) tracker.enqueue(session, kind, detail); }
const shareTimers = {};
function trackShare(field) { clearTimeout(shareTimers[field]); shareTimers[field] = setTimeout(() => track('share', { field, text: session[field].slice(0, 3000) }), 1500); }
document.addEventListener('simplay', e => { const h = e.target.closest('[data-sim]'); track('interaction', { sim: h ? h.dataset.sim : '' }); });
function next() { if (!screenDone(session.screen)) return; session.max = Math.max(session.max, session.screen + 1); go(session.screen + 1); }
function prev() {
  const s = screens[session.screen];
  if (!session.teacher && (s.kind === 'exam' || s.kind === 'summary' || s.kind === 'results') && session.screen - 1 >= FIRST_EXAM) return; // הבוחן — ניסיון אחד, בלי חזרה
  go(session.screen - 1);
}

// ---------- רכיבי תצוגה ----------
function blocksHTML(blocks) {
  return blocks.map(b => {
    switch (b.t) {
      case 'p': return `<p class="${b.strong ? 'lead' : ''}">${esc(b.x)}</p>`;
      case 'h': return `<h3>${esc(b.x)}</h3>`;
      case 'list': return `<ul class="bullets">${b.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      case 'card': return `<aside class="card ${b.scenario ? 'scenario' : ''}"><h4>${esc(b.h)}</h4><p>${esc(b.x)}</p></aside>`;
      case 'img': return `<figure class="photo ${b.tall ? 'tall' : ''}"><button type="button" class="zoomable" data-src="${b.src}" aria-label="הגדלת התמונה: ${esc(b.alt)}"><img src="${b.src}" alt="${esc(b.alt)}" loading="lazy"></button></figure>`;
      case 'sim': return `<section class="sim-block"><div class="sim-title"><span class="sim-badge">הדמיה דינמית</span><h3>${esc(SIM_NAMES[b.id])}</h3></div><p class="muted">${esc(b.label)}</p><div class="sim" data-sim="${b.id}"></div></section>`;
      case 'table': return `<div class="table-wrap"><table><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'case': return `<article class="case"><h4>${esc(b.h)}</h4>${b.rows.map(([k, v]) => `<p>${k ? `<strong>${esc(k)}:</strong> ` : ''}${esc(v)}</p>`).join('')}<button type="button" class="ghost small open-sim" data-sim="${b.sim}">פתיחת ${esc(SIM_NAMES[b.sim])}</button></article>`;
      case 'chain': return `<ol class="chain">${b.items.map(([k, v]) => `<li><strong>${esc(k)}</strong><span>${esc(v)}</span></li>`).join('')}</ol>`;
      case 'links': return `<div class="links">${b.items.map(([t, d, u, host]) => `<a class="link-card" href="${u}" target="_blank" rel="noopener"><strong>${esc(t)}</strong><span>${esc(d)}</span><small>${esc(host)} ↗</small></a>`).join('')}</div>`;
    }
    return '';
  }).join('');
}
function optionsHTML(q, answered, chosenIdx, locked, showCorrect) {
  return `<div class="options" role="radiogroup" aria-label="${esc(q.prompt)}">${q.options.map((o, i) => {
    let cls = '';
    if (answered.includes(i)) cls = i === q.correct ? 'right' : 'wrong';
    if (showCorrect && i === q.correct) cls = 'right';
    return `<button type="button" role="radio" aria-checked="${chosenIdx === i}" class="option ${cls}" data-i="${i}" ${locked || answered.includes(i) ? 'disabled' : ''}><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`;
  }).join('')}</div>`;
}

// ---------- מסכים ----------
function render() {
  if (simHandle) { simHandle.forEach(h => h.destroy()); simHandle = null; }
  closeModal();
  const s = screens[session.screen];
  const main = $('#main');
  document.body.dataset.kind = s.kind;
  updateHeader();
  const view = {
    instructions, journey, cover, lesson, question, forum, examIntro, exam, summary, results
  }[s.kind];
  view(s, main);
  // הדמיות
  simHandle = [...main.querySelectorAll('.sim')].map(h => mountSim(h, h.dataset.sim));
  main.querySelectorAll('.zoomable').forEach(b => b.onclick = () => openModal('', `<img class="zoomed" src="${b.dataset.src}" alt="">`, true));
  main.querySelectorAll('.open-sim').forEach(b => b.onclick = () => { openModal(SIM_NAMES[b.dataset.sim], `<div class="sim" data-sim="${b.dataset.sim}"></div>`, true); const h = $('#modal .sim'); simHandle.push(mountSim(h, h.dataset.sim)); });
  renderNav();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function updateHeader() {
  const i = session.screen, total = screens.length;
  $('#progress-bar').style.width = `${Math.round(i / (total - 1) * 100)}%`;
  $('#screen-no').textContent = `מסך ${i + 1} מתוך ${total}`;
  $('#learner').textContent = session.teacher ? 'מצב מורה' : session.name;
  const s = screens[i]; $('#crumb').textContent = s.chapter ? (s.chapter.part ? `${s.chapter.part} · ${s.chapter.short}` : s.chapter.short) : ({ instructions: 'הנחיות', journey: 'מפת המסע', examIntro: 'בוחן סיכום', exam: 'בוחן סיכום', summary: 'איפה זה פוגש אותי כמורה?', results: 'אישור ביצוע' })[s.kind] || '';
}
function renderNav() {
  const i = session.screen, s = screens[i], done = screenDone(i);
  const nav = $('#nav');
  if (s.kind === 'results') { nav.innerHTML = ''; return; }
  const noBack = !session.teacher && (i <= 1 || ((s.kind === 'exam' || s.kind === 'summary') && i - 1 >= FIRST_EXAM));
  const hint = done ? '' : ({ question: 'בחרו תשובה כדי להמשיך', exam: 'בחרו תשובה כדי להמשיך', forum: 'כתבו את השיתוף שלכם כדי להמשיך', summary: 'כתבו את תשובתכם בלוח השיתופי כדי להמשיך', examIntro: 'יש להשלים את כל שאלות התרגול לפני הבוחן' })[s.kind] || '';
  nav.innerHTML = `<button type="button" id="prev" class="ghost" ${noBack ? 'disabled' : ''}>→ הקודם</button><span class="nav-hint" aria-live="polite">${hint}</span><button type="button" id="next" class="primary" ${done ? '' : 'disabled'}>${s.kind === 'summary' ? 'להפקת אישור הביצוע' : s.kind === 'examIntro' ? 'התחלת הבוחן' : 'הבא'} ←</button>`;
  $('#prev').onclick = prev; $('#next').onclick = next;
}

function instructions(s, main) {
  main.innerHTML = `<section class="panel">
    <div class="eyebrow">לפני שמתחילים</div><h1>הנחיות ומטרות היחידה</h1>
    <p class="lead">${esc(UNIT.abstract)}</p>
    <h2>מטרות היחידה</h2>
    <div class="goal-grid">${UNIT.goals.map(([h, x], i) => `<article class="goal"><span class="num">${i + 1}</span><h3>${esc(h)}</h3><p>${esc(x)}</p></article>`).join('')}</div>
    <h2>מיומנויות</h2>
    <div class="skill-grid">${UNIT.skills.map(([h, x]) => `<article><h3>${esc(h)}</h3><p>${esc(x)}</p></article>`).join('')}</div>
    <h2>איך זה עובד</h2>
    <ul class="rules">
      <li><strong>שאלות תרגול</strong> משולבות לאורך היחידה, ובכל אחת שני ניסיונות. הצלחה בניסיון השני מזכה בניקוד מלא. משקל התרגול בציון: <strong>30%</strong>.</li>
      <li><strong>בוחן סיכום</strong> בן ${EXAM.length} שאלות בסוף היחידה — ניסיון אחד בכל שאלה, ללא חזרה לשאלות קודמות. משקל הבוחן בציון: <strong>70%</strong>.</li>
      <li><strong>ארבע הדמיות דינמיות</strong>: הפעילו כל הדמיה לפני שתבחרו תשובה. אפשר לעצור, לגרור את ציר הזמן ולהתחיל מחדש.</li>
      <li><strong>פורום ולוח שיתופי</strong>: כתבו את תשובתכם במקום המיועד. היא תיכלל באישור הביצוע.</li>
      <li>בסיום תופק <strong>אישור ביצוע</strong> עם שמכם, הציון והמשוב האישי — לצילום מסך, להדפסה או לשמירה כ־PDF.</li>
      <li>ההתקדמות נשמרת בדפדפן זה. אפשר לחזור לכל מסך שכבר עברתם דרך <strong>מפת המסע</strong>.</li>
      <li>משך הלמידה המשוער: ${esc(UNIT.duration)}. מומלץ ללמוד במחשב.</li>
    </ul></section>`;
}
function journey(s, main) {
  const items = CHAPTERS.map((c, ci) => {
    const idx = screens.findIndex(x => x.kind === 'cover' && x.ci === ci);
    const last = screens.findLastIndex(x => x.ci === ci);
    const state = session.max > last ? 'done' : session.max >= idx ? 'open' : 'locked';
    return `<button type="button" class="stop ${state}" data-go="${idx}" ${canEnter(idx) ? '' : 'disabled'}><img src="${c.hero}" alt=""><span class="stop-no">${String(ci + 1).padStart(2, '0')}</span><span class="stop-txt"><small>${esc(c.part || '')}</small><strong>${esc(c.short)}</strong></span><span class="stop-state">${state === 'done' ? '✓ הושלם' : state === 'open' ? 'פתוח' : '🔒'}</span></button>`;
  });
  const examIdx = FIRST_EXAM, resIdx = screens.length - 1;
  main.innerHTML = `<section class="panel"><div class="eyebrow">מפת המסע</div><h1>המסלול שלכם ביחידה</h1>
  <p class="muted">${session.teacher ? 'מצב מורה: אפשר לעבור לכל מסך. שום נתון אינו נשמר.' : 'אפשר לחזור לכל תחנה שכבר נפתחה. התחנות הבאות נפתחות בהדרגה.'}</p>
  <div class="journey">${items.join('')}
   <button type="button" class="stop ${session.max >= examIdx ? 'open' : 'locked'} exam-stop" data-go="${examIdx}" ${canEnter(examIdx) ? '' : 'disabled'}><span class="stop-no">✎</span><span class="stop-txt"><small>70% מהציון</small><strong>בוחן סיכום</strong></span></button>
   <button type="button" class="stop ${session.max >= resIdx ? 'open' : 'locked'} exam-stop" data-go="${resIdx}" ${canEnter(resIdx) ? '' : 'disabled'}><span class="stop-no">★</span><span class="stop-txt"><small>סיום</small><strong>אישור ביצוע</strong></span></button>
  </div>
  ${session.teacher ? `<label class="teacher-jump">מעבר ישיר למסך <select id="jump">${screens.slice(1).map((x, i) => `<option value="${i + 1}" ${session.screen === i + 1 ? 'selected' : ''}>${i + 2} · ${esc(screenTitle(x))}</option>`).join('')}</select></label>` : ''}
  </section>`;
  main.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(+b.dataset.go));
  if ($('#jump')) $('#jump').onchange = e => go(+e.target.value);
}
function screenTitle(x) { return x.s?.title || (x.kind === 'cover' ? x.chapter.title : x.kind === 'exam' ? `בוחן — שאלה ${x.i + 1}` : ({ instructions: 'הנחיות', journey: 'מפת המסע', examIntro: 'כניסה לבוחן', summary: 'איפה זה פוגש אותי כמורה?', results: 'אישור ביצוע' })[x.kind]); }
function cover(s, main) {
  const c = s.chapter;
  main.innerHTML = `<section class="cover" style="--hero:url('${c.hero}')"><div class="cover-inner"><div class="eyebrow">${esc(c.part || 'פרק')} · תחנה ${s.ci + 1} מתוך ${CHAPTERS.length}</div><h1>${esc(c.title)}</h1><ul class="cover-list">${[...new Set(c.screens.map(x => x.title.replace(/ — בוחרים$/, '')))].map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`;
}
function lesson(s, main) {
  main.innerHTML = `<section class="panel lesson"><div class="eyebrow">${esc(s.chapter.title)}</div><h1>${esc(s.s.title)}</h1>${blocksHTML(s.s.blocks)}</section>`;
}
function scenarioCard() { const sc = CHAPTERS.find(c => c.id === 'inquiry').screens[0].blocks.find(b => b.scenario); return `<aside class="card scenario compact"><h4>${esc(sc.h)}</h4><p>${esc(sc.x)}</p></aside>`; }
function question(s, main) {
  const q = s.s.question, a = session.answers[q.id] || [];
  const solved = a.some(x => x.correct), out = !solved && a.length >= 2, locked = solved || out;
  const last = a[a.length - 1];
  main.innerHTML = `<section class="panel question"><div class="eyebrow">שאלת תרגול · ${esc(s.chapter.short)} · ניסיון ${Math.min(a.length + (locked ? 0 : 1), 2)} מתוך 2</div><h1>${esc(s.s.title)}</h1>
    ${s.s.scenario ? scenarioCard() : ''}
    ${s.s.sim ? `<details class="sim-again"><summary>הפעלה חוזרת של ${esc(SIM_NAMES[s.s.sim])}</summary><div class="sim" data-sim="${s.s.sim}"></div></details>` : ''}
    ${q.image ? `<figure class="photo small"><img src="${q.image}" alt=""></figure>` : ''}
    <h2 class="prompt">${esc(q.prompt)}</h2>
    ${optionsHTML(q, a.map(x => x.value), last?.value, locked, out)}
    <div class="feedback ${last ? (last.correct ? 'ok' : 'bad') : ''}" aria-live="polite">${last ? `<strong>${LETTERS[last.value]}׳:</strong> ${esc(q.feedback[last.value])}${!locked ? '<br><em>נסו שוב — נותר ניסיון אחד.</em>' : ''}${out ? `<br><strong>התשובה המתאימה: ${LETTERS[q.correct]}׳.</strong> ${esc(q.feedback[q.correct])}` : ''}` : ''}</div>
  </section>`;
  // הדמיה בתוך details נטענת רק בפתיחה
  const det = main.querySelector('.sim-again');
  if (det) { const host = det.querySelector('.sim'); host.classList.remove('sim'); host.classList.add('sim-lazy'); det.addEventListener('toggle', () => { if (det.open && !host.dataset.on) { host.dataset.on = 1; simHandle.push(mountSim(host, s.s.sim)); } }); }
  main.querySelectorAll('.option').forEach(b => b.onclick = () => {
    const v = +b.dataset.i; const list = session.answers[q.id] = session.answers[q.id] || [];
    if (list.some(x => x.correct) || list.length >= 2) return;
    list.push({ value: v, correct: v === q.correct, at: new Date().toISOString() }); save();
    track('answer', { phase: 'practice', questionId: q.id, attempt: list.length, value: v }); render();
  });
}
function forum(s, main) {
  main.innerHTML = `<section class="panel"><div class="eyebrow">${esc(s.chapter.title)}</div><h1>${esc(s.s.title)}</h1>${blocksHTML(s.s.blocks)}
   <label class="write"><span>השיתוף שלי בפורום</span><textarea id="forum-text" rows="6" placeholder="כתבו כאן את הקושי שבחרתם, מה ניסיתם או מה הייתם רוצים לנסות...">${esc(session.forum)}</textarea><small>הטקסט נשמר אוטומטית וייכלל באישור הביצוע.</small></label></section>`;
  $('#forum-text').oninput = e => { session.forum = e.target.value; save(); trackShare('forum'); renderNav(); };
}
function examIntro(s, main) {
  const p = practiceScore();
  main.innerHTML = `<section class="panel center"><div class="eyebrow">בוחן סיכום</div><h1>לפני הבוחן</h1>
   <p class="lead">השלמתם ${p.done} מתוך ${p.total} שאלות התרגול. ציון התרגול שלכם: <strong>${p.score.toFixed(0)}</strong>.</p>
   <ul class="rules"><li>בבוחן ${EXAM.length} שאלות סגורות המבוססות על מקרים חדשים.</li><li>ניסיון אחד בכל שאלה. לאחר הבחירה התשובה ננעלת ועוברים לשאלה הבאה.</li><li>אין חזרה לשאלות קודמות. ההסברים לכל השאלות יוצגו בסוף, באישור הביצוע.</li><li>משקל הבוחן: 70% מהציון הסופי.</li></ul></section>`;
}
function exam(s, main) {
  const q = s.q, a = session.answers[q.id];
  main.innerHTML = `<section class="panel question"><div class="eyebrow">בוחן סיכום · שאלה ${s.i + 1} מתוך ${EXAM.length}</div><h1>שאלה ${s.i + 1}</h1>
   ${q.image ? `<figure class="photo small"><img src="${q.image}" alt="מפת הלוחות"></figure>` : ''}
   <h2 class="prompt">${esc(q.prompt)}</h2>
   <div class="options exam-options">${q.options.map((o, i) => `<button type="button" class="option ${a && a[0].value === i ? 'chosen' : ''}" data-i="${i}" ${a ? 'disabled' : ''}><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
   <div class="feedback neutral" aria-live="polite">${a ? 'התשובה נשמרה. אפשר להמשיך לשאלה הבאה.' : ''}</div></section>`;
  main.querySelectorAll('.option').forEach(b => b.onclick = () => {
    if (session.answers[q.id]) return;
    const v = +b.dataset.i;
    if (!session.teacher && !confirm(`לנעול את תשובה ${LETTERS[v]}׳? בבוחן יש ניסיון אחד.`)) return;
    session.answers[q.id] = [{ value: v, correct: v === q.correct, at: new Date().toISOString() }]; save();
    track('answer', { phase: 'exam', questionId: q.id, attempt: 1, value: v }); render();
  });
}
function summary(s, main) {
  main.innerHTML = `<section class="panel"><div class="eyebrow">סיכום היחידה</div><h1>איפה זה פוגש אותי כמורה?</h1><p class="lead">${esc(SUMMARY.text)}</p>
   <aside class="card board"><h4>לוח שיתופי</h4><p>${esc(SUMMARY.board)}</p></aside>
   <label class="write"><span>התשובה שלי בלוח השיתופי</span><textarea id="board-text" rows="6" placeholder="הפעילות שבחרתי, מה אשנה בה, ובאיזה קושי היא תעזור לתלמידים...">${esc(session.board)}</textarea><small>הטקסט נשמר אוטומטית וייכלל באישור הביצוע.</small></label></section>`;
  $('#board-text').oninput = e => { session.board = e.target.value; save(); trackShare('board'); renderNav(); };
}
function results(s, main) {
  const g = grade();
  const complete = g.e.done === EXAM.length && g.p.done === PRACTICE.length;
  if (!complete && !session.teacher) { main.innerHTML = `<section class="panel center"><h1>היחידה עדיין לא הושלמה</h1><p>יש להשלים את כל שאלות התרגול והבוחן כדי להפיק אישור ביצוע.</p><button class="primary" id="to-map">למפת המסע</button></section>`; $('#to-map').onclick = () => go(2); return; }
  if (!session.completedAt) { session.completedAt = new Date().toISOString(); save(); }
  if (!session.completeSent && !session.teacher) { ['forum', 'board'].forEach(f => { if (shareTimers[f]) { clearTimeout(shareTimers[f]); shareTimers[f] = null; track('share', { field: f, text: session[f].slice(0, 3000) }); } }); session.completeSent = true; save(); track('complete', { grade: g.final }); }
  const fb = skillFeedback();
  const date = new Date(session.completedAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const mins = Math.max(1, Math.round((Date.parse(session.completedAt) - Date.parse(session.startedAt)) / 60000));
  const overall = g.final >= 90 ? 'הישג מצוין! הפגנת הבנה עמוקה של התהליכים ושל דרכי הוראתם.' : g.final >= 75 ? 'הישג טוב. כדאי לעיין בהסברים לשאלות שבהן טעית.' : g.final >= 55 ? 'השלמת את היחידה. מומלץ לחזור לפרקים שסומנו לחיזוק ולהפעיל שוב את ההדמיות.' : 'השלמת את היחידה, אך מומלץ לחזור עליה — במיוחד על הפרקים שסומנו לחיזוק.';
  main.innerHTML = `<section class="certificate" id="certificate">
    <div class="cert-border">
     <div class="cert-head"><span class="seal">✓</span><div><div class="eyebrow">הכוורת · יחידה 1</div><h1>אישור ביצוע</h1></div></div>
     <p class="cert-line">מאשרים כי</p>
     <p class="student">${esc(session.teacher ? 'מצב מורה — לדוגמה' : session.name)}</p>
     <p class="cert-line">השלים/ה את יחידת הלימוד</p>
     <p class="unit-name">״${esc(UNIT.title)}״ <span>(${esc(UNIT.subtitle)})</span></p>
     <div class="score-row">
      <div class="grade"><strong>${g.final}</strong><span>ציון סופי</span></div>
      <div class="tile"><strong>${g.p.score.toFixed(0)}</strong><span>תרגול · 30%</span></div>
      <div class="tile"><strong>${g.e.score.toFixed(0)}</strong><span>בוחן · 70%</span><small>${g.e.correct} מתוך ${g.e.total}</small></div>
     </div>
     <p class="cert-meta">תאריך השלמה: ${date} · משך היחידה: ${esc(UNIT.duration)} · זמן בפועל: כ־${mins} דקות</p>
     <p class="cert-note">יש לבצע צילום מסך של אישור זה (או לשמור אותו כ־PDF) ולהעלות אותו למשימה המתאימה להוכחת ביצוע היחידה.</p>
     <p class="credit">היחידה פותחה ע"י: ${esc(UNIT.developer)}<br>נבנה על ידי נדב שמגר בעזרת בינה מלאכותית · גרסה ${CONFIG.release}</p>
    </div>
   </section>
   <div class="result-actions no-print"><button class="primary" id="print">הדפסה / שמירה כ־PDF</button><button id="dl">הורדת סיכום אישי</button><button id="rev">עיון בתשובות ובהסברים</button><button class="ghost" id="map">מפת המסע</button></div>
   <section class="panel"><div class="eyebrow">משוב אישי</div><h2>הדרך שעברת</h2><p class="lead">${overall}</p>
    <div class="feedback-grid">${fb.map(o => `<article class="skill ${o.status === 'לחיזוק' ? 'weak' : ''}"><span class="badge">${o.status}</span><h3>${esc(o.label)}</h3><p>${o.text}</p><small>${o.pq ? `תרגול: ${o.pFirst} מתוך ${o.pq} בניסיון ראשון. ` : ''}${o.eq ? `בוחן: ${o.eOk} מתוך ${o.eq}.` : ''}</small></article>`).join('')}</div>
    ${session.forum || session.board ? `<div class="shares">${session.forum ? `<article><h4>השיתוף שלי בפורום</h4><p>${esc(session.forum)}</p></article>` : ''}${session.board ? `<article><h4>התשובה שלי בלוח השיתופי</h4><p>${esc(session.board)}</p></article>` : ''}</div>` : ''}
   </section>
   <section class="panel review" id="review" hidden><h2>לומדים מהתשובות</h2>
    ${[...PRACTICE.map(q => ['תרגול', q]), ...EXAM.map((q, i) => [`בוחן ${i + 1}`, q])].map(([tag, q]) => { const a = session.answers[q.id] || []; const ok = tag === 'תרגול' ? a.some(x => x.correct) : a[0]?.correct; return `<details class="review-item ${ok ? 'ok' : 'bad'}"><summary><span>${ok ? '✓' : '✗'}</span> ${tag} · ${esc(q.prompt)}</summary><p>התשובה שלך: ${a.length ? a.map(x => LETTERS[x.value] + '׳').join(' ← ') : '—'}</p><p><strong>התשובה הנכונה: ${LETTERS[q.correct]}׳.</strong> ${esc(q.options[q.correct])}</p><p>${esc(q.feedback ? q.feedback[q.correct] : q.explanation)}</p></details>`; }).join('')}
   </section>`;
  $('#print').onclick = () => window.print();
  $('#rev').onclick = () => { const r = $('#review'); r.hidden = !r.hidden; if (!r.hidden) r.scrollIntoView({ behavior: 'smooth' }); };
  $('#map').onclick = () => go(2);
  $('#dl').onclick = () => {
    const txt = `אישור ביצוע — ${UNIT.title} (${UNIT.subtitle})\nשם: ${session.name}\nתאריך: ${date}\nציון סופי: ${g.final}\nתרגול (30%): ${g.p.score.toFixed(0)}\nבוחן (70%): ${g.e.score.toFixed(0)} (${g.e.correct}/${g.e.total})\n\nמשוב:\n${fb.map(o => `${o.label} — ${o.status}: ${o.text}`).join('\n')}\n\nהשיתוף שלי בפורום:\n${session.forum}\n\nהתשובה שלי בלוח השיתופי:\n${session.board}\n`;
    const b = new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b);
    const l = document.createElement('a'); l.href = u; l.download = `אישור-ביצוע-${session.name}.txt`; l.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
}

// ---------- מסך פתיחה ----------
function welcome() {
  if (simHandle) { simHandle.forEach(h => h.destroy()); simHandle = null; }
  document.body.dataset.kind = 'welcome';
  const saved = load();
  $('#app').hidden = true; $('#welcome').hidden = false;
  $('#welcome').innerHTML = `<div class="welcome-bg"></div>
   <div class="welcome-card">
    <div class="globe" aria-hidden="true"><div class="globe-map"></div></div>
    <div class="eyebrow">הכוורת · גיאוגרפיה · יחידה 1</div>
    <h1>${esc(UNIT.title)}</h1>
    <p class="subtitle">${esc(UNIT.subtitle)}</p>
    <dl class="facts"><div><dt>משך</dt><dd>${esc(UNIT.duration)}</dd></div><div><dt>מתאים למורים</dt><dd>${esc(UNIT.audience)}</dd></div><div><dt>תנאי קדם</dt><dd>${esc(UNIT.prereq)}</dd></div></dl>
    <form id="enter-form" novalidate>
     <label for="name">שם מלא</label>
     <input id="name" autocomplete="name" maxlength="80" placeholder="הקלידו את שמכם המלא" value="${saved && !saved.teacher ? esc(saved.name) : ''}" required>
     <button class="primary big" id="enter" type="submit" disabled>${saved && !saved.completedAt && saved.screen > 1 ? 'המשך מהמקום שבו עצרתי ←' : 'כניסה ללומדה ←'}</button>
     ${saved ? `<button type="button" class="ghost small" id="restart">התחלה חדשה (מחיקת ההתקדמות השמורה)</button>` : ''}
    </form>
    <p class="credit">היחידה פותחה ע"י: ${esc(UNIT.developer)}<br>נבנה על ידי נדב שמגר בעזרת בינה מלאכותית</p>
   </div>`;
  const inp = $('#name'), btn = $('#enter');
  const valid = () => { const v = inp.value.trim(); return v === CONFIG.teacherCode || (v.length >= 2 && /\p{L}/u.test(v)); };
  const upd = () => { btn.disabled = !valid(); if (inp.value.trim() === CONFIG.teacherCode) btn.textContent = 'כניסה במצב מורה ←'; };
  // רישום השם כבר בזמן ההקלדה (כמו בלומדות הקודמות), לפני הלחיצה על כניסה
  let regTimer = null;
  const register = () => {
    const v = inp.value.trim().replace(/\s+/g, ' ');
    if (!valid() || v === CONFIG.teacherCode || (saved && !saved.teacher && saved.name === v)) return null;
    let reg = null; try { reg = JSON.parse(localStorage.getItem(CONFIG.regKey) || 'null'); } catch {}
    if (!reg) { reg = newSession(v); tracker.enqueue(reg, 'registration'); }
    else if (reg.name !== v) { reg.name = v; tracker.enqueue(reg, 'name_update'); }
    try { localStorage.setItem(CONFIG.regKey, JSON.stringify(reg)); } catch {}
    return reg;
  };
  inp.oninput = () => { upd(); clearTimeout(regTimer); regTimer = setTimeout(register, 450); }; upd();
  $('#enter-form').onsubmit = e => {
    e.preventDefault(); if (!valid()) return;
    const v = inp.value.trim().replace(/\s+/g, ' ');
    if (v === CONFIG.teacherCode) { session = newSession('מורה', true); session.screen = 2; session.max = screens.length - 1; }
    else if (saved && !saved.teacher && saved.name === v) { session = saved; }
    else if (saved && !saved.teacher && saved.max > 2 && !confirm(`נמצאה התקדמות שמורה על שם "${saved.name}". להתחיל מחדש בשם "${v}"? ההתקדמות הקודמת תימחק.`)) return;
    else { clearTimeout(regTimer); session = register() || newSession(v); session.name = v; session.screen = 1; session.max = 1; }
    try { localStorage.removeItem(CONFIG.regKey); } catch {}
    if (!session.teacher && !session.startSent) { session.startSent = true; tracker.enqueue({ ...session, screen: 0 }, 'start'); }
    save(); $('#welcome').hidden = true; $('#app').hidden = false; render();
  };
  if ($('#restart')) $('#restart').onclick = () => { if (confirm('למחוק את ההתקדמות השמורה ולהתחיל מחדש?')) { try { localStorage.removeItem(CONFIG.key); } catch {} welcome(); } };
  inp.focus();
}

// ---------- חלון קופץ ----------
function openModal(title, html, wide) {
  const m = $('#modal'); m.innerHTML = `<div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title || 'תצוגה מוגדלת')}"><button class="close" aria-label="סגירה">✕</button>${title ? `<h2>${esc(title)}</h2>` : ''}${html}</div>`;
  m.hidden = false; m.querySelector('.close').onclick = closeModal; m.onclick = e => { if (e.target === m) closeModal(); };
  m.querySelector('.close').focus();
}
function closeModal() { const m = $('#modal'); if (m && !m.hidden) { m.hidden = true; m.innerHTML = ''; } }

// ---------- אירועים כלליים ----------
document.addEventListener('keydown', e => {
  if (!$('#modal').hidden && e.key === 'Escape') return closeModal();
  if ($('#app').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowLeft') next(); if (e.key === 'ArrowRight') prev();
});
$('#btn-map').onclick = () => go(2);
$('#btn-home').onclick = () => { save(); welcome(); };
welcome();
