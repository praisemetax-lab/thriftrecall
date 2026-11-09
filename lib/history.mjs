// Pure helpers for the read-only "Circle history" panel. No network, no secrets.
// They turn raw Walrus Memory reads (listMemories + recall) into a safe, ordered, labelled list,
// and derive a small summary from the memory texts only (nothing hardcoded about members or payouts).

export const MAX_HISTORY = 50;
const PREFIX = 'FICTIONAL DEMO DATA';
const MARKER = /Test marker: (AJORECALL-(?:INTEGRATION|DEMO)-\d{8}-[A-Z0-9-]{1,20})\s*$/;
const SEQ = /-(\d{3})$/;

// Order matters: e.g. a late payment mentions "missed", and a payout mentions "payout order".
export function classify(text) {
  if (/\bswap\b/i.test(text)) return 'Swap request';
  if (/agreed the payout order/i.test(text)) return 'Order agreed';
  if (/\bpot of NGN [\d,]+ goes to\b/i.test(text)) return 'Payout';
  if (/\bpaid the missed\b.*\blate\b/i.test(text)) return 'Late payment';
  if (/\bmissed\b/i.test(text)) return 'Missed';
  if (/recorded a simulated NGN [\d,]+ contribution/i.test(text)) return 'Contribution';
  return 'Memory';
}

/**
 * listed: MemorySummary[] from listMemories (authoritative inventory: blob_id, created_at, status).
 * recalled: RecallMemory[] from recall (text + blob_id).
 * Only active, listed memories whose text is marked fictional and ends with a project test marker are shown.
 */
export function buildHistory(listed, recalled) {
  const byBlob = new Map();
  for (const m of listed || []) if (m && typeof m.blob_id === 'string' && m.status === 'active') byBlob.set(m.blob_id, m);
  const seen = new Set(), items = [];
  for (const r of recalled || []) {
    if (!r || typeof r.text !== 'string' || typeof r.blob_id !== 'string' || seen.has(r.blob_id)) continue;
    const listedRow = byBlob.get(r.blob_id);
    const marker = r.text.match(MARKER)?.[1];
    if (!listedRow || !marker || !r.text.startsWith(PREFIX) || r.text.length > 1000) continue;
    seen.add(r.blob_id);
    items.push({label: classify(r.text), text: r.text, marker, blobId: r.blob_id, createdAt: listedRow.created_at || r.created_at || null});
  }
  const seq = m => Number(m.match(SEQ)?.[1] ?? 999);
  items.sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || seq(a.marker) - seq(b.marker));
  return items.slice(0, MAX_HISTORY).map((item, i) => ({n: i + 1, ...item}));
}

const naira = n => '₦' + n.toLocaleString('en-US');
const demoList = codes => codes.map(x => 'Demo ' + x).join(', ');

/**
 * Derives plain-language facts from the history texts. Returns [] when nothing can be derived.
 * Members are named "Demo X" here (as in the saved memories); the page maps them to display names.
 */
export function summarize(history) {
  const members = new Set(), paidByWeek = new Map(), late = new Map(), payouts = [], swaps = [];
  // late: member -> list of weeks paid late
  let order = null;
  const add = (week, who) => { if (!paidByWeek.has(week)) paidByWeek.set(week, new Set()); paidByWeek.get(week).add(who); };
  for (const {text} of history || []) {
    for (const m of text.matchAll(/\bDemo ([A-Z])\b/g)) members.add(m[1]);
    let m;
    if ((m = text.match(/Member Demo ([A-Z]) recorded a simulated NGN [\d,]+ contribution for week (\d+)/))) add(Number(m[2]), m[1]);
    if ((m = text.match(/Member Demo ([A-Z]) paid the missed week (\d+) contribution of NGN [\d,]+ late/))) { add(Number(m[2]), m[1]); late.set(m[1], [...(late.get(m[1]) || []), Number(m[2])]); }
    if ((m = text.match(/Week (\d+) is complete; the simulated pot of NGN ([\d,]+) goes to Member Demo ([A-Z])/))) payouts.push({week: Number(m[1]), amount: Number(m[2].replace(/,/g, '')), who: m[3]});
    if ((m = text.match(/agreed the payout order for the coming weeks: ((?:Demo [A-Z](?:, then |, |$|\. | Test))+)/))) order = [...m[1].matchAll(/Demo ([A-Z])/g)].map(x => x[1]);
    if ((m = text.match(/Member Demo ([A-Z]) asked to swap payout weeks with Demo ([A-Z]); the swap is pending/))) swaps.push([m[1], m[2]]);
  }
  const facts = [];
  const total = members.size;
  const completed = new Set(payouts.map(p => p.week));
  for (const [week, who] of [...paidByWeek].sort((a, b) => a[0] - b[0])) {
    const sorted = [...who].sort();
    const open = who.size < total && !completed.has(week);
    facts.push(`Week ${week}: contributions recorded for ${who.size} of ${total} members${open ? ` so far (${demoList(sorted)})` : ''}.`);
    for (const [m, weeks] of late) if (weeks.includes(week) && weeks[0] === week) facts.push(`Demo ${m} was late ${weeks.length === 1 ? 'once' : weeks.length + ' times'} (week ${weeks.join(', ')}).`);
    for (const p of payouts) if (p.week === week) facts.push(`Week ${p.week} pot of ${naira(p.amount)} went to Demo ${p.who}.`);
  }
  for (const [m, weeks] of late) if (!paidByWeek.has(weeks[0])) facts.push(`Demo ${m} was late ${weeks.length === 1 ? 'once' : weeks.length + ' times'} (week ${weeks.join(', ')}).`);
  for (const p of payouts) if (!paidByWeek.has(p.week)) facts.push(`Week ${p.week} pot of ${naira(p.amount)} went to Demo ${p.who}.`);
  if (order) {
    const paid = new Set(payouts.map(p => p.who));
    const next = order.find(x => !paid.has(x));
    if (next) facts.push(`Next payout: Demo ${next}. Agreed order: ${order.map(x => 'Demo ' + x).join(' → ')}.`);
  }
  for (const [a, b] of swaps) facts.push(`Pending: Demo ${a} asked to swap payout weeks with Demo ${b}.`);
  return facts;
}
