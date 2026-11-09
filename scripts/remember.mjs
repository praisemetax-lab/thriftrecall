// Saves ONE fictional memory to Walrus Memory on Mainnet. Run locally only; never deployed as a route.
// Usage: node scripts/remember.mjs --approve-mainnet-write "FICTIONAL DEMO DATA — no real payment occurred. ..."
// Needs MEMWAL_PRIVATE_KEY in the environment. Refuses duplicates and anything not marked as fictional.
import {MemWal} from '@mysten-incubation/memwal';
import {ACCOUNT_ID, NAMESPACE} from '../lib/live-status.mjs';

const [flag, text] = process.argv.slice(2);
if (flag !== '--approve-mainnet-write' || typeof text !== 'string') { console.error('Refusing: pass --approve-mainnet-write and the memory text.'); process.exit(1); }
if (!text.startsWith('FICTIONAL DEMO DATA') || text.length > 1000) { console.error('Refusing: text must start with "FICTIONAL DEMO DATA" and be at most 1000 characters.'); process.exit(1); }
if (!process.env.MEMWAL_PRIVATE_KEY) { console.error('Refusing: MEMWAL_PRIVATE_KEY is not set.'); process.exit(1); }

const memwal = MemWal.create({key: process.env.MEMWAL_PRIVATE_KEY, accountId: ACCOUNT_ID, namespace: NAMESPACE, serverUrl: 'https://relayer.memory.walrus.xyz', requestTimeoutMs: 30000, preflightTimeoutMs: 15000});
const existing = await memwal.recall({query: text, limit: 20, namespace: NAMESPACE});
if (existing.results.some(r => r.text === text)) { console.error('Refusing: this exact memory already exists.'); process.exit(1); }

const job = await memwal.remember(text);
const done = await memwal.waitForRememberJob(job.job_id, {timeoutMs: 180000});
const check = await memwal.recall({query: text, limit: 20, namespace: NAMESPACE});
const hit = check.results.find(r => r.text === text);
console.log(JSON.stringify({jobId: job.job_id, status: done.status, blobId: done.blob_id, recalledExactly: !!hit && hit.blob_id === done.blob_id}));
