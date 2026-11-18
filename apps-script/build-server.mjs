// יוצר את apps-script/Code.gs מתוך content.js ו-config.js, כך שמפתח התשובות בשרת זהה ללומדה.
// הפעלה: node apps-script/build-server.mjs <SPREADSHEET_ID>
import fs from 'node:fs';
import { CHAPTERS, EXAM, SKILLS } from '../content.js';
import { TRACKING } from '../config.js';

const sheetId = process.argv[2] || (fs.existsSync(new URL('./sheet-id.txt', import.meta.url)) ? fs.readFileSync(new URL('./sheet-id.txt', import.meta.url), 'utf8').trim() : '');
if (!/^[A-Za-z0-9_-]{20,}$/.test(sheetId)) { console.error('Missing spreadsheet id'); process.exit(1); }
const key = {};
let p = 0;
CHAPTERS.forEach(c => c.screens.forEach(s => { if (s.question) { const q = s.question; key[q.id] = { phase: 'practice', correct: q.correct, options: q.options.length, skill: SKILLS[q.skill], label: `תרגול ${++p} · ${s.title.replace(/ — בוחרים$/, '')}` }; } }));
EXAM.forEach((q, i) => key[q.id] = { phase: 'exam', correct: q.correct, options: q.options.length, skill: SKILLS[q.skill], label: `בוחן ${i + 1}` });
const tpl = fs.readFileSync(new URL('./server-template.js', import.meta.url), 'utf8');
const out = `// נוצר אוטומטית על ידי build-server.mjs — אין לערוך ידנית.\nconst SPREADSHEET_ID = '${sheetId}';\nconst CONTENT_VERSION = '${TRACKING.version}';\nconst ANSWER_KEY = ${JSON.stringify(key)};\n\n${tpl}`;
fs.writeFileSync(new URL('./Code.gs', import.meta.url), out);
console.log(`Code.gs written: ${Object.keys(key).length} questions, sheet ${sheetId}`);
