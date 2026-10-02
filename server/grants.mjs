// Applying a paid purchase: what a wallet actually gets once its payment is confirmed.
//
// Kept out of server.mjs so the grant rules can be unit-tested without a chain or a wallet.
// A "single" invoice stores the film id; "pack" and "pass" store the product id. Anything that is
// not a known product id is treated as a film id, so invoices written before packs existed still
// work unchanged.

export const PASS_MS = 30 * 86_400_000;

const ignoreUnique = (fn) => {
  try {
    fn();
  } catch (e) {
    if (!String(e.message || '').includes('UNIQUE')) throw e;
  }
};

/**
 * Grant what was bought.
 *
 * @param {object} o
 * @param {object} o.q          prepared statements (insertUnlock, insertPass)
 * @param {Array}  o.catalog    current catalogue
 * @param {string} o.address    payer
 * @param {string} o.kind       'single' | 'pack' | 'pass'
 * @param {string} o.ref        film id (single) or product id
 * @param {string} o.txHash     lowercased tx hash
 * @param {string} o.amountAtomic what was actually paid
 * @param {number} o.blockNumber
 * @param {number} o.at         now (ms)
 * @param {number} o.passDays   pass length in days
 * @returns {{granted: string[], expiresAt: number|null}}
 */
export function applyPurchase({ q, catalog = [], address, kind, ref, txHash, amountAtomic, blockNumber = null, at = Date.now(), passDays = 30 }) {
  const granted = [];
  if (kind === 'pack') {
    for (const item of catalog) {
      ignoreUnique(() => q.insertUnlock.run(address, item.id, txHash, amountAtomic, blockNumber, at));
      granted.push(item.id);
    }
    return { granted, expiresAt: null };
  }
  if (kind === 'pass') {
    const expiresAt = at + passDays * 86_400_000;
    ignoreUnique(() => q.insertPass.run(address, 'pass', txHash, amountAtomic, at, expiresAt));
    return { granted: ['pass'], expiresAt };
  }
  ignoreUnique(() => q.insertUnlock.run(address, ref, txHash, amountAtomic, blockNumber, at));
  return { granted: [ref], expiresAt: null };
}

/** Everything a wallet can watch right now: rows it paid for, plus the whole room while a pass runs. */
export function effectiveUnlocked({ unlockRows = [], pass = null, catalog = [] }) {
  const set = new Set(unlockRows.map((r) => r.video_id));
  if (pass) for (const item of catalog) set.add(item.id);
  return [...set];
}

/** Normalise a pass row from sqlite into what the API and UI expect. An expired pass is null. */
export function shapePass(row, at = Date.now()) {
  if (!row) return null;
  const expiresAt = Number(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= at) return null; // never hand out a dead pass
  return {
    product: row.product,
    purchasedAt: Number(row.purchased_at),
    expiresAt,
    daysLeft: Math.max(0, Math.ceil((expiresAt - at) / 86_400_000)),
  };
}
