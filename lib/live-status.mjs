// ThriftRecall read-only live check.
// Reads (never writes) Walrus Memory on Mainnet and the MemWal account object on Sui Mainnet via Tatum gRPC.
// Secrets come only from server-side environment variables and are never returned or logged.
import {MemWal} from '@mysten-incubation/memwal';
import {SuiGrpcClient} from '@mysten/sui/grpc';
import {GrpcTransport} from '@protobuf-ts/grpc-transport';
import {credentials} from '@grpc/grpc-js';
import {buildHistory, summarize, MAX_HISTORY} from './history.mjs';

// Public, non-secret identifiers. The namespace keeps its original name because the 10 Mainnet memories live there.
export const ACCOUNT_ID = '0x3f85f006d3ba9f234b16926404e4acf0feff5ec8252c32e7211a9934e0c30112';
export const NAMESPACE = 'ajorecall-demo';
const ACCOUNT_TYPE = '0xe7c16fbea0560e7057e2bf7422feaa4fb313749fc69c9e9092fac7a33b81d7f5::account::MemWalAccount';
const RELAYER_URL = 'https://relayer.memory.walrus.xyz';
const TATUM_SUI_GRPC_HOST = 'sui-mainnet-grpc.gateway.tatum.io:443';
const MARKER = 'AJORECALL-INTEGRATION-20261108-ONE-001';
const SAMPLE = 'FICTIONAL DEMO DATA — no real payment occurred. Member Demo A recorded a simulated NGN 5,000 contribution for week 1 of a sample savings circle. For integration testing only. Test marker: ' + MARKER;
export const CACHE_TTL_MS = 300000; // 5 minutes
const HISTORY_QUERY = 'FICTIONAL DEMO DATA sample savings circle Demo member contribution payout';
const MAX_LIST_PAGES = 3; // listMemories pages of up to 500; the demo namespace holds 10

let clients;
function getClients() {
  if (clients) return clients;
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const tatumKey = process.env.TATUM_API_KEY;
  if (!key || !tatumKey) throw new Error('Server is missing required environment variables.');
  const memwal = MemWal.create({key, accountId: ACCOUNT_ID, namespace: NAMESPACE, serverUrl: RELAYER_URL, preflightTimeoutMs: 15000, recallTimeoutMs: 20000});
  const transport = new GrpcTransport({host: TATUM_SUI_GRPC_HOST, channelCredentials: credentials.createSsl(), meta: {'x-api-key': tatumKey}, timeout: 15000});
  const sui = new SuiGrpcClient({network: 'mainnet', transport});
  clients = {memwal, sui};
  return clients;
}

// Converts a protobuf Struct/Value (returned by Sui gRPC "json" read mask) into plain JS.
function unpack(value) {
  const kind = value?.kind;
  if (!kind) return null;
  if (kind.oneofKind === 'structValue') return Object.fromEntries(Object.entries(kind.structValue.fields).map(([name, v]) => [name, unpack(v)]));
  if (kind.oneofKind === 'listValue') return kind.listValue.values.map(unpack);
  return kind[kind.oneofKind];
}

function keyHex(value) {
  if (Array.isArray(value)) return Buffer.from(value.map(Number)).toString('hex');
  if (typeof value === 'string') return /^(0x)?[0-9a-f]+$/i.test(value) ? value.replace(/^0x/, '').toLowerCase() : Buffer.from(value, 'base64').toString('hex');
  return '';
}

// One in-flight load at a time, result reused for ttl ms (per warm server instance).
export function createCached(loader, ttl = CACHE_TTL_MS) {
  let result, until = 0, pending;
  return async () => {
    if (Date.now() < until) return result;
    if (pending) return pending;
    pending = (async () => {
      try { result = await loader(); until = Date.now() + ttl; return result; }
      finally { pending = null; }
    })();
    return pending;
  };
}

async function liveRead() {
  const {memwal, sui} = getClients();
  const result = {app: 'ThriftRecall', namespace: NAMESPACE, writesEnabled: false, contributionsSynced: false, checkedAt: new Date().toISOString()};
  // Walrus read 1: listMemories (metadata only) — authoritative inventory, also proves the delegate key authenticates.
  let listed = [];
  try {
    let cursor, pages = 0, more = true;
    while (more && pages < MAX_LIST_PAGES) {
      const page = await memwal.listMemories({cursor, namespace: NAMESPACE, limit: 500});
      listed.push(...page.memories); cursor = page.next_cursor ?? undefined; more = page.has_more && !!cursor; pages++;
    }
    result.walrusAuthenticated = true;
  } catch { result.walrusAuthenticated = false; }
  try {
    const {response} = await sui.ledgerService.getObject({objectId: ACCOUNT_ID, readMask: {paths: ['object_id', 'object_type', 'json']}});
    const object = response.object, fields = unpack(object?.json);
    const publicKey = (await memwal.getPublicKeyHex()).replace(/^0x/, '').toLowerCase();
    result.tatumAuthenticated = !!object;
    result.accountMatches = object?.objectId === ACCOUNT_ID && object?.objectType === ACCOUNT_TYPE;
    result.accountActive = fields?.active === true;
    result.quarantined = fields?.admin_quarantined === true;
    result.delegateMatches = (fields?.delegate_keys || []).some(k => keyHex(k.public_key) === publicKey);
  } catch { result.tatumAuthenticated = false; result.accountMatches = false; result.delegateMatches = false; }
  result.historyAvailable = false;
  if (result.walrusAuthenticated) {
    // Walrus read 2: one recall returns the texts for both the sample check and the circle history.
    try {
      const hits = await memwal.recall({query: HISTORY_QUERY, limit: MAX_HISTORY, namespace: NAMESPACE});
      const exact = hits.results.find(x => x.text === SAMPLE);
      result.sampleRetrieved = !!exact;
      if (exact) result.sample = {text: SAMPLE, blobId: exact.blob_id};
      const history = buildHistory(listed, hits.results);
      result.listedCount = listed.filter(m => m.status === 'active').length;
      result.history = history;
      result.historyAvailable = history.length > 0;
      result.derivedSummary = summarize(history);
    } catch { result.sampleRetrieved = false; }
  }
  return result;
}

export const getStatus = createCached(liveRead);
