// Offline tests for the Circle history helpers and the 5-member local demo. No network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHistory, summarize, classify} from '../lib/history.mjs';

const P = 'FICTIONAL DEMO DATA — no real payment occurred. ';
const TEXTS = [
  P + 'Member Demo A recorded a simulated NGN 5,000 contribution for week 1 of a sample savings circle. For integration testing only. Test marker: AJORECALL-INTEGRATION-20261108-ONE-001',
  P + 'Member Demo B recorded a simulated NGN 5,000 contribution for week 1 of the sample savings circle. Test marker: AJORECALL-DEMO-20261109-002',
  P + 'Member Demo C recorded a simulated NGN 5,000 contribution for week 1 of the sample savings circle. Test marker: AJORECALL-DEMO-20261109-003',
  P + 'Member Demo D missed the week 1 contribution; the circle marked it as pending. Test marker: AJORECALL-DEMO-20261109-004',
  P + 'Member Demo E recorded a simulated NGN 5,000 contribution for week 1 of the sample savings circle. Test marker: AJORECALL-DEMO-20261109-005',
  P + 'Member Demo D paid the missed week 1 contribution of NGN 5,000 late, two days after the due date. Test marker: AJORECALL-DEMO-20261109-006',
  P + 'Week 1 is complete; the simulated pot of NGN 25,000 goes to Member Demo A, first in the payout order. Test marker: AJORECALL-DEMO-20261109-007',
  P + 'The circle agreed the payout order for the coming weeks: Demo B, then Demo C, Demo D, Demo E. Test marker: AJORECALL-DEMO-20261109-008',
  P + 'Member Demo A recorded a simulated NGN 5,000 contribution for week 2 of the sample savings circle. Test marker: AJORECALL-DEMO-20261109-009',
  P + 'Member Demo C asked to swap payout weeks with Demo D; the swap is pending group approval. Test marker: AJORECALL-DEMO-20261109-010',
];
const listed = TEXTS.map((_, i) => ({blob_id: 'blob' + i, status: 'active', created_at: new Date(Date.UTC(2026, 10, i ? 9 : 8, 9, i)).toISOString()}));
const recalled = TEXTS.map((text, i) => ({text, blob_id: 'blob' + i, distance: Math.random()})).sort((a, b) => a.distance - b.distance);

test('history: all 10 memories, oldest first, with the expected labels', () => {
  const h = buildHistory(listed, recalled);
  assert.equal(h.length, 10);
  assert.deepEqual(h.map(x => x.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(h.map(x => x.blobId), TEXTS.map((_, i) => 'blob' + i));
  assert.deepEqual(h.map(x => x.label), ['Contribution', 'Contribution', 'Contribution', 'Missed', 'Contribution', 'Late payment', 'Payout', 'Order agreed', 'Contribution', 'Swap request']);
});
test('history: skips unlisted, inactive, duplicate, unmarked or non-fictional memories', () => {
  const extra = [
    {text: TEXTS[1], blob_id: 'blob1'},                                   // duplicate
    {text: 'Real payment of NGN 5,000. Test marker: AJORECALL-DEMO-20261109-099', blob_id: 'x1'},
    {text: P + 'No marker here', blob_id: 'x2'},
    {text: P + 'Unlisted. Test marker: AJORECALL-DEMO-20261109-011', blob_id: 'x3'},
    {text: P + 'Inactive. Test marker: AJORECALL-DEMO-20261109-012', blob_id: 'x4'},
  ];
  const h = buildHistory([...listed, {blob_id: 'x1', status: 'active'}, {blob_id: 'x2', status: 'active'}, {blob_id: 'x4', status: 'deleted'}], [...recalled, ...extra]);
  assert.equal(h.length, 10);
});
test('history: empty or failed reads give an empty list, never sample data', () => {
  assert.deepEqual(buildHistory([], recalled), []);
  assert.deepEqual(buildHistory(undefined, undefined), []);
  assert.deepEqual(summarize([]), []);
});
test('summary is derived from the memory texts', () => {
  const s = summarize(buildHistory(listed, recalled));
  assert.deepEqual(s, [
    'Week 1: contributions recorded for 5 of 5 members.',
    'Demo D was late once (week 1).',
    'Week 1 pot of ₦25,000 went to Demo A.',
    'Week 2: contributions recorded for 1 of 5 members so far (Demo A).',
    'Next payout: Demo B. Agreed order: Demo B → Demo C → Demo D → Demo E.',
    'Pending: Demo C asked to swap payout weeks with Demo D.',
  ]);
  // Changing the memories changes the summary (nothing hardcoded).
  const alt = summarize([{text: P + 'Week 1 is complete; the simulated pot of NGN 30,000 goes to Member Demo B, first.'}, {text: P + 'The circle agreed the payout order for the coming weeks: Demo B, then Demo E. Test marker: X'}]);
  assert.ok(alt.includes('Week 1 pot of ₦30,000 went to Demo B.'));
  assert.ok(alt.includes('Next payout: Demo E. Agreed order: Demo B → Demo E.'));
});
test('fix 1: the next-payout line names each member once and reads cleanly with display names', async () => {
  await import('../public/state.js');
  const S = globalThis.DemoState;
  const line = summarize(buildHistory(listed, recalled)).find(f => f.startsWith('Next payout'));
  assert.equal(S.shortNames(line), 'Next payout: Tunde. Agreed order: Tunde → Ngozi → Emeka → Halima.');
  for (const f of summarize(buildHistory(listed, recalled)).map(S.shortNames)) {
    assert.doesNotMatch(f, /\(Demo|\)\s*\(|Demo [A-E]/, 'summary uses short display names only: ' + f);
    assert.doesNotMatch(f, /NGN/, 'summary uses the ₦ symbol: ' + f);
  }
});
test('fix 2: the display-names note appears exactly once in the page', async () => {
  const {readFile} = await import('node:fs/promises');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const live = await readFile(new URL('../public/live.js', import.meta.url), 'utf8');
  assert.equal((html.match(/fictional labels added on this page/g) || []).length, 1);
  assert.equal((live.match(/fictional labels|Display names/g) || []).length, 0);
});
test('page text: no leftover old names outside the namespace explanation, no missing spaces before line breaks', async () => {
  const {readFile} = await import('node:fs/promises');
  for (const f of ['index.html', 'app.js', 'state.js', 'live.js']) {
    const t = await readFile(new URL('../public/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(t.replace(/ajorecall-demo/g, ''), /AjoRecall|AjoVault|AJORECALL/i, f);
    assert.doesNotMatch(t, /[.!?]<br/, f + ': add a space before <br> so text does not run together when the break is hidden');
  }
});
test('classify falls back to a neutral label', () => assert.equal(classify(P + 'Something else.'), 'Memory'));

test('local demo: week 2 board mirrors the saved history (5 members, NGN 5,000 each, only Demo A recorded)', async () => {
  await import('../public/state.js');
  const S = globalThis.DemoState;
  assert.deepEqual(S.MEMBERS, ['A', 'B', 'C', 'D', 'E']);
  assert.equal(S.WEEK, 2);
  const s0 = S.initial();
  assert.deepEqual(s0, [true, false, false, false, false]);
  assert.deepEqual(S.totals(s0), {count: 1, members: 5, total: 5000, goal: 25000, percent: 20});
  let s = s0;
  const pct = [];
  for (const i of [1, 2, 3, 4]) { s = S.record(s, i); pct.push(S.totals(s).percent); }
  assert.deepEqual(pct, [40, 60, 80, 100]);
  assert.deepEqual(S.totals(s), {count: 5, members: 5, total: 25000, goal: 25000, percent: 100});
  assert.deepEqual(S.record(s, 0), s, 'recording an already recorded member changes nothing');
  assert.deepEqual(s0, [true, false, false, false, false], 'record() must not mutate (undo relies on it)');
  assert.equal(S.reminder(s0), 'Suggested reminder: “Emeka, your week 2 sample contribution is still outstanding.”');
  assert.equal(S.reminder(S.record(s0, 3)), 'Tunde, Ngozi and Halima are still outstanding. No late-history reminder applies.');
  assert.equal(S.reminder(S.record(S.record(S.record(s0, 3), 1), 2)), 'Halima is still outstanding. No late-history reminder applies.');
  assert.match(S.reminder(S.record(s0, 1)), /^Suggested reminder: “Emeka/);
  assert.match(S.reminder(s), /Everyone has a sample contribution/);
  assert.deepEqual(S.NAMES, {A:'Amaka',B:'Tunde',C:'Ngozi',D:'Emeka',E:'Halima'});
  assert.equal(S.display('A'), 'Amaka (Demo A)');
  assert.equal(S.initialLetter('B'), 'T');
  assert.equal(S.withNames('Member Demo A recorded; Demo B next.'), 'Amaka (Demo A) recorded; Tunde (Demo B) next.');
  assert.equal(S.shortNames('Demo D was late once (week 1).'), 'Emeka was late once (week 1).');
});
