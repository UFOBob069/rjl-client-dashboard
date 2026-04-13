import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/clientApp";
import type { Client, ClientInput } from "@/types/client";
import { clientFromFirestore, toFirestoreCreatePayload, toFirestoreUpdatePayload } from "@/lib/clientRecord";

export const CLIENTS_COLLECTION = "clients";
export const IMPORT_LOGS_COLLECTION = "importLogs";

/** Firestore hard cap for `limit()` on structured queries (see Firestore docs). */
export const FIRESTORE_MAX_QUERY_LIMIT = 10_000;

function clampQueryLimit(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), FIRESTORE_MAX_QUERY_LIMIT);
}

/**
 * Lists clients for table/map. Filters `isDeleted` in memory to avoid a composite Firestore index
 * (`isDeleted` + `updatedAt`). For very large collections, add an index and use `where` + `orderBy`.
 *
 * `max` is clamped to {@link FIRESTORE_MAX_QUERY_LIMIT}; use pagination/cursors when you exceed that.
 */
export async function listActiveClients(max = FIRESTORE_MAX_QUERY_LIMIT): Promise<Client[]> {
  const db = getDb();
  const capped = clampQueryLimit(max);
  const q = query(
    collection(db, CLIENTS_COLLECTION),
    orderBy("updatedAt", "desc"),
    limit(capped)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => clientFromFirestore(d.id, d.data() as DocumentData))
    .filter((c) => !c.isDeleted);
}

/** Load existing dedupe keys to skip duplicates during import (MVP: scan recent docs up to limit). */
export async function fetchExistingDedupeKeys(maxDocs = FIRESTORE_MAX_QUERY_LIMIT): Promise<Set<string>> {
  const db = getDb();
  const capped = clampQueryLimit(maxDocs);
  const q = query(collection(db, CLIENTS_COLLECTION), orderBy("updatedAt", "desc"), limit(capped));
  const snap = await getDocs(q);
  const set = new Set<string>();
  snap.forEach((d) => {
    const data = d.data();
    if (data.isDeleted) return;
    const k = data.dedupeKey as string | undefined;
    if (k) set.add(k);
  });
  return set;
}

export async function getClient(id: string): Promise<Client | null> {
  const db = getDb();
  const ref = doc(db, CLIENTS_COLLECTION, id);
  const s = await getDoc(ref);
  if (!s.exists()) return null;
  return clientFromFirestore(s.id, s.data() as DocumentData);
}

export async function createClient(
  input: ClientInput,
  dedupeKey: string
): Promise<string> {
  const db = getDb();
  const payload = toFirestoreCreatePayload(input, dedupeKey, input.importSource);
  const ref = await addDoc(collection(db, CLIENTS_COLLECTION), payload);
  return ref.id;
}

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<void> {
  const db = getDb();
  const ref = doc(db, CLIENTS_COLLECTION, id);
  await updateDoc(ref, toFirestoreUpdatePayload(patch));
}

export async function softDeleteClient(id: string): Promise<void> {
  await updateClient(id, { isDeleted: true });
}

/** Permanent delete — use rarely; prefer softDeleteClient. */
export async function hardDeleteClient(id: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, CLIENTS_COLLECTION, id));
}

const BATCH_SIZE = 450;

export type BatchImportResult = {
  success: number;
  skippedDuplicate: number;
  failed: number;
};

/**
 * Writes many new client docs in batches. Skips rows whose dedupeKey exists in `existingKeys`
 * or was already seen in this import run.
 */
export async function batchImportClients(
  items: Array<{ input: ClientInput; dedupeKey: string }>,
  existingKeys: Set<string>,
  buildPayload: (input: ClientInput, dedupeKey: string) => DocumentData
): Promise<BatchImportResult> {
  const db = getDb();
  let success = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  const seen = new Set<string>();

  const pending: Array<{ input: ClientInput; dedupeKey: string }> = [];
  for (const item of items) {
    if (existingKeys.has(item.dedupeKey) || seen.has(item.dedupeKey)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(item.dedupeKey);
    pending.push(item);
  }

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    try {
      for (const { input, dedupeKey } of chunk) {
        const ref = doc(collection(db, CLIENTS_COLLECTION));
        batch.set(ref, buildPayload(input, dedupeKey));
      }
      await batch.commit();
      success += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }

  return { success, skippedDuplicate, failed };
}

export async function logImport(entry: {
  filename: string;
  successCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  geocodedCount: number;
  importBatchId: string;
  userEmail?: string;
}): Promise<void> {
  const db = getDb();
  await addDoc(collection(db, IMPORT_LOGS_COLLECTION), {
    ...entry,
    importedAt: new Date(),
  });
}

export async function listRecentImportLogs(max = 20) {
  const db = getDb();
  const capped = clampQueryLimit(max);
  const q = query(collection(db, IMPORT_LOGS_COLLECTION), orderBy("importedAt", "desc"), limit(capped));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      filename: data.filename as string,
      importedAt: (data.importedAt?.toDate?.() ?? new Date()) as Date,
      successCount: data.successCount as number,
      skippedDuplicateCount: data.skippedDuplicateCount as number,
      failedCount: data.failedCount as number,
      geocodedCount: data.geocodedCount as number,
      importBatchId: data.importBatchId as string,
      userEmail: data.userEmail as string | undefined,
    };
  });
}
