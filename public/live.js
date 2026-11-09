/* Read-only live panel and Circle history. Renders server data with textContent only (no HTML from the network). */
const status = document.getElementById('live-status'), badges = document.getElementById('live-badges'), detail = document.getElementById('memory-detail');
const checks = [['Walrus auth', 'walrusAuthenticated'], ['Tatum read', 'tatumAuthenticated'], ['Mainnet account', 'accountMatches'], ['Account active', 'accountActive'], ['Delegate match', 'delegateMatches']];
const NAMESPACE = 'ajorecall-demo';
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* data undefined: still checking; data null: request failed; object: show each check. */
function showChecks(data) {
  badges.replaceChildren();
  for (const [label, key] of checks) {
    const value = data?.[key];
    const state = value === true ? 'pass' : value === false ? 'fail' : 'pending';
    const word = value === true ? 'verified' : value === false ? 'not verified' : data === undefined ? 'checking' : 'unavailable';
    badges.append(el('span', 'read-badge ' + state, label + ': ' + word));
  }
}
showChecks();

const LABELS = {'Contribution': '', 'Missed': 'missed', 'Late payment': 'late', 'Payout': 'payout', 'Order agreed': 'order', 'Swap request': 'swap', 'Memory': ''};
const shortId = id => id.length > 18 ? id.slice(0, 10) + '…' + id.slice(-6) : id;
const longNames = text => (typeof DemoState !== 'undefined' && DemoState.withNames) ? DemoState.withNames(text) : String(text);
const shortNames = text => (typeof DemoState !== 'undefined' && DemoState.shortNames) ? DemoState.shortNames(text) : String(text);

function showHistory(d) {
  const list = document.getElementById('history-list'), sum = document.getElementById('history-summary'), sumList = document.getElementById('summary-list'), hs = document.getElementById('history-status');
  list.replaceChildren(); sumList.replaceChildren(); list.hidden = true; sum.hidden = true;
  const items = d && d.historyAvailable === true && Array.isArray(d.history)
    ? d.history.filter(x => x && typeof x.text === 'string' && typeof x.label === 'string' && typeof x.blobId === 'string').slice(0, 50) : [];
  if (!items.length) { hs.textContent = 'Circle history is unavailable right now, so nothing is shown (no made-up data). Please check again in a few minutes.'; return; }
  for (const x of items) {
    const li = el('li');
    const shown = longNames(x.text.replace(/^FICTIONAL DEMO DATA — no real payment occurred\.\s*/, '').replace(/\s*Test marker: \S+$/, ''));
    li.append(el('span', 'h-n', String(x.n)), el('span', 'h-label ' + (LABELS[x.label] ?? ''), x.label), el('span', 'h-text', shown), el('span', 'h-meta', 'Walrus blob ' + shortId(x.blobId)));
    list.append(li);
  }
  list.hidden = false;
  const facts = Array.isArray(d.derivedSummary) ? d.derivedSummary.filter(f => typeof f === 'string').slice(0, 10) : [];
  for (const f of facts) sumList.append(el('li', null, shortNames(f)));
  sum.hidden = !facts.length;
  hs.textContent = items.length + ' fictional memories read from Walrus Mainnet, oldest first'
    + (typeof d.listedCount === 'number' ? ' (' + d.listedCount + ' active in the namespace)' : '')
    + '. The “FICTIONAL DEMO DATA” prefix and test markers are hidden to keep the list readable.';
}

async function check() {
  detail.hidden = true;
  try {
    const r = await fetch('/api/status', {headers: {Accept: 'application/json'}});
    if (!r.ok) throw new Error('status ' + r.status);
    const d = await r.json();
    showChecks(d);
    const verified = d.walrusAuthenticated && d.tatumAuthenticated && d.accountMatches && d.accountActive && d.delegateMatches && d.quarantined === false;
    status.textContent = verified
      ? 'Connection verified · ' + (d.sampleRetrieved ? 'Existing sample memory retrieved.' : 'Sample retrieval not confirmed.')
      : 'Some connection checks need attention. No write attempted.';
    document.getElementById('live-evidence').textContent = d.sampleRetrieved
      ? 'The first approved fictional test memory was retrieved word for word (shown below).'
      : 'The first approved fictional test memory was not confirmed this time.';
    if (d.sampleRetrieved === true && typeof d.sample?.text === 'string' && typeof d.sample?.blobId === 'string' && d.namespace === NAMESPACE) {
      document.getElementById('memory-text').textContent = d.sample.text;
      document.getElementById('memory-meta').textContent = 'Namespace: ' + d.namespace + ' (earlier working name) · Walrus blob ' + shortId(d.sample.blobId) + ' · Read-only retrieval';
      detail.hidden = false;
    }
    showHistory(d);
  } catch {
    showHistory(null);
    status.textContent = 'Connection check unavailable. Your local sample still works.';
    showChecks(null);
    document.getElementById('live-evidence').textContent = 'Live results could not be loaded. No new memory was saved.';
  }
}
check();
