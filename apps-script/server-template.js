// שרת המעקב של "המנוע שמתחת לרגלינו". build-server.mjs מוסיף מעלה את ANSWER_KEY, SPREADSHEET_ID ו-CONTENT_VERSION.
const EVENT_HEADERS = ['מזהה אירוע', 'מזהה התנסות', 'שם מלא', 'גרסת תוכן', 'זמן', 'סוג אירוע', 'מסך', 'שלב', 'שאלה', 'ניסיון', 'תשובה', 'נכונות', 'נושא', 'פירוט', 'נתוני אירוע'];
const SUMMARY_HEADERS = ['מזהה התנסות', 'שם מלא', 'תחילת התנסות', 'עדכון אחרון', 'סטטוס', 'מסך אחרון', 'שאלות תרגול', 'שאלות בוחן', 'ציון תרגול (30%)', 'ציון בוחן (70%)', 'ציון סופי', 'הדמיות שהופעלו', 'פורום', 'לוח שיתופי', 'פירוט תשובות'];
const KINDS = ['registration', 'name_update', 'start', 'progress', 'interaction', 'answer', 'share', 'exam_start', 'complete'];
const LETTERS = ['א', 'ב', 'ג', 'ד'];

function doGet() { return json({ ok: true, service: 'hive-geology-unit1 tracking', version: CONTENT_VERSION }); }
function json(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
function safe(v) { const s = String(v == null ? '' : v); return /^[=+@\-\t\r]/.test(s) ? "'" + s : s; }
function sheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); sh.setRightToLeft(true); sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#123c48').setFontColor('#ffffff'); }
  return sh;
}
function validate(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) throw Error('Invalid event');
  ['eventId', 'sessionId'].forEach(k => { if (typeof e[k] !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(e[k])) throw Error('Invalid identifier'); });
  if (e.version !== CONTENT_VERSION) throw Error('Unknown content version');
  if (typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80) throw Error('Invalid name');
  if (KINDS.indexOf(e.kind) < 0) throw Error('Unknown event kind');
  if (!Number.isFinite(Date.parse(e.at))) throw Error('Invalid date');
  if (e.kind === 'answer') {
    const q = ANSWER_KEY[e.questionId];
    if (!q || q.phase !== e.phase || !Number.isInteger(e.value) || e.value < 0 || e.value >= q.options || !Number.isInteger(e.attempt) || e.attempt < 1 || e.attempt > (q.phase === 'exam' ? 1 : 2)) throw Error('Invalid answer');
  }
  if (e.kind === 'share' && (['forum', 'board'].indexOf(e.field) < 0 || typeof e.text !== 'string' || e.text.length > 3000)) throw Error('Invalid share');
  if (JSON.stringify(e).length > 4000) throw Error('Event too large');
  return e;
}
// ציון מחושב בשרת מתוך מפתח התשובות: תרגול — הצלחה באחד משני הניסיונות; בוחן — התשובה הראשונה בלבד.
function summarize(events) {
  const s = { name: '', startedAt: '', lastAt: '', screen: '', answers: {}, sims: {}, forum: '', board: '', started: false, examStarted: false, complete: false };
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).forEach(e => {
    s.name = e.name; s.startedAt = s.startedAt || e.startedAt; s.lastAt = e.at; if (e.screen) s.screen = e.screen;
    if (e.kind === 'start') s.started = true;
    if (e.kind === 'exam_start') s.examStarted = true;
    if (e.kind === 'complete') s.complete = true;
    if (e.kind === 'interaction' && e.sim) s.sims[e.sim] = true;
    if (e.kind === 'share') s[e.field] = e.text;
    if (e.kind === 'answer') { const list = s.answers[e.questionId] || (s.answers[e.questionId] = []); if (list.length < e.attempt) list.push(e.value); }
  });
  const ids = Object.keys(ANSWER_KEY), prac = ids.filter(id => ANSWER_KEY[id].phase === 'practice'), exam = ids.filter(id => ANSWER_KEY[id].phase === 'exam');
  let pOk = 0, pDone = 0, eOk = 0, eDone = 0; const detail = [];
  prac.forEach(id => { const a = s.answers[id] || [], q = ANSWER_KEY[id], ok = a.slice(0, 2).indexOf(q.correct) >= 0; if (ok) pOk++; if (ok || a.length >= 2) pDone++; if (a.length) detail.push(`${q.label}: ${a.map(v => LETTERS[v]).join('→')} ${ok ? '✓' : '✗'}`); });
  exam.forEach(id => { const a = s.answers[id] || [], q = ANSWER_KEY[id]; if (a.length) { eDone++; if (a[0] === q.correct) eOk++; detail.push(`${q.label}: ${LETTERS[a[0]]} ${a[0] === q.correct ? '✓' : '✗'}`); } });
  const pScore = pOk / prac.length * 100, eScore = eOk / exam.length * 100;
  const done = pDone === prac.length && eDone === exam.length;
  return {
    s, row: [safe(s.name), s.startedAt, s.lastAt,
      s.complete && done ? 'הושלם' : s.examStarted ? 'בבוחן' : s.started ? 'בלמידה' : 'הקלדת שם',
      s.screen, `${pDone}/${prac.length}`, `${eDone}/${exam.length}`,
      pDone === prac.length ? Math.round(pScore) : '', eDone === exam.length ? Math.round(eScore) : '',
      done ? Math.round(pScore * 0.3 + eScore * 0.7) : '',
      `${Object.keys(s.sims).length}/4`, safe(s.forum), safe(s.board), detail.join('\n')]
  };
}
function doPost(req) {
  const lock = LockService.getScriptLock();
  try {
    const raw = req && req.postData && req.postData.contents;
    if (!raw || raw.length > 60000) throw Error('Invalid request size');
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.events) || payload.events.length < 1 || payload.events.length > 12) throw Error('Invalid batch');
    payload.events.forEach(validate);
    lock.waitLock(25000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const log = sheet(ss, 'מענים ואירועים', EVENT_HEADERS), sum = sheet(ss, 'סיכום תלמידים', SUMMARY_HEADERS);
    const n = log.getLastRow() - 1, rows = n > 0 ? log.getRange(2, 1, n, EVENT_HEADERS.length).getValues() : [];
    const seen = {}, bySession = {}, wanted = {};
    payload.events.forEach(e => wanted[e.sessionId] = true);
    rows.forEach(r => { seen[String(r[0])] = true; if (wanted[String(r[1])]) (bySession[r[1]] = bySession[r[1]] || []).push(JSON.parse(String(r[EVENT_HEADERS.length - 1]))); });
    const add = [], ack = [];
    payload.events.forEach(e => {
      ack.push(e.eventId); if (seen[e.eventId]) return; seen[e.eventId] = true;
      const q = e.kind === 'answer' ? ANSWER_KEY[e.questionId] : null;
      add.push([e.eventId, e.sessionId, safe(e.name), e.version, e.at, e.kind, e.screen || '', e.phase || '', q ? q.label : '', e.attempt || '',
        q ? LETTERS[e.value] : '', q ? (e.value === q.correct ? 'נכון' : 'שגוי') : '', q ? q.skill : '',
        safe(e.kind === 'share' ? `${e.field === 'forum' ? 'פורום' : 'לוח שיתופי'}: ${e.text}` : e.kind === 'interaction' ? e.sim : e.kind === 'complete' ? `ציון בדפדפן: ${e.grade}` : ''),
        JSON.stringify(e)]);
      (bySession[e.sessionId] = bySession[e.sessionId] || []).push(e);
    });
    if (add.length) log.getRange(log.getLastRow() + 1, 1, add.length, EVENT_HEADERS.length).setValues(add);
    Object.keys(bySession).forEach(id => {
      const row = [id].concat(summarize(bySession[id]).row);
      const last = sum.getLastRow();
      const found = last > 1 ? sum.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() : null;
      sum.getRange(found ? found.getRow() : last + 1, 1, 1, row.length).setValues([row]);
    });
    SpreadsheetApp.flush();
    return json({ ok: true, acknowledged: ack });
  } catch (err) {
    return json({ ok: false, error: String(err.message || err).slice(0, 180), acknowledged: [] });
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}
