// 학부모 링크 화면: reports/{key} 한 건만 읽고, 열람·확인·상담 요청만 기록
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, updateDoc, increment, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, OWNER_EMAIL } from '../firebase-config.js';
import { renderMobile, PHONE_MAIN, PHONE_SUB } from '../report-view.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const root = document.getElementById('root');
const key = new URLSearchParams(location.search).get('k') || '';
const ref = key && /^[A-Za-z0-9]{16,40}$/.test(key) ? doc(db, 'reports', key) : null;
let rep = null, st = { confirmed: false, consult: null, staff: false, busy: false };

function message(title, body) {
  root.innerHTML = `<div class="rp-m"><div class="rp-msg"><b class="rp-logo">수학도서관</b><b style="font-size:18px">${title}</b><span style="color:#5E6B68;line-height:1.7">${body}</span>
    <a class="rp-call" href="tel:${PHONE_MAIN.replace(/\./g, '')}">상담 문의 ${PHONE_MAIN}</a><span style="color:#5E6B68;font-size:13px">${PHONE_SUB}</span></div></div>`;
}
const draw = () => { root.innerHTML = renderMobile(rep.data, st); };

// 로그인한 원장·선생님인지 (그러면 열람 기록을 남기지 않음)
const whoIsIt = () => new Promise(res => {
  const off = onAuthStateChanged(auth, async u => {
    off();
    if (!u || !u.email) return res(false);
    const email = u.email.toLowerCase();
    if (email === OWNER_EMAIL.toLowerCase()) return res(true);
    try { res((await getDoc(doc(db, 'staff', email))).exists()); } catch (e) { res(false); }
  });
});

async function start() {
  if (!ref) return message('주소가 올바르지 않습니다', '받으신 링크 전체가 그대로 열렸는지 확인해 주세요.');
  const staff = await whoIsIt();
  let snap;
  try { snap = await getDoc(ref); } catch (e) { snap = null; }
  if (!snap || !snap.exists()) return message('열 수 없는 리포트입니다', '링크 기간(받으신 날부터 한 달)이 지났거나 새 링크로 바뀌었습니다.<br>수학도서관으로 문의해 주세요.');
  rep = snap.data();
  st = { confirmed: !!rep.confirmedAt, consult: rep.consult || null, staff, busy: false };
  document.title = `${rep.data.name} 학생 얼리어답터 결과 리포트 · 수학도서관`;
  draw();
  if (!staff) {
    const patch = { views: increment(1), lastViewAt: serverTimestamp() };
    if (!rep.firstViewAt) patch.firstViewAt = serverTimestamp();
    updateDoc(ref, patch).catch(() => {});
  }
}

root.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b || st.staff || st.busy) return;
  const act = b.dataset.act;
  const patch = act === 'confirm' ? { confirmedAt: serverTimestamp() }
    : act === 'consult' ? { consult: 'requested', consultAt: serverTimestamp(), ...(st.confirmed ? {} : { confirmedAt: serverTimestamp() }) }
    : act === 'noConsult' ? { consult: 'declined', consultAt: serverTimestamp() } : null;
  if (!patch) return;
  st.busy = true; draw();
  try {
    await updateDoc(ref, patch);
    if (act === 'confirm') st.confirmed = true;
    if (act === 'consult') { st.confirmed = true; st.consult = 'requested'; }
    if (act === 'noConsult') st.consult = 'declined';
  } catch (err) {
    alertBox();
  }
  st.busy = false; draw();
});
function alertBox() {
  const el = document.createElement('div');
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;left:16px;right:16px;bottom:20px;background:#B23A3A;color:#fff;padding:12px 14px;border-radius:10px;font-size:14px;text-align:center';
  el.textContent = '전송하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.';
  document.body.appendChild(el); setTimeout(() => el.remove(), 4000);
}
start();
