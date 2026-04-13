import type { ClientStatus } from "@/types/client";

/**
 * SINGLE PLACE to add/rename standard client fields for forms, tables, and CSV targets.
 * After editing here, update `Client` in `@/types/client.ts` and Firestore security rules if needed.
 */
export type FieldType = "text" | "email" | "tel" | "textarea" | "number" | "select";

export type ClientFieldDefinition = {
  key: keyof import("@/types/client").Client;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Show in compact table columns (subset). */
  showInTable?: boolean;
  /** Show on map popup. */
  showOnMapPopup?: boolean;
  selectOptions?: { value: string; label: string }[];
};

export const CLIENT_STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "lead", label: "Lead" },
  { value: "unknown", label: "Unknown" },
];

/**
 * Standard editable fields (excludes id, timestamps, importSource, dedupeKey, isDeleted).
 * Extension: append new entries; keep `key` aligned with `Client` type.
 */
export const CLIENT_FORM_FIELDS: ClientFieldDefinition[] = [
  { key: "firstName", label: "First name", type: "text", showInTable: true, showOnMapPopup: true },
  { key: "lastName", label: "Last name", type: "text", showInTable: true, showOnMapPopup: true },
  { key: "fullName", label: "Full name", type: "text", showInTable: true, showOnMapPopup: true },
  { key: "email", label: "Email", type: "email", showInTable: true, showOnMapPopup: true },
  { key: "phone", label: "Phone", type: "tel", showInTable: true, showOnMapPopup: true },
  { key: "street", label: "Street", type: "text", showInTable: false },
  { key: "city", label: "City", type: "text", showInTable: true },
  { key: "state", label: "State", type: "text", showInTable: true },
  { key: "zip", label: "ZIP", type: "text", showInTable: true },
  { key: "fullAddress", label: "Full address", type: "textarea", showInTable: false },
  { key: "latitude", label: "Latitude", type: "number", placeholder: "e.g. 30.2672" },
  { key: "longitude", label: "Longitude", type: "number", placeholder: "e.g. -97.7431" },
  {
    key: "status",
    label: "Status",
    type: "select",
    showInTable: true,
    selectOptions: CLIENT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  },
  { key: "notes", label: "Notes", type: "textarea", showInTable: false },
];

/** Keys that can be CSV import targets (extension: add keys here when new first-class fields ship). */
export const CSV_MAPPABLE_STANDARD_KEYS = CLIENT_FORM_FIELDS.map(
  (f) => f.key
) as (keyof import("@/types/client").Client)[];

export const CSV_MAPPING_SKIP = "__skip__" as const;
export type CsvColumnMapping = Record<string, string | typeof CSV_MAPPING_SKIP>;
