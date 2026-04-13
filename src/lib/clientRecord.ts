import {
  serverTimestamp,
  type Timestamp,
  type DocumentData,
} from "firebase/firestore";
import type { Client, ClientInput, ClientImportSource } from "@/types/client";
import { buildFullAddress } from "@/lib/address";
import { CLIENT_STATUS_OPTIONS } from "@/lib/fieldConfig";

/** Simple string hash for fallback dedupe keys (non-cryptographic). */
function hashString(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Dedupe strategy: prefer email, then name+zip, name+phone, name only, else content hash.
 * Tune here as your data quality patterns emerge.
 */
export function computeDedupeKey(row: Record<string, unknown>): string {
  const email = norm(String(row.email ?? ""));
  const first = norm(String(row.firstName ?? ""));
  const last = norm(String(row.lastName ?? ""));
  const fullName = norm(String(row.fullName ?? "")) || [first, last].filter(Boolean).join(" ");
  const phone = norm(String(row.phone ?? "")).replace(/\D/g, "");
  const zip = norm(String(row.zip ?? ""));

  if (email) return `email:${email}`;
  if (fullName && zip) return `namezip:${fullName}|${zip}`;
  if (fullName && phone) return `namephone:${fullName}|${phone}`;
  if (fullName) return `name:${fullName}`;
  return `row:${hashString(JSON.stringify(row))}`;
}

export function mergeRowIntoClientFields(
  row: Record<string, string | undefined>,
  customFromUnmapped: Record<string, string>
): Partial<ClientInput> {
  const out: Record<string, unknown> = { ...row };
  if (Object.keys(customFromUnmapped).length) {
    out.customFields = {
      ...(typeof out.customFields === "object" && out.customFields !== null
        ? (out.customFields as Record<string, unknown>)
        : {}),
      ...customFromUnmapped,
    };
  }
  const fullAddress =
    (out.fullAddress as string | undefined)?.trim() ||
    buildFullAddress({
      street: out.street as string | undefined,
      city: out.city as string | undefined,
      state: out.state as string | undefined,
      zip: out.zip as string | undefined,
    });
  if (fullAddress) out.fullAddress = fullAddress;

  const fn = (out.firstName as string | undefined)?.trim();
  const ln = (out.lastName as string | undefined)?.trim();
  const existingFull = (out.fullName as string | undefined)?.trim();
  if (!existingFull && (fn || ln)) {
    out.fullName = [fn, ln].filter(Boolean).join(" ");
  }

  return out as Partial<ClientInput>;
}

export function newClientDefaults(partial: Partial<ClientInput>): ClientInput {
  const allowedStatus = new Set(CLIENT_STATUS_OPTIONS.map((o) => o.value));
  const status =
    partial.status && allowedStatus.has(partial.status) ? partial.status : "unknown";

  return {
    firstName: partial.firstName,
    lastName: partial.lastName,
    fullName: partial.fullName,
    email: partial.email,
    phone: partial.phone,
    street: partial.street,
    city: partial.city,
    state: partial.state,
    zip: partial.zip,
    fullAddress: partial.fullAddress,
    latitude: partial.latitude,
    longitude: partial.longitude,
    notes: partial.notes,
    status,
    customFields:
      partial.customFields && typeof partial.customFields === "object"
        ? { ...partial.customFields }
        : {},
    isDeleted: false,
    importSource: partial.importSource,
  };
}

/** Firestore write payload with server timestamps for create/update. */
export function toFirestoreCreatePayload(
  input: ClientInput,
  dedupeKey: string,
  importSource?: ClientImportSource
): DocumentData {
  const now = serverTimestamp();
  return {
    ...stripUndefined({
      ...input,
      importSource: importSource ?? input.importSource,
      dedupeKey,
    }),
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function toFirestoreUpdatePayload(patch: Partial<ClientInput>): DocumentData {
  return {
    ...stripUndefined(patch),
    updatedAt: serverTimestamp(),
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) o[k] = v;
  }
  return o;
}

export function clientFromFirestore(id: string, data: DocumentData): Client {
  return {
    id,
    ...(data as Omit<Client, "id">),
  };
}

/** Strip server-only / identity fields for edit forms. */
export function clientToFormInput(c: Client): ClientInput {
  const { id, createdAt, updatedAt, dedupeKey, ...rest } = c;
  void id;
  void createdAt;
  void updatedAt;
  void dedupeKey;
  return rest as ClientInput;
}

export function clientHasCoordinates(c: Pick<Client, "latitude" | "longitude">): boolean {
  return (
    typeof c.latitude === "number" &&
    typeof c.longitude === "number" &&
    !Number.isNaN(c.latitude) &&
    !Number.isNaN(c.longitude)
  );
}

export function toDate(value: Timestamp | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  // Firestore Timestamp
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
}
