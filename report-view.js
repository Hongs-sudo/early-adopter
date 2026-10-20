// 학부모·학생 리포트 그리기 — 앱(미리보기·이미지·인쇄)과 학부모 링크 화면이 함께 씀
// d = 리포트 사본(snapshot). 앱이 링크를 만들 때 reports/{key}.data 로 저장한 값과 같은 모양.
export const PHONE_MAIN = '010.3358.9007';
export const PHONE_SUB = '02.2651.7750';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VLABEL = { good: ['유리', 'rp-v-good'], next: ['다음 순위', 'rp-v-next'], blocked: ['지원 불가', 'rp-v-none'], none: ['기준값 없음', 'rp-v-none'] };
const vpill = v => { const [t, c] = VLABEL[v] || VLABEL.none; return `<span class="rp-pill ${c}">${t}</span>`; };
const fmt = n => n == null ? '–' : (Math.round(n * 10) / 10).toFixed(1);
const scoresTxt = r => r.scores.map(x => `<b>${fmt(x.s)}</b><small>${x.r}회${x.y ? '·' + x.y : ''}</small>`).join('<i>·</i>');
const barW = r => r.top == null || r.v === 'blocked' ? 0 : Math.max(2, 100 - r.top);

function heroLine(d) {
  const b = d.best;
  return `학교 안 예상 위치 <b>상위 ${b.top}%</b>${d.showGrade ? ` · 참고 <b>${b.g}등급</b>` : ''}`;
}
function caveat(d) {
  return d.showGrade
    ? '참고 등급은 입학 전 학생의 점수를 재학생 공시 평균과 견준 값이라 실제보다 낮게 나오는 편입니다. 학교끼리 비교하는 용도로 봐 주세요.'
    : '예상 위치는 학생의 점수를 그 학교 재학생 공시 평균과 견준 값입니다. 학교끼리 비교하는 용도로 봐 주세요.';
}
function noteBody(n) {
  const facts = [n.n1 ? `1학년 ${n.n1}명` : '', n.seats ? `1등급 약 ${n.seats}명` : '', n.mid != null ? `중간고사 ${n.mid}%` : '', n.perf != null ? `수행평가 ${n.perf}%` : ''].filter(Boolean).join(' · ');
  return `${n.style ? `<span>${esc(n.style)}</span>` : ''}${facts ? `<span class="rp-muted">${facts}</span>` : ''}`;
}

export function renderA4(d) {
  const notes = d.showNotes ? d.notes.filter(n => n.style || n.n1) : [];
  const cols = Math.min(Math.max(notes.length, 1), 4);
  return `<div class="rp-a4">
  <header class="rp-head"><div><b class="rp-logo">수학도서관</b><span class="rp-slogan">1:1 명품 맞춤 수학학원</span></div>
    <div class="rp-head-r"><b>예비고1 얼리어답터 결과 리포트</b><span>최종 결과 · ${esc(d.issued)} 발행</span></div></header>
  <div class="rp-body">
    <div class="rp-who"><div><b>${esc(d.name)}</b><span>${esc(d.middle)}${d.teacher ? ` · 담당 ${esc(d.teacher)} 선생님` : ''}</span></div><span>응시 ${d.rows.length}개교 · 시험지 ${d.papers}장</span></div>
    <div class="rp-top">
      <div class="rp-hero"><span class="rp-eyebrow">얼리어답터 결과로 본 지원 유리 학교</span><b class="rp-best">${esc(d.best.sch)}</b><span class="rp-heroline">${heroLine(d)}</span>
        <span class="rp-muted">1차(9월)·2차(11월) 시험지를 학교별로 평균 내어 판단했습니다.</span></div>
      <div class="rp-side"><b>응시 요약</b>
        <div class="rp-steps"><span><i class="on"></i>1차 응시 (9월)</span><em>완료</em><span><i class="on"></i>2차 응시 (11월)</span><em>완료</em><span><i></i>결과 상담</span><em class="rp-muted">안내 예정</em></div>
        ${d.showOrder && d.order.length >= 2 ? `<div class="rp-order"><span class="rp-muted">일반고 원서 지망 순서 제안</span><b>${d.order.map(esc).join(' → ')}</b></div>` : ''}
        ${d.special.length ? `<div class="rp-order"><span class="rp-muted">원서 별도</span><b>${d.special.map(esc).join(' · ')}</b></div>` : ''}</div>
    </div>
    <section><h2>학교별 결과</h2>
      <table class="rp-table"><thead><tr><th>응시학교</th><th>시험지 점수</th><th>학교 평균 (공시)</th><th class="rp-wbar">학교 안 예상 위치</th>${d.showGrade ? '<th>참고 등급</th>' : ''}<th>판단</th></tr></thead>
      <tbody>${d.rows.map(r => `<tr><td><b>${esc(r.sch)}</b>${r.kind ? `<small class="rp-muted"> ${esc(r.kind)}</small>` : ''}</td><td class="rp-scores">${scoresTxt(r)}${r.scores.length > 1 ? `<div class="rp-muted">평균 ${fmt(r.avg)}</div>` : ''}</td>
        <td>${r.m != null ? `${fmt(r.m)} <small class="rp-muted">± ${fmt(r.sd)}</small>` : '–'}</td>
        <td><div class="rp-barrow"><div class="rp-track"><div class="rp-fill ${r.v === 'good' ? 'best' : ''}" style="width:${barW(r)}%"></div></div><span>${r.top != null ? '상위 ' + r.top + '%' : '–'}</span></div></td>
        ${d.showGrade ? `<td>${r.g ? r.g + '등급' : '–'}</td>` : ''}<td>${vpill(r.v)}</td></tr>`).join('')}</tbody></table>
      <span class="rp-muted rp-small">학교 평균 ± 표준편차는 학교알리미 고1 수학 1학기 공시(2023·2024 평균)입니다.</span></section>
    ${notes.length ? `<section><h2>학교별로 알아 두실 점</h2><div class="rp-notes" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">${notes.map(n => `<div class="rp-note"><b>${esc(n.sch)}${n.kind ? ` <small class="rp-muted">${esc(n.kind)}</small>` : ''}</b>${noteBody(n)}</div>`).join('')}</div></section>` : ''}
    ${d.comment ? `<section class="rp-comment"><h2>담당 선생님 의견</h2><p>${esc(d.comment)}</p></section>` : ''}
  </div>
  <footer class="rp-foot"><span>${caveat(d)} 이 리포트는 수학도서관 얼리어답터 응시 결과를 바탕으로 한 참고 자료입니다.</span>
    <div><span class="rp-muted">상담 및 등록 문의</span><b>${PHONE_MAIN}</b><span class="rp-muted">${PHONE_SUB}</span></div></footer>
</div>`;
}

// st: { confirmed, consult: null|'requested'|'declined', staff, busy }
export function renderMobile(d, st = {}) {
  const notes = d.showNotes ? d.notes.filter(n => n.style || n.n1) : [];
  let action;
  if (st.staff) action = `<div class="rp-m-card rp-m-staff">선생님 미리보기입니다. 원장님·선생님이 연 것은 열람·확인 기록에 들어가지 않습니다.</div>`;
  else if (!st.confirmed) action = `<div class="rp-m-card rp-m-cta"><span>리포트를 다 보셨으면 아래 버튼을 눌러 주세요. 담당 선생님께 확인 표시가 전달됩니다.</span>
      <button class="rp-btn" data-act="confirm" ${st.busy ? 'disabled' : ''}>리포트를 확인했습니다</button></div>`;
  else if (!st.consult) action = `<div class="rp-m-card rp-m-cta"><b class="rp-ok">확인해 주셔서 감사합니다</b>
      <span>결과에 대해 담당 선생님과 상담을 원하시나요?</span>
      <button class="rp-btn" data-act="consult" ${st.busy ? 'disabled' : ''}>상담 요청하기</button>
      <button class="rp-btn ghost" data-act="noConsult" ${st.busy ? 'disabled' : ''}>지금은 괜찮습니다</button></div>`;
  else if (st.consult === 'requested') action = `<div class="rp-m-card rp-m-done"><b>상담 요청이 전달되었습니다</b><span>${d.teacher ? esc(d.teacher) + ' 선생님이' : '담당 선생님이'} 확인 후 연락드리겠습니다.</span></div>`;
  else action = `<div class="rp-m-card rp-m-done"><b>확인해 주셔서 감사합니다</b><span>상담이 필요하시면 언제든 아래 번호로 연락해 주세요.</span><button class="rp-link" data-act="consult">상담 요청하기</button></div>`;
  return `<div class="rp-m">
  <header class="rp-m-head"><div class="rp-m-row"><b class="rp-logo">수학도서관</b><span>최종 결과 · ${esc(d.issued)}</span></div>
    <span class="rp-m-title">예비고1 얼리어답터 결과 리포트</span><b class="rp-m-name">${esc(d.name)} 학생</b><span class="rp-m-sub">${esc(d.middle)}${d.teacher ? ` · 담당 ${esc(d.teacher)} 선생님` : ''}</span></header>
  <main class="rp-m-body">
    <div class="rp-hero"><span class="rp-eyebrow">얼리어답터 결과로 본 지원 유리 학교</span><b class="rp-best">${esc(d.best.sch)}</b><span class="rp-heroline">${heroLine(d)}</span>
      <span class="rp-muted">1차(9월)·2차(11월) 시험지 ${d.papers}장을 학교별로 평균 내어 판단했습니다.</span></div>
    <div class="rp-m-card"><b class="rp-m-h">학교별 결과</b>
      ${d.rows.map(r => `<div class="rp-m-school"><div class="rp-m-row"><b>${esc(r.sch)}</b>${vpill(r.v)}</div>
        <div class="rp-track lg"><div class="rp-fill ${r.v === 'good' ? 'best' : ''}" style="width:${barW(r)}%"></div></div>
        <div class="rp-m-row rp-small"><span>시험지 ${r.scores.map(x => `<b>${fmt(x.s)}</b>`).join(' · ')}${r.m != null ? ` · 학교 평균 ${fmt(r.m)}` : ''}</span><span>${r.top != null ? '상위 ' + r.top + '%' : ''}${d.showGrade && r.g ? ' · ' + r.g + '등급' : ''}</span></div></div>`).join('')}
      ${d.showOrder && d.order.length >= 2 ? `<div class="rp-m-order rp-small">일반고 원서 지망 순서 제안 · <b>${d.order.map(esc).join(' → ')}</b></div>` : ''}
      ${d.special.length ? `<div class="rp-m-order rp-small">원서 별도 · <b>${d.special.map(esc).join(' · ')}</b></div>` : ''}</div>
    ${notes.length ? `<div class="rp-m-card"><b class="rp-m-h">학교별로 알아 두실 점</b>${notes.map(n => `<div class="rp-m-note"><b>${esc(n.sch)}</b>${noteBody(n)}</div>`).join('')}</div>` : ''}
    ${d.comment ? `<div class="rp-m-card"><b class="rp-m-h">담당 선생님 의견</b><p class="rp-m-comment">${esc(d.comment)}</p></div>` : ''}
    ${action}
    <a class="rp-call" href="tel:${PHONE_MAIN.replace(/\./g, '')}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"></path></svg>상담 문의 ${PHONE_MAIN}</a>
    <p class="rp-muted rp-small rp-m-cav">${caveat(d)}</p>
  </main></div>`;
}
