// 수학도서관 예비고1 얼리어답터 관리 앱
// - PC·아이패드: 상단 탭 (전체 현황 · 학생 · 점수 입력 · 학교 정보 · 설정)
// - 핸드폰(폭 767px 이하): 하단 탭 (홈 · 점수 입력 · 학생 · 더보기)
// - 자료: Firebase Firestore (students, settings/refs, staff) — 로그인한 원장·등록 선생님만 접근
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, updateDoc, setDoc, deleteDoc, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, OWNER_EMAIL } from './firebase-config.js';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
let db;
try { db = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { db = initializeFirestore(fbApp, {}); }

// ===== 학교 기준 자료 (설명회 자료·학교알리미 공시) =====
// [0유형, 1성별, 2 1학년, 3 1등급자리, 4 공통수학학점, 5 수행%, 6 2024평균, 7 2024표준편차, 8 원서, 9 시험 스타일, 10 비고, 11 [2023평균, 2023표준편차], 12 중간고사 비중%, 13 그중 서·논술형%]
const SCH = {
 '강서고':['정시형','남',285,28,'4·4',40,68.5,11.0,'일반','평가원·교육청 킬러 변형, 시간이 부족한 시험. 지필 전부 객관식','',[69.5,14.4],30,0],
 '양정고':['정시형','남',384,38,'4·4',40,73.9,12.8,'자사고','사고력형 자체 출제 + 평가원 심화 변형. 평균 높고 점수 촘촘','원서 별도',[74.3,12.6],30,1.8],
 '대일고':['정시형','남',304,30,'3·3',40,62.7,18.9,'일반','긴 연산·까다로운 조건의 수능형. 어려울 때는 매우 어려움(경우의 수·계산)','3학점·진도 빠름',[63.5,13.3],30,9],
 '영일고':['정시형','남',185,18,'3·3',40,62.6,21.6,'일반','점수 분산이 가장 큰 시험. 중간고사 서술형 없음','3학점·진도 빠름',[62.5,17.9],30,0],
 '마포고':['정시형','남',216,22,'-',50,73.6,16.0,'일반','과학중점학급','과학중점',[75.1,16.1],25,5],
 '목동고':['균형형','여',309,31,'-',40,69.3,12.0,'일반','모의고사 프린트 기반 준킬러 위주, 1~2점 차로 등급. 서술형 채점 엄격','기하 미개설',[68.9,13.1],30,0],
 '신목고':['균형형','공학',320,32,'3·3',40,67.0,19.4,'일반','학교 프린트 변형 비중 매우 높음. 16번 이후 고난도, 시간 빠듯','3학점·진도 빠름',[65.3,19.4],30,6],
 '진명여고':['균형형','여',406,41,'4·4',40,68.2,14.0,'일반','문항 수·계산량으로 시간 압박. 독자 출제 포인트가 독특','확통 선택과목',[71.2,12.9],30,0],
 '한가람고':['균형형','공학',163,16,'4·4',60,75.5,15.2,'일반','수능 개념 중시 자체 출제, 점차 난도 상승. 1~2문항 실수가 치명적','',[68.4,19.3],20,6],
 '양천고':['균형형','남',257,26,'4·4',50,73.6,10.5,'일반','평가원 4점 준킬러 변형, 연산 긴 문항. 점수가 몰림','',[74.4,10.8],25,0],
 '백암고':['수시·내신형','공학',294,29,'3·3',40,66.2,14.4,'일반','교과서·학습지 변형 + 후반 킬러 2~3문항. 무실수 싸움','3학점·진도 빠름',[55.7,14.2],30,9],
 '금옥여고':['수시·내신형','여',240,24,'4·4',40,63.4,19.1,'일반','소규모 공립 여고, 수시 전략형','',[55.7,20.0],30,0],
 '경복여고':['수시·내신형','여',199,20,'-',40,73.8,14.0,'일반','평균 높은 시험, 실수에 민감','',[74.1,11.9],30,6],
 '선유고':['수시·내신형','공학',185,18,'-',null,69.8,19.2,'일반','기본~중상 난이도의 실수 싸움','영등포권·학교군 확인',[68.8,18.0],null,null],
 '관악고':['수시·내신형','공학',175,17,'-',null,70.6,15.3,'일반','기본~중상 난이도의 실수 싸움','영등포권·학교군 확인',[72.4,12.9],null,null],
 '명덕외고':['특목','공학',255,26,'3·3',70,89.1,6.4,'외고','기본 평이, 고난도 변형 2~3문항에서 승부. 서술형 완성도','원서 별도',[87.8,7.3],15,1.5],
 '명덕여고':['미분류','여',264,26,'-',40,73.8,14.7,'일반','설명회 유형 분류 없음 (공시값만 있음)','',[69.3,13.8],30,3.6],
 '여의도여고':['미분류','여',null,null,'-',null,70.5,15.4,'일반','설명회 유형 분류 없음 (공시값만 있음)','',[72.2,13.7],null,null],
 '경인고':['미분류','',null,null,'-',null,74.3,14.4,'일반','설명회 유형 분류 없음 (공시값만 있음)','',[67.5,16.3],null,null],
 '이화여고':['미분류','여',336,34,'-',null,null,null,'자사고','광역자사고 (2026 모집 336명)','원서 별도',null,null,null],
};
const ESTIMATED = new Set(['선유고','관악고','이화여고']);
const T = s => SCH[s] || ['자료없음','',null,null,'-',null,null,null,'일반','자료에 없는 학교','기준값 입력 필요',null,null,null];
const STAGE = ['미입력','조교 채점','담당T 확인'];
const CONSULT = ['1차 조교 채점','2차 담당T 확인','3차 상담','학부모 발송'];

// ===== 상태 =====
const S = {
  user: null, role: null, myName: '', students: [], refInput: {}, refMode: '2yr', staff: [], loaded: false,
  tab: 'overview', mtab: 'home', curId: null, mDetail: false, teacher: '전체', search: '', mFilter: 'all', tfilter: '전체',
  entry: { sid: null, r: 1, sch: '', newSch: '', y: '', score: '', stage: '1', date: '' },
  editInfo: false, armed: null, memoDraft: {}, sheet: null, staffForm: { email: '', name: '' }, importPending: null,
  online: navigator.onLine, installEvt: null
};
let unsubs = [];
const $app = document.getElementById('app');
const mq = window.matchMedia('(max-width: 767px)');
const isPhone = () => mq.matches;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const shortDate = iso => iso ? `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}` : '';
const stu = id => S.students.find(s => s.id === id);
const recs = s => (s?.records || []).slice().sort((a, b) => a.r - b.r);
const schoolsOf = s => [...new Set(recs(s).map(x => x.sch).filter(Boolean))];
const phase = r => r <= 3 ? '1차' : '2차';
const papers = (s, sch) => recs(s).filter(x => x.sch === sch && x.score != null);
const isOwner = () => S.role === 'owner';

// ===== 판단 =====
function styleOf(s) { const A = s.A, B = s.B; if (A == null || B == null) return null; return A - B >= 2 ? '정시형' : B - A >= 2 ? '수시·내신형' : '균형형'; }
function fit(st, type) {
  if (!st || ['특목', '자료없음', '미분류'].includes(type)) return null;
  if (st === type) return 2;
  if (st === '균형형' || type === '균형형') return 1;
  return 0;
}
function refFor(sch) {
  const ri = S.refInput[sch];
  if (ri && ri.m != null && ri.m !== '') return { m: +ri.m, sd: +(ri.sd || 15), src: '직접 입력' };
  const t = T(sch);
  if (t[6] != null) {
    if (S.refMode === '2yr' && t[11]) return { m: +((t[6] + t[11][0]) / 2).toFixed(1), sd: +((t[7] + t[11][1]) / 2).toFixed(1), src: '공시 2개년' };
    return { m: t[6], sd: t[7], src: '공시 2024' };
  }
  const xs = S.students.flatMap(s => papers(s, sch).map(x => x.score));
  if (xs.length >= 3) {
    const m = xs.reduce((a, b) => a + b) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
    return { m: +m.toFixed(1), sd: +Math.max(sd, 8).toFixed(1), src: '학원' };
  }
  return null;
}
function phi(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
const grade5 = top => top <= 10 ? 1 : top <= 34 ? 2 : top <= 66 ? 3 : top <= 90 ? 4 : 5;
function warnsFor(s, sch) {
  const t = T(sch), w = [];
  if (t[12] != null && t[12] <= 20) w.push(`중간고사가 학기 성적의 ${t[12]}%뿐`);
  else if (t[5] >= 50) w.push(`수행 ${t[5]}% · 지필만으로 판단 한계`);
  if (t[11] && t[6] != null && Math.abs(t[6] - t[11][0]) >= 5) w.push(`공시 평균 변동 큼 ${t[11][0]}→${t[6]}`);
  if (t[0] === '특목' && t[6] >= 85) w.push('외고 평균이 매우 높음 · 위치가 낮게 나옴');
  if (t[8] !== '일반') w.push(`${t[8]} · 원서 별도`);
  if (t[10] && t[10].includes('학교군')) w.push('영등포권 · 학교군 확인');
  if (!refFor(sch)) w.push('기준값 없음 · 학교 정보에서 입력');
  if (s.sex && t[1] && t[1] !== '공학' && t[1] !== s.sex) w.push(`${t[1]}고 · 지원 불가`);
  return w;
}
function analyze(s) {
  const hopes = s.hopes || []; const st = styleOf(s);
  const rows = schoolsOf(s).map(sch => {
    const t = T(sch), ps = papers(s, sch);
    const avg = ps.length ? ps.reduce((x, y) => x + y.score, 0) / ps.length : null;
    const ref = refFor(sch); let top = null, g = null;
    if (avg != null && ref) { top = Math.round((1 - phi((avg - ref.m) / ref.sd)) * 100); g = grade5(top); }
    const swing = ps.length >= 2 ? Math.max(...ps.map(x => x.score)) - Math.min(...ps.map(x => x.score)) : 0;
    const blocked = !!(s.sex && t[1] && t[1] !== '공학' && t[1] !== s.sex);
    return { sch, t, rank: hopes.indexOf(sch) + 1, ps, avg, ref, top, g, n: ps.length, swing, fit: fit(st, t[0]), blocked, v: null };
  });
  const scored = rows.filter(r => r.top != null && !r.blocked).sort((x, y) => x.top - y.top);
  let verdict = { status: 'none' };
  if (scored.length >= 2) {
    const bestTop = scored[0].top;
    const close = scored.filter(r => r.top - bestTop <= 5);
    close.sort((x, y) => ((y.fit ?? 1) - (x.fit ?? 1)) || ((y.t[3] || 0) - (x.t[3] || 0)) || ((x.rank || 9) - (y.rank || 9)) || (x.top - y.top));
    const best = close[0];
    scored.forEach(r => { r.v = r === best ? 'good' : (r.top - bestTop <= 5 ? 'warn' : 'bad'); });
    const general = scored.filter(r => r.t[8] === '일반').sort((x, y) => x.top - y.top);
    verdict = { status: scored.every(r => r.n >= 2) ? 'done' : 'partial', best, st, general };
  }
  rows.filter(r => r.blocked).forEach(r => r.v = 'blocked');
  return { rows, scored, verdict };
}
const yearTxt = x => x.y ? `${x.y}년` : '<span class="flag">연도?</span>';
const typeTag = t => `<span class="type ${t}">${t}</span>`;
const fitTxt = f => f == null ? '<span class="empty">–</span>' : f === 2 ? '<span class="pill p-good">맞음</span>' : f === 1 ? '<span class="pill p-none">보통</span>' : '<span class="pill p-bad">안 맞음</span>';
const midTxt = t => t[12] != null ? `${t[12]}% <span class="src">(${t[13]}%)</span>` : '–';
const verdictPill = s => { const v = analyze(s).verdict; return v.status === 'none' ? '<span class="pill p-none">데이터 부족</span>' : `<span class="pill p-good">${esc(v.best.sch)}${v.status === 'partial' ? ' · 잠정' : ''}</span>`; };
const vpTxt = v => v === 'good' ? '<span class="pill p-good">유리</span>' : v === 'warn' ? '<span class="pill p-warn">비슷</span>' : v === 'bad' ? '<span class="pill p-bad">불리</span>' : v === 'blocked' ? '<span class="pill p-none">지원 불가</span>' : '<span class="pill p-none">–</span>';

function reasonsFor(s, an) {
  const v = an.verdict, b = v.best, top0 = an.scored[0];
  const reasons = [`예상 위치 상위 ${b.top}% · 참고 ${b.g}등급 (시험지 ${b.n}장 평균 ${b.avg.toFixed(1)}점, 기준 ${b.ref.m} / ${b.ref.sd})`];
  if (b !== top0) reasons.push(`${esc(top0.sch)}(상위 ${top0.top}%)와 5%p 안쪽이라 ${b.fit != null && b.fit > (top0.fit ?? 1) ? '공부 성향' : (b.t[3] || 0) > (top0.t[3] || 0) ? '1등급 자리' : '지망 순서'}로 결정`);
  if (v.st && b.fit != null) reasons.push(`공부 성향 ${v.st} ↔ 학교 ${b.t[0]} : ${b.fit === 2 ? '맞음' : b.fit === 1 ? '보통' : '안 맞음'}`);
  if (b.t[3]) reasons.push(`1등급 자리 약 ${b.t[3]}명 (1학년 ${b.t[2]}명 × 10%)`);
  an.scored.filter(r => r !== b).forEach(o => reasons.push(`${esc(o.sch)}: 상위 ${o.top}% · ${o.top - b.top <= 5 ? '비슷' : '불리'}`));
  an.rows.filter(r => r.blocked).forEach(r => reasons.push(`${esc(r.sch)}: ${r.t[1]}고라 판단에서 제외`));
  warnsFor(s, b.sch).forEach(w => reasons.push('주의 · ' + esc(w)));
  an.rows.filter(r => r.swing >= 15).forEach(r => reasons.push(`${esc(r.sch)} 시험지 간 점수 차 ${r.swing.toFixed(1)}점 · 변동 큼`));
  reasons.push(b.rank ? `희망 ${b.rank}지망 학교` : '희망학교 목록에 없는 학교 · 상담 때 확인');
  if (v.status === 'partial') reasons.push('시험지가 1장뿐인 학교가 있음 · 2차(4~6회) 후 다시 판단');
  return reasons;
}

// ===== 저장 =====
let toastTimer;
function toast(msg, err) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, err ? 4500 : 2000);
}
function failMsg(e) {
  if (e && e.code === 'permission-denied') return '권한이 없어 저장하지 못했습니다';
  return '저장하지 못했습니다. 인터넷 연결을 확인해 주세요';
}
function saveStudent(id, patch, okMsg = '저장됨') {
  updateDoc(doc(db, 'students', id), patch).catch(e => toast(failMsg(e), true));
  if (okMsg) toast(S.online ? okMsg : okMsg + ' · 인터넷이 연결되면 올라갑니다');
}

// ===== 로그인 =====
async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
      try { await signInWithRedirect(auth, provider); } catch (e2) { toast('로그인하지 못했습니다: ' + (e2.code || ''), true); }
    } else if (e.code !== 'auth/popup-closed-by-user') toast('로그인하지 못했습니다: ' + (e.code || ''), true);
  }
}
getRedirectResult(auth).catch(() => {});

function stopListeners() { unsubs.forEach(u => u()); unsubs = []; }
function startListeners() {
  stopListeners();
  unsubs.push(onSnapshot(collection(db, 'students'), snap => {
    S.students = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.no ?? 999) - (b.no ?? 999) || String(a.name).localeCompare(String(b.name), 'ko'));
    S.loaded = true; render();
  }, e => { S.loaded = true; toast('학생 명단을 불러오지 못했습니다 (' + (e.code || '') + ')', true); render(); }));
  unsubs.push(onSnapshot(doc(db, 'settings', 'refs'), snap => {
    const d = snap.exists() ? snap.data() : {};
    S.refInput = d.refs || {}; S.refMode = d.mode || '2yr'; render();
  }, () => {}));
  if (isOwner()) unsubs.push(onSnapshot(collection(db, 'staff'), snap => {
    S.staff = snap.docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko')); render();
  }, () => {}));
}
onAuthStateChanged(auth, async u => {
  S.user = u; S.role = null; S.loaded = false; stopListeners();
  if (!u) { render(); return; }
  render();
  const email = (u.email || '').toLowerCase();
  if (email === OWNER_EMAIL.toLowerCase()) { S.role = 'owner'; S.myName = '원장'; S.mFilter = 'all'; }
  else {
    try {
      const snap = await getDoc(doc(db, 'staff', email));
      if (snap.exists()) { S.role = 'teacher'; S.myName = snap.data().name || ''; S.mFilter = S.myName ? 'mine' : 'all'; }
      else S.role = 'denied';
    } catch (e) { S.role = e.code === 'permission-denied' ? 'denied' : 'error'; }
  }
  if (S.role === 'owner' || S.role === 'teacher') startListeners();
  render();
});
window.addEventListener('online', () => { S.online = true; render(); });
window.addEventListener('offline', () => { S.online = false; render(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; render(); });
mq.addEventListener('change', () => render());

// ===== 그리기 =====
function render() {
  const a = document.activeElement;
  const key = a && a.closest && a.closest('#app') ? (a.id || a.dataset.bind || null) : null;
  const sel = key && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  $app.innerHTML = view();
  if (key) {
    const el = document.getElementById(key) || $app.querySelector(`[data-bind="${CSS.escape(key)}"]`);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} }
  }
}
function view() {
  if (!S.user) return loginView();
  if (!S.role) return `<div class="splash"><b>수학도서관</b><span>계정 확인 중…</span></div>`;
  if (S.role === 'denied') return deniedView();
  if (S.role === 'error') return `<div class="login"><div class="login-card"><b class="brand">수학도서관</b><p>계정을 확인하지 못했습니다. 인터넷 연결을 확인해 주세요.</p><button class="btn" data-act="reload">다시 시도</button><button class="btn ghost" data-act="logout">로그아웃</button></div></div>`;
  return isPhone() ? phoneView() : bigView();
}
function loginView() {
  return `<div class="login"><div class="login-card">
    <b class="brand">수학도서관</b>
    <div style="font-size:18px;font-weight:600">예비고1 얼리어답터 관리</div>
    <p>원장님과 등록된 선생님만 들어올 수 있습니다.</p>
    <button class="gbtn" data-act="login"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>구글 계정으로 로그인</button>
  </div></div>`;
}
function deniedView() {
  return `<div class="login"><div class="login-card">
    <b class="brand">수학도서관</b>
    <p><b>${esc(S.user.email)}</b> 계정은 아직 등록되지 않았습니다.</p>
    <p>원장님께 이 이메일을 '선생님 관리'에 추가해 달라고 요청해 주세요.</p>
    <button class="btn ghost" data-act="logout">다른 계정으로 로그인</button>
  </div></div>`;
}
const syncTxt = () => S.online ? '<span class="sync">● 동기화됨</span>' : '<span class="sync off">● 오프라인 · 연결되면 저장</span>';

// ----- PC·아이패드 -----
function bigView() {
  const tabs = [['overview', '전체 현황'], ['students', '학생'], ['entry', '점수 입력'], ['schools', '학교 정보'], ['settings', '설정']];
  const body = { overview: overviewView, students: studentsView, entry: entryBigView, schools: schoolsView, settings: settingsView }[S.tab]();
  return `<header class="top"><div class="in">
      <div class="brandline"><b>수학도서관</b><span>예비고1 얼리어답터 관리</span></div>
      ${syncTxt()}<span class="who">${esc(S.myName || '')} · ${esc(S.user.email)}</span>
      <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-v="${k}">${l}</button>`).join('')}</nav>
    </div></header>
    <main class="wrap">${body}</main>`;
}
function counts() {
  let filled = 0, judged = 0, noYear = 0, noSex = 0, scheduled = 0;
  S.students.forEach(s => { const rs = recs(s); filled += rs.filter(x => x.score != null).length; noYear += rs.filter(x => x.score != null && !x.y).length; scheduled += rs.filter(x => x.r <= 3 && x.sch).length; if (!s.sex) noSex++; if (analyze(s).verdict.status !== 'none') judged++; });
  return { n: S.students.length, filled, judged, noYear, noSex, scheduled };
}
function emptyStudents() {
  return `<div class="panel box" style="text-align:center;color:var(--muted)">${S.loaded ? (isOwner() ? '학생이 아직 없습니다. 설정 → <b>자료 가져오기</b>로 기존 자료를 불러오거나 학생을 추가해 주세요.' : '학생이 아직 없습니다.') : '학생 명단을 불러오는 중…'}</div>`;
}
function overviewView() {
  const c = counts();
  const ts = ['전체', ...new Set(S.students.map(s => s.teacher).filter(Boolean))];
  if (!ts.includes(S.teacher)) S.teacher = '전체';
  const list = S.students.filter(s => S.teacher === '전체' || s.teacher === S.teacher);
  return `<h2>전체 현황</h2>
  <p class="sub">학생 1명당 응시학교 3곳 × 시험지 2장 = 6회. 1차는 1~3회, 2차는 4~6회입니다. 성별은 표에서 바로 고를 수 있습니다.</p>
  <div class="tiles">
    <div class="tile"><div class="k">참여 학생</div><div class="v">${c.n}<small> 명 · 성별 미입력 ${c.noSex}</small></div></div>
    <div class="tile"><div class="k">1차(1~3회) 응시학교 확정</div><div class="v">${c.scheduled}<small> / ${c.n * 3}</small></div></div>
    <div class="tile"><div class="k">점수 입력</div><div class="v">${c.filled}<small> / ${c.n * 6}장 · 연도 미입력 ${c.noYear}</small></div></div>
    <div class="tile"><div class="k">판단 가능 학생</div><div class="v">${c.judged}<small> 명</small></div></div>
  </div>
  <div class="filters"><span class="empty" style="font-size:13px">담당</span>${ts.map(t => `<button class="chip" aria-pressed="${t === S.teacher}" data-act="teacher" data-v="${esc(t)}">${esc(t)}</button>`).join('')}
    ${isOwner() ? `<span style="margin-left:auto"><button class="btn small" data-act="addStudent">+ 학생 추가</button></span>` : ''}</div>
  ${list.length ? `<div class="panel scroll"><table>
    <thead><tr><th>#</th><th>학생</th><th>성별</th><th>중학교</th><th>담당</th><th>희망학교 (참고)</th><th>응시학교 (판단 기준)</th><th>회차 진행</th><th>입력</th><th>판단</th></tr></thead>
    <tbody>${list.map(s => {
      const sch = schoolsOf(s), rs = recs(s);
      const hopes = (s.hopes || []).filter(Boolean).map(h => `<span class="hope ${sch.includes(h) ? '' : 'miss'}">${esc(h)}</span>`).join('') || '<span class="empty">–</span>';
      const dot = r => { const x = rs.find(q => q.r === r); return `<i class="dot ${x && x.score != null ? 'on' : x && x.sch ? 'sch' : ''}" title="${r}회 ${esc(x?.sch || '미정')}"></i>`; };
      return `<tr class="click" data-act="openStudent" data-id="${s.id}"><td>${s.no ?? ''}</td><td><b>${esc(s.name)}</b></td>
        <td>${sexSelect(s, 'sm')}</td><td>${esc(s.middle || '')}</td><td>${esc(s.teacher || '')}</td><td>${hopes}</td>
        <td>${sch.map(esc).join(' · ') || '<span class="empty">미정</span>'}${sch.length < 3 ? ` <span class="flag">${3 - sch.length}곳 미정</span>` : ''}</td>
        <td><span class="src">1차</span> <span class="dots">${[1, 2, 3].map(dot).join('')}</span> <span class="src">2차</span> <span class="dots">${[4, 5, 6].map(dot).join('')}</span></td>
        <td>${rs.filter(x => x.score != null).length}/6</td><td>${verdictPill(s)}</td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="src" style="margin-top:8px">● 점수 입력됨 · 골드 테두리 = 학교만 잡힘 · 점선 희망학교 = 응시하지 않음</p>` : emptyStudents()}`;
}
function sexSelect(s, size) {
  return `<select data-change="sex" data-id="${s.id}" aria-label="${esc(s.name)} 성별" ${size === 'sm' ? 'style="padding:3px 6px;font-size:13px"' : ''}><option value="">${size === 'sm' ? '–' : '미입력'}</option><option ${s.sex === '남' ? 'selected' : ''}>남</option><option ${s.sex === '여' ? 'selected' : ''}>여</option></select>`;
}
function filteredStudents() {
  const q = S.search.trim();
  return S.students.filter(s => (S.teacher === '전체' || s.teacher === S.teacher) && (!q || [s.name, s.middle, ...(schoolsOf(s))].some(v => String(v || '').includes(q))));
}
function studentsView() {
  if (!S.students.length) return `<h2>학생</h2>${emptyStudents()}`;
  const list = filteredStudents();
  if (!stu(S.curId)) S.curId = (list[0] || S.students[0]).id;
  const ts = ['전체', ...new Set(S.students.map(s => s.teacher).filter(Boolean))];
  return `<h2>학생</h2>
  <div class="split" style="margin-top:12px">
    <aside class="slist">
      <div class="head">
        <label for="q">학생 검색<input id="q" type="search" data-bind="search" data-rerender="1" value="${esc(S.search)}" placeholder="이름·중학교·응시학교"></label>
        <div class="row">${ts.map(t => `<button class="chip" aria-pressed="${t === S.teacher}" data-act="teacher" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      </div>
      <div class="items">${list.map(s => `<button class="sitem" aria-current="${s.id === S.curId}" data-act="pickStudent" data-id="${s.id}">
          <span class="l1"><b>${esc(s.name)}</b>${verdictPill(s)}</span>
          <span class="l2">${esc(s.middle || '')} · ${esc(s.teacher || '')} · 점수 ${recs(s).filter(x => x.score != null).length}/6</span></button>`).join('') || '<p class="empty" style="padding:12px">검색 결과가 없습니다</p>'}</div>
    </aside>
    <section class="detail">${detailBig(stu(S.curId))}</section>
  </div>`;
}
function detailBig(s) {
  const an = analyze(s), sch = schoolsOf(s), st = styleOf(s), hopes = (s.hopes || []).filter(Boolean);
  const notTaken = hopes.filter(h => !sch.includes(h));
  const noYear = recs(s).filter(x => x.score != null && !x.y).length;
  const v = an.verdict;
  const reco = v.status === 'none'
    ? `<div class="reco"><div class="eyebrow">판단 결과</div><div class="school" style="color:var(--muted)">아직 판단 전</div><p style="margin:0">기준값이 있는 응시학교 2곳 이상의 점수가 모이면 자동으로 판단합니다. 지금 판단 가능한 학교 ${an.scored.length}곳.</p></div>`
    : `<div class="reco"><div class="eyebrow">지원 유리 학교</div><div class="school">${esc(v.best.sch)}${v.status === 'partial' ? ' <span style="font-size:15px;color:var(--muted);font-family:var(--body)">(잠정)</span>' : ''}</div>
       <ul>${reasonsFor(s, an).map(r => `<li>${r}</li>`).join('')}</ul>
       ${v.general.length >= 2 ? `<div class="order"><b>일반고 원서 지망 순서 제안</b> · ${v.general.map(r => esc(r.sch)).join(' → ')}<br><span class="src">일반고는 추첨 배정이라 지망 순서를 정하는 데 쓰고, 자사고·외고는 지원 여부를 따로 판단합니다.</span></div>` : ''}
       <p class="src" style="margin:10px 0 0">참고 등급은 입학 전 학생을 재학생 공시 평균과 견준 값이라 실제보다 낮게 나옵니다. 학교끼리 비교하는 용도로 보세요.</p></div>`;
  const paperCell = x => x ? `<b>${x.score}</b> <span class="src">${x.r}회 · ${yearTxt(x)}</span>` : '<span class="empty">–</span>';
  const cuts = [10, 34, 66, 90];
  const cs = s.consult || 0;
  const memo = S.memoDraft[s.id] ?? s.memo ?? '';
  const info = S.editInfo && isOwner() ? `<div class="edit-grid">
      <label for="fName">이름<input id="fName" value="${esc(s.name)}"></label>
      <label for="fMiddle">중학교<input id="fMiddle" value="${esc(s.middle || '')}"></label>
      <label for="fTeacher">담당<input id="fTeacher" value="${esc(s.teacher || '')}"></label>
      <label for="fH1">1지망<input id="fH1" value="${esc((s.hopes || [])[0] || '')}"></label>
      <label for="fH2">2지망<input id="fH2" value="${esc((s.hopes || [])[1] || '')}"></label>
      <label for="fH3">3지망<input id="fH3" value="${esc((s.hopes || [])[2] || '')}"></label></div>
    <div class="row" style="margin-top:10px"><button class="btn small" data-act="saveInfo" data-id="${s.id}">저장</button><button class="btn ghost small" data-act="cancelInfo">취소</button>
      <button class="btn danger small" style="margin-left:auto" data-act="delStudent" data-id="${s.id}">${S.armed === 'del:' + s.id ? '한 번 더 누르면 삭제' : '학생 삭제'}</button></div>`
    : `<dl class="kv">
      <dt>학생</dt><dd><b>${esc(s.name)}</b> · ${esc(s.middle || '')} · ${esc(s.teacher || '')} 선생님</dd>
      <dt>성별</dt><dd>${sexSelect(s)} <span class="src">남고·여고 자동 제외에 사용</span></dd>
      <dt>공부 성향</dt><dd><label class="inline" for="pA">A <input id="pA" class="tiny" type="number" min="0" max="4" value="${s.A ?? ''}" data-change="ab" data-id="${s.id}" data-k="A"></label> <label class="inline" for="pB">B <input id="pB" class="tiny" type="number" min="0" max="4" value="${s.B ?? ''}" data-change="ab" data-id="${s.id}" data-k="B"></label> → ${st ? typeTag(st) : '<span class="empty">자가진단 전</span>'}<div class="src">설명회 '나는 수능형? 내신형?' 8문항 (A 4 · B 4) · 선택 입력</div></dd>
      <dt>희망학교</dt><dd>${hopes.length ? hopes.map((h, i) => `${i + 1}지망 ${esc(h)}`).join(' · ') : '<span class="empty">–</span>'} <span class="src">참고용</span></dd>
      <dt>응시학교</dt><dd>${sch.map(esc).join(' · ') || '미정'}${sch.length < 3 ? ` <span class="flag">· ${3 - sch.length}곳 미정</span>` : ''} <span class="src">판단 기준</span></dd>
      ${notTaken.length || noYear ? `<dt>확인 필요</dt><dd class="flag">${[notTaken.length ? `희망학교 ${notTaken.map(esc).join(', ')}은(는) 응시 안 함` : '', noYear ? `시험지 연도 미입력 ${noYear}장` : ''].filter(Boolean).join(' · ')}</dd>` : ''}</dl>`;
  return `${reco}
  <div class="row"><button class="btn" data-act="goEntry" data-id="${s.id}">+ 점수 입력</button></div>
  <div class="panel scroll"><table>
    <thead><tr><th>응시학교</th><th>지망</th><th>시험지 ①</th><th>시험지 ②</th><th>평균</th><th>판단 기준<br>평균 / 편차</th><th>예상 위치</th><th>참고 등급</th><th>성향</th><th>판단</th></tr></thead>
    <tbody>${an.rows.map(r => `<tr><td><b>${esc(r.sch)}</b></td><td>${r.rank ? r.rank + '지망' : '<span class="empty">–</span>'}</td><td>${paperCell(r.ps[0])}</td><td>${paperCell(r.ps[1])}${r.ps.length > 2 ? `<div class="src">+${r.ps.length - 2}장</div>` : ''}</td><td>${r.avg != null ? r.avg.toFixed(1) : '–'}</td><td>${r.ref ? `${r.ref.m.toFixed(1)} / ${r.ref.sd.toFixed(1)} <span class="src">${r.ref.src}</span>` : '<span class="empty">없음</span>'}</td><td>${r.top != null ? '상위 ' + r.top + '%' : '–'}</td><td>${r.g ? r.g + '등급' : '–'}</td><td>${fitTxt(r.fit)}</td><td>${vpTxt(r.v)}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">응시학교가 아직 없습니다. 점수 입력에서 회차별 학교를 넣어 주세요.</td></tr>'}</tbody></table></div>
  <div class="dgrid">
    <div class="panel box"><h3>학교별 예상 위치 <span class="empty" style="font-weight:400">· 막대가 길수록 유리</span></h3>
      ${an.rows.length ? `<div class="bars">${an.rows.map(r => `<div class="bar"><span>${esc(r.sch)}</span><div class="track">${cuts.map(c => `<i class="cut" style="left:${100 - c}%"></i>`).join('')}<div class="fill" style="width:${r.top != null ? Math.max(2, 100 - r.top) : 0}%"></div></div><span>${r.blocked ? '제외' : r.top != null ? '상위 ' + r.top + '%' : '–'}</span></div>`).join('')}</div>
      <p class="src" style="margin:8px 0 0">흰 세로선 = 5등급제 경계 (상위 10 · 34 · 66 · 90%)</p>` : '<p class="empty" style="margin:0">점수가 들어오면 학교별 위치가 막대로 나옵니다.</p>'}</div>
    <div class="panel box"><div class="row" style="justify-content:space-between"><h3 style="margin:0">학생 정보</h3>${isOwner() && !S.editInfo ? `<button class="btn ghost small" data-act="editInfo">정보 수정</button>` : ''}</div><div style="margin-top:10px">${info}</div></div>
  </div>
  <div class="dgrid">
    <div class="panel box"><h3>상담 메모</h3>
      <textarea id="memo" rows="5" style="width:100%" data-bind="memoDraft.${s.id}" placeholder="담당 선생님 상담 내용을 적습니다">${esc(memo)}</textarea>
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="saveMemo" data-id="${s.id}">메모 저장</button>${S.memoDraft[s.id] != null && S.memoDraft[s.id] !== (s.memo || '') ? '<span class="flag">저장 안 된 수정이 있습니다</span>' : ''}</div>
      <h3 style="margin-top:14px">진행 단계</h3>
      <div class="steps">${CONSULT.map((t, i) => `<button data-act="consult" data-id="${s.id}" data-i="${i + 1}" class="${i < cs ? 'done' : ''}" aria-pressed="${i < cs}">${t}</button>`).join('')}</div></div>
    <div class="panel scroll"><table>
      <thead><tr><th>응시학교</th><th>유형</th><th>1등급 자리</th><th>중간고사<br>(서·논술)</th><th>확인할 점</th></tr></thead>
      <tbody>${an.rows.map(r => `<tr><td><b>${esc(r.sch)}</b><div class="src" style="white-space:normal;max-width:220px">${esc(r.t[9] || '')}</div></td><td>${typeTag(r.t[0])}</td><td>${r.t[3] ? '약 ' + r.t[3] + '명' : '–'}</td><td>${midTxt(r.t)}</td><td class="wrap"><div class="warnlist">${warnsFor(s, r.sch).map(w => `<span class="pill p-warn">${esc(w)}</span>`).join('') || '<span class="empty">–</span>'}</div></td></tr>`).join('') || '<tr><td colspan="5" class="empty">–</td></tr>'}</tbody></table></div>
  </div>`;
}

// ----- 점수 입력 (공용 로직) -----
function setEntry(sid, r) {
  const s = stu(sid); const e = S.entry;
  e.sid = sid; e.r = r || e.r || 1; e.newSch = '';
  if (!s) return;
  const rs = recs(s), ex = rs.find(x => x.r === e.r);
  const def = ex ? ex.sch : rs.find(x => x.r === e.r - 3)?.sch;
  const sc = schoolsOf(s);
  e.sch = def && sc.includes(def) ? def : (def || (sc[0] || '__new'));
  if (!sc.length) e.sch = '__new';
  e.y = ex && ex.y ? String(ex.y) : '';
  e.score = ex && ex.score != null ? String(ex.score) : '';
  e.stage = ex && ex.stage ? String(ex.stage) : '1';
  e.date = ex && ex.isoDate ? ex.isoDate : '';
}
function ensureEntry() { if (!stu(S.entry.sid)) setEntry((S.students[0] || {}).id, 1); }
function saveEntry(next) {
  const e = S.entry, s = stu(e.sid);
  if (!s) return;
  let sch = e.sch === '__new' ? e.newSch.trim() : e.sch;
  if (!sch) { toast('응시학교를 고르거나 새 학교 이름을 적어 주세요', true); return; }
  const v = e.score === '' ? null : parseFloat(e.score);
  if (v != null && (isNaN(v) || v < 0 || v > 100)) { toast('0~100 사이 점수를 입력하세요', true); return; }
  const prev = recs(s).find(x => x.r === e.r);
  const iso = e.date || prev?.isoDate || (v != null ? todayIso() : '');
  const rec = { r: e.r, sch, y: e.y ? +e.y : null, isoDate: iso, date: iso ? shortDate(iso) : (prev?.date || ''), score: v, stage: v == null ? 0 : +e.stage };
  const nextRecs = recs(s).filter(x => x.r !== e.r).concat([rec]).sort((a, b) => a.r - b.r);
  saveStudent(s.id, { records: nextRecs }, `${s.name} · ${e.r}회 ${sch}${v != null ? ' ' + v + '점' : ''} 저장됨`);
  s.records = nextRecs; // 화면 즉시 반영
  if (next) {
    const list = phoneList(); const i = list.findIndex(x => x.id === s.id);
    const nx = list[(i + 1) % list.length];
    setEntry(nx.id, e.r);
  } else setEntry(s.id, e.r);
  render();
}
function delEntry() {
  const e = S.entry, s = stu(e.sid); if (!s) return;
  if (!recs(s).some(x => x.r === e.r)) { toast(`${e.r}회 기록이 없습니다`); return; }
  if (S.armed !== 'rec:' + s.id + ':' + e.r) { S.armed = 'rec:' + s.id + ':' + e.r; render(); return; }
  S.armed = null;
  const nextRecs = recs(s).filter(x => x.r !== e.r);
  saveStudent(s.id, { records: nextRecs }, `${s.name} · ${e.r}회 기록을 지웠습니다`);
  s.records = nextRecs; setEntry(s.id, e.r); render();
}
function entryLog(s, r) {
  const rs = recs(s);
  return [1, 2, 3, 4, 5, 6].map(n => { const x = rs.find(q => q.r === n);
    return `<tr${n === r ? ' style="background:var(--brand-soft)"' : ''} class="click" data-act="entryRound" data-v="${n}"><td>${n}회</td><td>${phase(n)}</td><td>${x?.sch ? esc(x.sch) : '<span class="empty">–</span>'}</td><td>${x ? (x.y ? x.y + '년' : (x.score != null ? '<span class="flag">연도?</span>' : '–')) : '–'}</td><td>${esc(x?.date || '–')}</td><td>${x?.score ?? '<span class="empty">–</span>'}</td><td>${x ? STAGE[x.stage || 0] : '–'}</td></tr>`; }).join('');
}
function entryBigView() {
  if (!S.students.length) return `<h2>점수 입력</h2>${emptyStudents()}`;
  ensureEntry();
  const e = S.entry, s = stu(e.sid), sc = schoolsOf(s);
  const opts = [...sc]; if (e.sch && e.sch !== '__new' && !opts.includes(e.sch)) opts.push(e.sch);
  return `<h2>점수 입력</h2>
  <p class="sub">학생과 회차를 고르면 그 회차에 잡힌 학교가 먼저 선택되고, 2차(4~6회)는 1차와 같은 순서(4회=1회 학교)로 제안합니다. 같은 학교의 시험지 연도가 달라도 괜찮고, 판단은 그 학교 시험지 점수의 평균으로 합니다.</p>
  <div class="panel"><div class="entry" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:16px">
    <label for="eStudent">학생<select id="eStudent" data-change="eStudent">${S.students.map(x => `<option value="${x.id}" ${x.id === e.sid ? 'selected' : ''}>${x.no ?? ''}. ${esc(x.name)}</option>`).join('')}</select></label>
    <label for="eRound">회차<select id="eRound" data-change="eRound">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === e.r ? 'selected' : ''}>${n}회 · ${phase(n)}</option>`).join('')}</select></label>
    <label for="eSchool">응시학교<select id="eSchool" data-change="eSchool">${opts.map(x => `<option ${x === e.sch ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__new" ${e.sch === '__new' ? 'selected' : ''}>+ 응시학교 추가</option></select></label>
    ${e.sch === '__new' ? `<label for="eNew">추가할 학교<input id="eNew" data-bind="entry.newSch" value="${esc(e.newSch)}" placeholder="예: 양천고"></label>` : ''}
    <label for="eYear">시험지 연도<select id="eYear" data-change="eYear"><option value="">모름</option>${['2026', '2025', '2024', '2023', '2022'].map(y => `<option ${y === e.y ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
    <label for="eDate">응시일<input type="date" id="eDate" data-bind="entry.date" value="${esc(e.date)}"></label>
    <label for="eScore">점수 (100점 만점, 비우면 일정만)<input type="number" id="eScore" data-bind="entry.score" min="0" max="100" step="0.1" inputmode="decimal" value="${esc(e.score)}" placeholder="예: 74.2"></label>
    <label for="eStage">채점 단계<select id="eStage" data-change="eStage"><option value="1" ${e.stage === '1' ? 'selected' : ''}>조교 채점 완료</option><option value="2" ${e.stage === '2' ? 'selected' : ''}>담당T 확인 완료</option></select></label>
    <div class="row" style="align-items:end"><button class="btn" data-act="saveEntry">저장</button><button class="btn danger" data-act="delEntry">${S.armed === 'rec:' + s.id + ':' + e.r ? '한 번 더 누르면 지움' : '이 회차 지우기'}</button></div>
  </div></div>
  <h3 style="margin-top:22px">${esc(s.name)} 학생의 기록 <span class="src">· 줄을 누르면 그 회차로 바뀝니다</span></h3>
  <div class="panel scroll"><table><thead><tr><th>회차</th><th>차수</th><th>학교</th><th>시험지 연도</th><th>응시일</th><th>점수</th><th>채점 단계</th></tr></thead><tbody>${entryLog(s, e.r)}</tbody></table></div>`;
}

// ----- 학교 정보 -----
function schoolsView() {
  const types = ['전체', '정시형', '균형형', '수시·내신형', '특목', '미분류', '자료없음'];
  const extra = [...new Set(S.students.flatMap(s => schoolsOf(s)))].filter(x => !SCH[x]);
  const names = [...Object.keys(SCH), ...extra].filter(x => S.tfilter === '전체' || T(x)[0] === S.tfilter);
  const own = isOwner();
  return `<h2>학교 정보</h2>
  <p class="sub">판단에 쓰는 학교 기준값입니다. 학교알리미 고1 수학 1학기 평균·표준편차(2023·2024)를 넣어 두었고, 기본은 두 해 평균입니다. 공시값이 없는 학교는 원장님이 직접 입력하면 그 값을 쓰고, 입력이 없으면 학원 응시 점수가 3개 이상 모였을 때 학원 평균을 씁니다.</p>
  <div class="filters">${types.map(t => `<button class="chip" aria-pressed="${t === S.tfilter}" data-act="tfilter" data-v="${t}">${t}</button>`).join('')}
    <span class="empty" style="font-size:13px;margin-left:12px">기준값</span>${[['2yr', '2023·2024 평균'], ['1yr', '2024만']].map(([k, l]) => `<button class="chip" aria-pressed="${S.refMode === k}" data-act="refMode" data-v="${k}" ${own ? '' : 'disabled'}>${l}</button>`).join('')}</div>
  <div class="panel scroll"><table>
    <thead><tr><th>학교</th><th>유형</th><th>성별</th><th>1학년</th><th>1등급 자리</th><th>공통수학</th><th>수행</th><th>중간고사<br>(서·논술)</th><th>2023<br>평균 / 편차</th><th>2024<br>평균 / 편차</th><th>직접 입력<br>평균 / 편차</th><th>판단 기준값</th><th>학원 응시</th><th>시험 스타일</th></tr></thead>
    <tbody>${names.map(sch => {
      const t = T(sch), n = S.students.filter(s => schoolsOf(s).includes(sch)).length, ref = refFor(sch), iv = S.refInput[sch] || {};
      const inp = own ? `<input class="num" data-change="ref" data-s="${esc(sch)}" data-k="m" type="number" step="0.1" placeholder="평균" value="${iv.m ?? ''}" aria-label="${esc(sch)} 평균"> <input class="num" data-change="ref" data-s="${esc(sch)}" data-k="sd" type="number" step="0.1" placeholder="편차" value="${iv.sd ?? ''}" aria-label="${esc(sch)} 표준편차">` : (iv.m != null ? `${iv.m} / ${iv.sd ?? '–'}` : '<span class="empty">–</span>');
      return `<tr><td><b>${esc(sch)}</b>${t[8] !== '일반' ? ` <span class="src">${t[8]}</span>` : ''}</td><td>${typeTag(t[0])}</td><td>${t[1] || '–'}</td><td>${t[2] ? (ESTIMATED.has(sch) ? '약 ' : '') + t[2] + '명' : '–'}</td><td>${t[3] ? '약 ' + t[3] + '명' : '–'}</td><td>${t[4]}</td><td>${t[5] != null ? t[5] + '%' : '–'}</td><td>${midTxt(t)}</td><td>${t[11] ? `${t[11][0]} / ${t[11][1]}` : '<span class="empty">–</span>'}</td><td>${t[6] != null ? `${t[6]} / ${t[7]}` : '<span class="empty">–</span>'}</td><td>${inp}</td><td>${ref ? `${ref.m} / ${ref.sd} <span class="pill ${ref.src.startsWith('공시') ? 'p-good' : 'p-none'}">${ref.src}</span>` : '<span class="pill p-warn">없음 · 입력 필요</span>'}</td><td>${n}명</td><td class="wrap">${esc(t[9])}</td></tr>`;
    }).join('')}</tbody></table></div>
  <p class="src">출처: 학교알리미 교과별 학업성취 사항(1학년 수학 1학기), 수학도서관 설명회 자료(유형·인원·수행평가·2025 공통수학 평가계획). 선유·관악 인원은 내부 분석 추정치, 이화여고는 2026 모집 인원.</p>`;
}

// ----- 설정 -----
function installBlock() {
  if (isStandalone()) return `<p style="margin:0">이 기기에는 앱으로 설치되어 있습니다.</p>`;
  return `${S.installEvt ? `<button class="btn" data-act="install">이 기기에 앱 설치</button>` : ''}
  <ul style="margin:8px 0 0;padding-left:18px;font-size:13px">
    <li><b>PC (크롬·엣지)</b>: 주소창 오른쪽의 설치 아이콘(⊕ 또는 모니터 모양) → 설치</li>
    <li><b>아이패드·아이폰 (사파리)</b>: 아래쪽 또는 위쪽의 공유 버튼 → <b>홈 화면에 추가</b></li>
    <li><b>안드로이드 (크롬)</b>: 오른쪽 위 ⋮ 메뉴 → <b>앱 설치</b> 또는 <b>홈 화면에 추가</b></li></ul>`;
}
function settingsView() {
  const own = isOwner();
  return `<h2>설정</h2>
  <div class="dgrid" style="margin-top:12px">
    <div class="panel box"><h3>내 계정</h3><p style="margin:0 0 10px">${esc(S.user.email)} · ${own ? '원장 (모든 권한)' : esc(S.myName || '선생님')}</p><button class="btn ghost small" data-act="logout">로그아웃</button></div>
    <div class="panel box"><h3>앱 설치</h3>${installBlock()}</div>
  </div>
  ${own ? `<div class="panel box" style="margin-top:16px"><h3>선생님 관리</h3>
    <p class="sub" style="margin-bottom:10px">여기에 등록한 구글 이메일만 앱에 들어올 수 있습니다. 이름은 학생의 '담당'과 같게 적으면 핸드폰에서 '내 담당' 학생만 따로 볼 수 있습니다.</p>
    <div class="row" style="margin-bottom:12px">
      <label for="stEmail">구글 이메일<input id="stEmail" type="email" data-bind="staffForm.email" value="${esc(S.staffForm.email)}" placeholder="teacher@gmail.com" style="min-width:240px"></label>
      <label for="stName">이름 (담당 표기)<input id="stName" data-bind="staffForm.name" value="${esc(S.staffForm.name)}" placeholder="예: 임소리"></label>
      <button class="btn" style="align-self:end" data-act="staffAdd">추가</button></div>
    <div class="panel scroll"><table><thead><tr><th>이름</th><th>이메일</th><th>담당 학생</th><th></th></tr></thead><tbody>
      ${S.staff.map(t => `<tr><td><b>${esc(t.name || '')}</b></td><td>${esc(t.email)}</td><td>${S.students.filter(s => s.teacher && s.teacher === t.name).length}명</td><td><button class="btn danger small" data-act="staffDel" data-v="${esc(t.email)}">${S.armed === 'staff:' + t.email ? '한 번 더 누르면 삭제' : '삭제'}</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">아직 등록된 선생님이 없습니다</td></tr>'}
    </tbody></table></div></div>
  <div class="panel box" style="margin-top:16px"><h3>자료 가져오기 · 내보내기</h3>
    <p class="sub" style="margin-bottom:10px">처음 한 번, 전에 쓰던 앱에서 받은 <b>얼리어답터_자료_옮기기.json</b> 파일을 가져오면 학생 명단과 점수가 들어옵니다. 같은 학생은 파일 내용으로 덮어씁니다.</p>
    <div class="row">
      <label class="btn ghost small" style="display:inline-flex;flex-direction:row;color:var(--brand)" for="importFile">자료 가져오기 (JSON)<input id="importFile" type="file" accept=".json,application/json" data-change="importFile" hidden></label>
      <button class="btn ghost small" data-act="exportJson">백업 내보내기 (JSON)</button>
      <button class="btn ghost small" data-act="exportCsv">엑셀용 내보내기 (CSV)</button></div>
    ${S.importPending ? `<div class="banner" style="margin-top:12px">학생 <b>${Object.keys(S.importPending).length}명</b>의 자료를 가져옵니다. 지금 앱에 같은 학생이 있으면 덮어씁니다.
      <div class="row" style="margin-top:8px"><button class="btn small" data-act="importGo">가져오기</button><button class="btn ghost small" data-act="importCancel">취소</button></div></div>` : ''}
  </div>` : `<div class="panel box" style="margin-top:16px"><h3>권한</h3><p style="margin:0">점수·성별·공부 성향·상담 메모를 입력할 수 있습니다. 학생 추가·삭제, 학교 기준값 수정, 선생님 관리는 원장님만 할 수 있습니다.</p></div>`}`;
}

// ----- 핸드폰 -----
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9H3z"></path>',
  edit: '<path d="M4 20h16M6 16l10-10 3 3-10 10H6z"></path>',
  people: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.7 3 2.5 3.5 5.2"></path>',
  more: '<circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle>',
  back: '<path d="M15 5l-7 7 7 7"></path>'
};
const svg = (k, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
function phoneList() {
  const q = S.search.trim();
  return S.students.filter(s => {
    if (S.mFilter === 'mine' && S.myName && s.teacher !== S.myName) return false;
    if (S.mFilter === 'judged' && analyze(s).verdict.status === 'none') return false;
    if (S.mFilter === 'pending' && !recs(s).some(x => x.sch && x.score == null)) return false;
    return !q || [s.name, s.middle, ...schoolsOf(s)].some(v => String(v || '').includes(q));
  });
}
function phoneView() {
  let body;
  if (S.mtab === 'students' && S.mDetail && stu(S.curId)) body = mDetail(stu(S.curId));
  else body = { home: mHome, entry: mEntry, students: mStudents, more: mMore }[S.mtab]();
  const tabs = [['home', '홈', 'home'], ['entry', '점수 입력', 'edit'], ['students', '학생', 'people'], ['more', '더보기', 'more']];
  return `<div class="m">${body}</div>
  <nav class="tabbar" aria-label="주요 메뉴">${tabs.map(([k, l, ic]) => `<button aria-current="${S.mtab === k}" data-act="mtab" data-v="${k}">${svg(ic)}${l}</button>`).join('')}</nav>
  ${S.sheet === 'pickStudent' ? mPickSheet() : ''}${S.sheet === 'memo' ? mMemoSheet() : ''}`;
}
function mHome() {
  const c = counts();
  const mine = S.students.filter(s => !(S.role === 'teacher' && S.myName) || s.teacher === S.myName);
  const pending = [];
  const today = todayIso();
  mine.forEach(s => recs(s).forEach(x => { if (x.sch && x.score == null && (!x.isoDate || x.isoDate <= today)) pending.push({ s, x }); }));
  pending.sort((a, b) => String(a.x.isoDate || '').localeCompare(String(b.x.isoDate || '')));
  return `<header class="mhead brand">
    <div class="t1"><b>수학도서관</b>${syncTxt().replace('class="sync', 'style="color:inherit;opacity:.85" class="sync')}</div>
    <div class="t2">얼리어답터</div>
    <div class="t3">${esc(S.myName || '')} · 1차 1~3회 · 2차 4~6회</div></header>
  <div class="mbody">
    ${!S.loaded ? '<p class="empty">불러오는 중…</p>' : ''}
    <div class="mtiles">
      <div class="mtile"><span>점수 입력</span><b>${c.filled}<small style="font-size:12px;color:var(--muted);font-weight:400">/${c.n * 6}</small></b></div>
      <div class="mtile"><span>판단 나옴</span><b>${c.judged}<small style="font-size:12px;color:var(--muted);font-weight:400">명</small></b></div>
      <div class="mtile ${pending.length ? 'warn' : ''}"><span>입력 대기</span><b>${pending.length}</b></div>
    </div>
    <button class="btn big" data-act="mtab" data-v="entry">${svg('edit', 20)} 점수 바로 입력</button>
    <div class="msec"><span class="lab"><b style="color:var(--fg)">점수 입력 대기</b> · 응시했는데 점수가 없음${S.role === 'teacher' && S.myName ? ' (내 담당)' : ''}</span>
      ${pending.length ? `<div class="mlist">${pending.slice(0, 8).map(({ s, x }) => `<button class="mrow" data-act="quickEntry" data-id="${s.id}" data-r="${x.r}"><span class="grow"><b>${esc(s.name)}</b><small>${x.r}회 · ${esc(x.sch)}${x.date ? ' · ' + esc(x.date) : ''}</small></span><span class="go">입력 ›</span></button>`).join('')}</div>${pending.length > 8 ? `<span class="src">외 ${pending.length - 8}건</span>` : ''}` : '<div class="mlist"><div class="mrow"><span class="grow"><small>대기 중인 점수가 없습니다</small></span></div></div>'}</div>
    <div class="msec"><span class="lab"><b style="color:var(--fg)">확인할 것</b></span>
      <div class="mlist"><div class="mrow"><span class="grow"><small>성별 미입력 <b>${c.noSex}명</b> · 시험지 연도 미입력 <b>${c.noYear}장</b></small></span></div></div></div>
  </div>`;
}
function mEntry() {
  if (!S.students.length) return `<header class="mhead"><span class="title">점수 입력</span></header><div class="mbody">${emptyStudents()}</div>`;
  ensureEntry();
  const e = S.entry, s = stu(e.sid), rs = recs(s), sc = schoolsOf(s);
  const chipsSch = [...sc]; if (e.sch && e.sch !== '__new' && !chipsSch.includes(e.sch)) chipsSch.push(e.sch);
  const def = rs.find(x => x.r === e.r - 3)?.sch;
  return `<header class="mhead"><span class="title">점수 입력</span></header>
  <div class="mbody">
    <div class="msec"><span class="lab">학생</span>
      <button class="mcard" data-act="sheet" data-v="pickStudent" style="flex-direction:row;justify-content:space-between;align-items:center;min-height:56px"><span><b style="font-size:17px">${esc(s.name)}</b> <small style="color:var(--muted)">${esc(s.middle || '')} · ${esc(s.teacher || '')}</small></span><span style="font-size:13px;color:var(--brand);font-weight:600">바꾸기</span></button></div>
    <div class="msec"><span class="lab">회차 <span class="src">· 진한 칸 = 점수 있음</span></span>
      <div class="cgrid" style="grid-template-columns:repeat(6,minmax(0,1fr))">${[1, 2, 3, 4, 5, 6].map(n => { const x = rs.find(q => q.r === n); return `<button class="cbtn ${x && x.score != null ? 'has' : ''}" aria-pressed="${n === e.r}" data-act="eRound" data-v="${n}" aria-label="${n}회">${n}</button>`; }).join('')}</div>
      <span class="src">${e.r}회 = ${phase(e.r)}${e.r > 3 && def ? ` · ${e.r - 3}회 학교(${esc(def)})를 먼저 골라 둡니다` : ''}</span></div>
    <div class="msec"><span class="lab">응시학교</span>
      <div class="row">${chipsSch.map(x => `<button class="cbtn" style="padding:0 16px;border-radius:999px" aria-pressed="${x === e.sch}" data-act="eSch" data-v="${esc(x)}">${esc(x)}</button>`).join('')}
        <button class="cbtn dash" style="padding:0 16px;border-radius:999px" aria-pressed="${e.sch === '__new'}" data-act="eSch" data-v="__new">+ 다른 학교</button></div>
      ${e.sch === '__new' ? `<input id="mNew" data-bind="entry.newSch" value="${esc(e.newSch)}" placeholder="학교 이름 (예: 양천고)" style="font-size:16px;padding:12px">` : ''}</div>
    <div class="msec"><span class="lab">시험지 연도</span>
      <div class="cgrid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${['2026', '2025', '2024', ''].map(y => `<button class="cbtn" aria-pressed="${e.y === y}" data-act="eYear" data-v="${y}">${y || '모름'}</button>`).join('')}</div></div>
    <label for="mScore" style="font-size:13px">점수 (100점 만점)
      <input id="mScore" class="scoreinput" type="text" inputmode="decimal" data-bind="entry.score" value="${esc(e.score)}" placeholder="0.0" autocomplete="off"></label>
    <div class="cgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <button class="cbtn" aria-pressed="${e.stage === '1'}" data-act="eStage" data-v="1">조교 채점 완료</button>
      <button class="cbtn" aria-pressed="${e.stage === '2'}" data-act="eStage" data-v="2">담당T 확인 완료</button></div>
    <span class="src">응시일은 오늘 날짜로 기록됩니다 (이미 날짜가 있으면 그대로). 날짜를 바꾸려면 PC·아이패드에서 하세요.</span>
    <div class="mfoot"><div class="cgrid" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
      <button class="btn big ghost" data-act="saveEntry">저장</button>
      <button class="btn big" data-act="saveNext">저장하고 다음 학생</button></div></div>
  </div>`;
}
function mPickSheet() {
  const list = phoneList();
  return `<div class="sheet" data-act="closeSheet"><div class="in" data-stop="1" role="dialog" aria-label="학생 고르기">
    <div class="row" style="justify-content:space-between"><b style="font-size:17px">학생 고르기</b><button class="btn ghost small" data-act="closeSheet">닫기</button></div>
    ${filterChips()}
    <div class="list mlist">${list.map(s => `<button class="mrow" data-act="pickForEntry" data-id="${s.id}"><span class="grow"><b>${esc(s.name)}</b><small>${esc(s.middle || '')} · ${esc(s.teacher || '')} · 점수 ${recs(s).filter(x => x.score != null).length}/6</small></span>${s.id === S.entry.sid ? '<span class="go">선택됨</span>' : ''}</button>`).join('') || '<div class="mrow"><small>해당하는 학생이 없습니다</small></div>'}</div>
  </div></div>`;
}
function filterChips() {
  const fs = [...(S.myName && S.role === 'teacher' ? [['mine', '내 담당']] : []), ['all', '전체'], ['judged', '판단 나옴'], ['pending', '입력 대기']];
  return `<div class="row">${fs.map(([k, l]) => `<button class="chip" aria-pressed="${S.mFilter === k}" data-act="mFilter" data-v="${k}">${l}</button>`).join('')}</div>`;
}
function mStudents() {
  const list = phoneList();
  return `<header class="mhead" style="flex-direction:column;align-items:stretch;gap:10px">
    <span class="title">학생 <span style="font-size:14px;color:var(--muted);font-weight:400">${list.length}명</span></span>
    <input id="mq" type="search" data-bind="search" data-rerender="1" value="${esc(S.search)}" placeholder="이름 또는 학교 검색" aria-label="학생 검색" style="font-size:16px;padding:11px 14px;border-radius:12px">
    ${filterChips()}</header>
  <div class="mbody">${!S.students.length ? emptyStudents() : list.map(s => {
      const rs = recs(s); const dots = n => n.map(r => { const x = rs.find(q => q.r === r); return x && x.score != null ? '●' : '○'; }).join('');
      return `<button class="mcard" data-act="mOpen" data-id="${s.id}"><span class="l1"><span><b style="font-size:17px">${esc(s.name)}</b> <small style="color:var(--muted)">${esc(s.middle || '')}</small></span>${verdictPill(s)}</span>
        <span class="l2"><span>${schoolsOf(s).map(x => esc(x.replace(/고$/, ''))).join(' · ') || '응시학교 미정'}</span><span style="color:var(--brand);letter-spacing:2px">${dots([1, 2, 3])} ${dots([4, 5, 6])}</span></span></button>`;
    }).join('') || '<p class="empty">해당하는 학생이 없습니다</p>'}</div>`;
}
function mDetail(s) {
  const an = analyze(s), v = an.verdict;
  const cs = s.consult || 0;
  return `<header class="mhead"><button class="iconbtn" data-act="mBack" aria-label="학생 목록으로">${svg('back')}</button>
    <div style="display:flex;flex-direction:column"><b style="font-size:18px">${esc(s.name)}</b><small style="color:var(--muted)">${esc(s.middle || '')} · ${esc(s.teacher || '')} · 성별 ${esc(s.sex || '미입력')}</small></div></header>
  <div class="mbody">
    ${v.status === 'none' ? `<div class="reco"><div class="eyebrow">판단 결과</div><div class="school" style="color:var(--muted);font-size:22px">아직 판단 전</div><p style="margin:0;font-size:13px">기준값이 있는 응시학교 2곳 이상의 점수가 모이면 판단합니다.</p></div>`
      : `<div class="reco"><div class="eyebrow">지원 유리 학교</div><div class="school" style="font-size:30px">${esc(v.best.sch)}</div>
        <div style="font-size:14px">상위 ${v.best.top}% · 참고 ${v.best.g}등급${v.status === 'partial' ? ' <span style="color:var(--muted)">· 잠정</span>' : ''}</div>
        ${warnsFor(s, v.best.sch).slice(0, 2).map(w => `<div style="font-size:13px;color:var(--warn)">주의 · ${esc(w)}</div>`).join('')}
        ${v.general.length >= 2 ? `<div class="order">원서 지망 순서 제안 · ${v.general.map(r => esc(r.sch)).join(' → ')}</div>` : ''}</div>`}
    <div class="panel box" style="display:flex;flex-direction:column;gap:14px"><b style="font-size:14px">학교별 예상 위치</b>
      ${an.rows.map(r => `<div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:14px"><b>${esc(r.sch)}</b><span>${vpTxt(r.v)} ${r.top != null ? '상위 ' + r.top + '%' : ''}</span></div>
        <div class="mbar"><i style="width:${r.top != null ? Math.max(2, 100 - r.top) : 0}%"></i></div>
        <span class="src">${r.ps.map(x => `${x.score}점 (${x.r}회${x.y ? '·' + x.y : ''})`).join(' · ') || '점수 없음'}${r.ref ? ` · 기준 ${r.ref.m}` : ''}</span></div>`).join('') || '<span class="empty">응시학교가 아직 없습니다</span>'}</div>
    <div class="panel box"><b style="font-size:14px">진행 단계</b>
      <div class="cgrid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:8px">${CONSULT.map((t, i) => `<button class="cbtn" style="font-size:12px;min-height:40px" aria-pressed="${i < cs}" data-act="consult" data-id="${s.id}" data-i="${i + 1}">${t.replace(/^\d차 /, '')}</button>`).join('')}</div></div>
    <div class="cgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
      <button class="btn big" data-act="quickEntry" data-id="${s.id}" data-r="${(recs(s).find(x => x.score == null && x.sch) || {}).r || 1}">점수 입력</button>
      <button class="btn big ghost" data-act="sheet" data-v="memo">메모 보기</button></div>
    <div class="panel box"><b style="font-size:14px">성별</b> <span class="src">남고·여고 자동 제외에 사용</span><div class="cgrid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:8px">${[['', '미입력'], ['남', '남'], ['여', '여']].map(([k, l]) => `<button class="cbtn" aria-pressed="${(s.sex || '') === k}" data-act="mSex" data-id="${s.id}" data-v="${k}">${l}</button>`).join('')}</div></div>
  </div>`;
}
function mMemoSheet() {
  const s = stu(S.curId); if (!s) return '';
  return `<div class="sheet" data-act="closeSheet"><div class="in" data-stop="1" role="dialog" aria-label="상담 메모">
    <div class="row" style="justify-content:space-between"><b style="font-size:17px">${esc(s.name)} 상담 메모</b><button class="btn ghost small" data-act="closeSheet">닫기</button></div>
    <div class="list" style="white-space:pre-wrap;font-size:15px;line-height:1.7">${s.memo ? esc(s.memo) : '<span class="empty">아직 메모가 없습니다. 메모 작성은 PC·아이패드에서 합니다.</span>'}</div></div></div>`;
}
function mMore() {
  return `<header class="mhead"><span class="title">더보기</span></header>
  <div class="mbody">
    <div class="panel box"><b>내 계정</b><p style="margin:6px 0 10px">${esc(S.user.email)}<br><span class="src">${isOwner() ? '원장 (모든 권한)' : esc(S.myName || '선생님')}</span></p><button class="btn ghost small" data-act="logout">로그아웃</button></div>
    <div class="panel box"><b>앱 설치</b><div style="margin-top:8px">${installBlock()}</div></div>
    <div class="panel box"><b>학교 기준값</b><p class="src" style="margin:4px 0 8px">고1 수학 공시 평균 / 표준편차 (판단 기준)</p>
      <div class="mlist">${Object.keys(SCH).map(sch => { const r = refFor(sch); return `<div class="mrow" style="min-height:44px"><span class="grow"><b style="font-size:14px">${esc(sch)}</b></span><small>${r ? `${r.m} / ${r.sd}` : '없음'}</small></div>`; }).join('')}</div></div>
    <p class="src">학생 추가·삭제, 기준값 수정, 선생님 관리, 자료 가져오기·내보내기는 PC·아이패드 화면의 '설정'에서 합니다.</p>
  </div>`;
}

// ===== 내보내기 =====
function download(name, data, type) {
  const blob = new Blob([data], { type }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function exportJson() {
  const out = { app: 'early-adopter', exportedAt: new Date().toISOString(), students: {}, refs: S.refInput, mode: S.refMode };
  S.students.forEach(({ id, ...rest }) => { out.students[id] = rest; });
  download(`얼리어답터_백업_${todayIso()}.json`, JSON.stringify(out, null, 1), 'application/json');
}
function exportCsv() {
  const head = ['번호', '학생', '성별', '중학교', '담당', '1지망', '2지망', '3지망'];
  for (let r = 1; r <= 6; r++) head.push(`${r}회 학교`, `${r}회 연도`, `${r}회 응시일`, `${r}회 점수`);
  head.push('판단(지원 유리 학교)', '상태', '상담 메모');
  const lines = [head];
  S.students.forEach(s => {
    const rs = recs(s), h = s.hopes || [], an = analyze(s);
    const row = [s.no ?? '', s.name, s.sex || '', s.middle || '', s.teacher || '', h[0] || '', h[1] || '', h[2] || ''];
    for (let r = 1; r <= 6; r++) { const x = rs.find(q => q.r === r); row.push(x?.sch || '', x?.y || '', x?.date || '', x?.score ?? ''); }
    row.push(an.verdict.best?.sch || '', an.verdict.status === 'done' ? '확정' : an.verdict.status === 'partial' ? '잠정' : '데이터 부족', s.memo || '');
    lines.push(row);
  });
  const csv = '﻿' + lines.map(r => r.map(c => { const v = String(c ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\r\n');
  download(`얼리어답터_현황_${todayIso()}.csv`, csv, 'text/csv;charset=utf-8');
}
async function importGo() {
  const data = S.importPending; if (!data) return;
  const ids = Object.keys(data);
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const b = writeBatch(db);
      ids.slice(i, i + 400).forEach(id => b.set(doc(db, 'students', id), data[id]));
      await b.commit();
    }
    toast(`학생 ${ids.length}명 자료를 가져왔습니다`); S.importPending = null; render();
  } catch (e) { toast('가져오지 못했습니다: ' + (e.code || e.message), true); }
}

// ===== 이벤트 =====
function setPath(path, val) {
  const ks = path.split('.'); let o = S;
  for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] ?? {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = val;
}
document.addEventListener('input', e => {
  const el = e.target.closest('[data-bind]'); if (!el) return;
  setPath(el.dataset.bind, el.value);
  if (el.dataset.rerender) render();
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change, id = el.dataset.id;
  if (k === 'sex') saveStudent(id, { sex: el.value });
  else if (k === 'ab') { const v = el.value === '' ? null : Math.max(0, Math.min(4, +el.value)); saveStudent(id, { [el.dataset.k]: v }); }
  else if (k === 'eStudent') { setEntry(el.value, S.entry.r); render(); }
  else if (k === 'eRound') { setEntry(S.entry.sid, +el.value); render(); }
  else if (k === 'eSchool') { S.entry.sch = el.value; render(); }
  else if (k === 'eYear') { S.entry.y = el.value; }
  else if (k === 'eStage') { S.entry.stage = el.value; }
  else if (k === 'ref') {
    const sch = el.dataset.s, cur = { ...(S.refInput[sch] || {}) };
    cur[el.dataset.k] = el.value === '' ? null : parseFloat(el.value);
    const next = { ...S.refInput };
    if (cur.m == null || isNaN(cur.m)) delete next[sch]; else next[sch] = { m: cur.m, sd: cur.sd ?? null };
    S.refInput = next;
    setDoc(doc(db, 'settings', 'refs'), { refs: next, mode: S.refMode }, { merge: false }).then(() => toast('기준값 저장됨')).catch(err => toast(failMsg(err), true));
    render();
  } else if (k === 'importFile') {
    const f = el.files && el.files[0]; if (!f) return;
    f.text().then(txt => {
      const j = JSON.parse(txt); const st = j.students || j;
      if (!st || typeof st !== 'object' || !Object.values(st).every(v => v && typeof v === 'object' && 'name' in v)) throw new Error('형식');
      S.importPending = st; render();
    }).catch(() => toast('얼리어답터 자료 파일이 아닙니다', true));
    el.value = '';
  }
});
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'closeSheet' && e.target.closest('[data-stop]') && !e.target.closest('button[data-act="closeSheet"]')) return;
  const { act, v, id } = el.dataset;
  if (act !== 'delStudent' && act !== 'staffDel' && act !== 'delEntry') S.armed = null;
  switch (act) {
    case 'login': login(); return;
    case 'logout': S.curId = null; S.students = []; signOut(auth); return;
    case 'reload': location.reload(); return;
    case 'tab': S.tab = v; S.editInfo = false; window.scrollTo(0, 0); break;
    case 'mtab': S.mtab = v; S.mDetail = false; S.sheet = null; window.scrollTo(0, 0); break;
    case 'teacher': S.teacher = v; break;
    case 'tfilter': S.tfilter = v; break;
    case 'mFilter': S.mFilter = v; break;
    case 'refMode': if (!isOwner() || S.refMode === v) return; S.refMode = v; setDoc(doc(db, 'settings', 'refs'), { refs: S.refInput, mode: v }).catch(err => toast(failMsg(err), true)); break;
    case 'openStudent': if (e.target.closest('select')) return; S.curId = id; S.tab = 'students'; S.editInfo = false; window.scrollTo(0, 0); break;
    case 'pickStudent': S.curId = id; S.editInfo = false; break;
    case 'goEntry': setEntry(id, (recs(stu(id)).find(x => x.score == null && x.sch) || {}).r || 1); S.tab = 'entry'; window.scrollTo(0, 0); break;
    case 'editInfo': S.editInfo = true; break;
    case 'cancelInfo': S.editInfo = false; break;
    case 'saveInfo': {
      const name = document.getElementById('fName').value.trim(); if (!name) { toast('이름을 적어 주세요', true); return; }
      saveStudent(id, { name, middle: document.getElementById('fMiddle').value.trim(), teacher: document.getElementById('fTeacher').value.trim(), hopes: ['fH1', 'fH2', 'fH3'].map(k => document.getElementById(k).value.trim()).filter(Boolean) });
      S.editInfo = false; break;
    }
    case 'delStudent':
      if (S.armed !== 'del:' + id) { S.armed = 'del:' + id; break; }
      S.armed = null; deleteDoc(doc(db, 'students', id)).then(() => toast('삭제됨')).catch(err => toast(failMsg(err), true)); S.curId = null; S.editInfo = false; break;
    case 'addStudent': {
      const no = S.students.reduce((m, s) => Math.max(m, s.no || 0), 0) + 1;
      const nid = 's' + Date.now().toString(36);
      setDoc(doc(db, 'students', nid), { no, name: '새 학생', middle: '', teacher: S.teacher === '전체' ? '' : S.teacher, hopes: [], sex: '', A: null, B: null, memo: '', consult: 0, records: [] }).catch(err => toast(failMsg(err), true));
      S.curId = nid; S.tab = 'students'; S.editInfo = true; break;
    }
    case 'saveMemo': { const txt = S.memoDraft[id] ?? stu(id)?.memo ?? ''; saveStudent(id, { memo: txt }, '메모 저장됨'); delete S.memoDraft[id]; break; }
    case 'consult': { const s = stu(id); const cs = s.consult || 0, i = +el.dataset.i; saveStudent(id, { consult: cs === i ? i - 1 : i }, null); s.consult = cs === i ? i - 1 : i; break; }
    case 'entryRound': setEntry(S.entry.sid, +v); break;
    case 'saveEntry': saveEntry(false); return;
    case 'saveNext': saveEntry(true); return;
    case 'delEntry': delEntry(); return;
    case 'eRound': setEntry(S.entry.sid, +v); break;
    case 'eSch': S.entry.sch = v; break;
    case 'eYear': S.entry.y = v; break;
    case 'eStage': S.entry.stage = v; break;
    case 'quickEntry': setEntry(id, +el.dataset.r || 1); S.mtab = 'entry'; S.mDetail = false; S.tab = 'entry'; window.scrollTo(0, 0); break;
    case 'sheet': S.sheet = v; break;
    case 'closeSheet': S.sheet = null; break;
    case 'pickForEntry': setEntry(id, S.entry.r); S.sheet = null; break;
    case 'mOpen': S.curId = id; S.mDetail = true; window.scrollTo(0, 0); break;
    case 'mBack': S.mDetail = false; break;
    case 'mSex': saveStudent(id, { sex: v }); stu(id).sex = v; break;
    case 'staffAdd': {
      const email = S.staffForm.email.trim().toLowerCase(), name = S.staffForm.name.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('이메일을 확인해 주세요', true); return; }
      if (email === OWNER_EMAIL.toLowerCase()) { toast('원장님 계정은 따로 등록하지 않아도 됩니다'); return; }
      setDoc(doc(db, 'staff', email), { name, addedAt: new Date().toISOString() }).then(() => toast(`${name || email} 선생님을 추가했습니다`)).catch(err => toast(failMsg(err), true));
      S.staffForm = { email: '', name: '' }; break;
    }
    case 'staffDel':
      if (S.armed !== 'staff:' + v) { S.armed = 'staff:' + v; break; }
      S.armed = null; deleteDoc(doc(db, 'staff', v)).then(() => toast('삭제됨')).catch(err => toast(failMsg(err), true)); break;
    case 'exportJson': exportJson(); return;
    case 'exportCsv': exportCsv(); return;
    case 'importGo': importGo(); return;
    case 'importCancel': S.importPending = null; break;
    case 'install': if (S.installEvt) { S.installEvt.prompt(); S.installEvt.userChoice.finally(() => { S.installEvt = null; render(); }); } return;
    default: return;
  }
  render();
});

// ===== 시작 =====
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
render();
