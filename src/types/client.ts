import type { Timestamp } from "firebase/firestore";

/**
 * Client status — extend union + fieldConfig when you add workflow states.
 */
export type ClientStatus = "active" | "inactive" | "lead" | "unknown";

/**
 * Firestore document shape for `clients/{id}`.
 * Extension point: add optional top-level fields here and in `fieldConfig.ts` together.
 */
export type Client = {
  id: string;

  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;

  notes?: string;
  status: ClientStatus;

  /** Arbitrary key/value data for fields not yet first-class in the UI. */
  customFields: Record<string, unknown>;

  isDeleted: boolean;

  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;

  /** Provenance from CSV (or manual). */
  importSource?: ClientImportSource;

  /**
   * Stable key for duplicate detection across imports.
   * See `computeDedupeKey` in `@/lib/clientRecord`.
   */
  dedupeKey?: string;
};

export type ClientImportSource = {
  filename: string;
  importedAt: Timestamp | Date;
  /** Correlate rows from one import run / batch. */
  importBatchId?: string;
};

/** Payload for creates/updates from forms (no id / timestamps). */
export type ClientInput = Omit<
  Client,
  "id" | "createdAt" | "updatedAt" | "importSource" | "dedupeKey"
> & {
  importSource?: ClientImportSource;
};

export type ImportLogEntry = {
  id: string;
  filename: string;
  importedAt: Date;
  successCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  geocodedCount: number;
  importBatchId: string;
  userEmail?: string;
};
