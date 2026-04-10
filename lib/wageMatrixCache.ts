/**
 * Wage Matrix Draft Cache
 *
 * Uses IndexedDB (via idb-keyval) instead of localStorage for draft persistence.
 *
 * Benefits over localStorage:
 *  - Async, non-blocking — no main-thread jank on large payloads
 *  - No 5 MB size cap
 *  - Scoped store name prevents key collisions with other modules
 */
import { createStore, get, set, del } from 'idb-keyval';

// Use a dedicated named store so we don't pollute the default idb-keyval DB
const wageMatrixStore = createStore('payroll-wage-matrix', 'drafts');

const DRAFT_KEY = 'active-draft';

export type WageMatrixDraft = Record<string, string>;

/**
 * Read the saved draft from IndexedDB.
 * Returns `null` if nothing has been saved yet.
 */
export async function getDraft(): Promise<WageMatrixDraft | null> {
  try {
    const value = await get<WageMatrixDraft>(DRAFT_KEY, wageMatrixStore);
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist the current draft to IndexedDB.
 * No-op if the draft is empty.
 */
export async function saveDraft(draft: WageMatrixDraft): Promise<void> {
  if (Object.keys(draft).length === 0) return;
  try {
    await set(DRAFT_KEY, draft, wageMatrixStore);
  } catch (err) {
    console.warn('[WageMatrixCache] Failed to save draft:', err);
  }
}

/**
 * Delete the saved draft from IndexedDB (call after a successful save-to-server).
 */
export async function clearDraft(): Promise<void> {
  try {
    await del(DRAFT_KEY, wageMatrixStore);
  } catch {
    // Silently ignore — the cache is non-critical
  }
}
