/* Interactive local sample (week 2). Changes stay on this page; nothing is saved or sent. */
const {MEMBERS: names, NAMES, LATE_BEFORE, WEEK, display, initialLetter, initial, totals, record, reminder} = DemoState;
let state = initial(), history = [];
const ngn = n => '₦' + n.toLocaleString('en-US');
const $ = id => document.getElementById(id);

function render(message) {
  const t = totals(state);
  $('total').textContent = ngn(t.total);
  $('goal').textContent = 'of ' + ngn(t.goal) + ' planned for week ' + WEEK;
  $('count').textContent = `${t.count} of ${t.members} recorded`;
  const ring = $('ring');
  ring.style.setProperty('--progress', `${t.percent}%`);
  ring.setAttribute('aria-valuemax', t.members);
  ring.setAttribute('aria-valuenow', t.count);
  ring.setAttribute('aria-valuetext', `${t.count} of ${t.members} sample contributions recorded (${t.percent}%)`);
  const pct = $('percent');
  pct.textContent = String(t.percent);
  const unit = document.createElement('span');
  unit.textContent = '%';
  pct.append(unit);
  $('member-list').innerHTML = names.map((n, i) => `<div class="member"><span class="avatar" aria-hidden="true">${initialLetter(n)}</span><span class="member-name">${display(n)}<small>${i === LATE_BEFORE ? 'Paid week 1 late (fictional history)' : 'Fictional sample member'}</small></span>${state[i] ? '<span class="recorded">✓ Recorded</span>' : `<button type="button" class="record" data-member="${i}" aria-label="Record sample contribution for ${display(n)}">Record sample</button>`}</div>`).join('');
  $('reminder').textContent = reminder(state);
  $('undo').disabled = !history.length;
  if (message) $('feedback').textContent = message;
}

$('member-list').addEventListener('click', e => {
  const b = e.target.closest('[data-member]');
  if (!b) return;
  const i = Number(b.dataset.member);
  if (state[i]) return;
  history.push([...state]);
  state = record(state, i);
  render(`${NAMES[names[i]]}: week ${WEEK} sample recorded. No money moved.`);
  (document.querySelector('[data-member]') || $('undo')).focus();
});
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  state = history.pop();
  render('Last local change undone.');
  if ($('undo').disabled) $('reset').focus();
});
$('reset').addEventListener('click', () => {
  state = initial();
  history = [];
  const t = totals(state);
  render(`Sample reset: ${t.count} of ${t.members} recorded.`);
});
render();

/* Navigation: mark the section in view as current (sidebar and mobile bottom bar).
   The current section is the lowest one whose top has passed 30% of the screen height; a click wins for a moment. */
const links = [...document.querySelectorAll('nav a[href^="#"]')];
const ids = links.map(a => a.getAttribute('href').slice(1));
let lockUntil = 0, ticking = false;
const setCurrent = id => links.forEach(a => a.getAttribute('href') === '#' + id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'));
function fromScroll() {
  ticking = false;
  if (Date.now() < lockUntil) { lockUntil = Math.max(lockUntil, Date.now() + 250); return; }
  const line = innerHeight * 0.3;
  let best = 'overview', bestTop = -Infinity;
  for (const id of ids) {
    const s = document.getElementById(id);
    if (!s) continue;
    const top = s.getBoundingClientRect().top;
    if (top <= line && top > bestTop) { best = id; bestTop = top; }
  }
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) best = ids[ids.length - 1];
  setCurrent(best);
}
links.forEach(a => a.addEventListener('click', () => { lockUntil = Date.now() + 1200; setCurrent(a.getAttribute('href').slice(1)); }));
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(fromScroll); } }, {passive: true});
if (location.hash && ids.includes(location.hash.slice(1))) setCurrent(location.hash.slice(1)); else fromScroll();
