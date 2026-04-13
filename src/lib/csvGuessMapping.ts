import type { CsvColumnMapping } from "@/lib/fieldConfig";
import { CSV_MAPPABLE_STANDARD_KEYS, CSV_MAPPING_SKIP } from "@/lib/fieldConfig";
import type { Client } from "@/types/client";

const NORMALIZE = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Map common CSV header variants to Client keys — extend as you see real files. */
const HEADER_SYNONYMS: Record<string, keyof Client> = {
  fname: "firstName",
  first: "firstName",
  firstname: "firstName",
  lname: "lastName",
  last: "lastName",
  lastname: "lastName",
  name: "fullName",
  fullname: "fullName",
  clientname: "fullName",
  mail: "email",
  emailaddress: "email",
  mobile: "phone",
  tel: "phone",
  telephone: "phone",
  phone1: "phone",
  address: "fullAddress",
  address1: "street",
  streetaddress: "street",
  addr: "street",
  zipcode: "zip",
  postal: "zip",
  postcode: "zip",
  stateprovince: "state",
  st: "state",
  lat: "latitude",
  latitude: "latitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  longitude: "longitude",
};

/**
 * Best-effort column → field mapping for messy CSVs.
 * Unknown columns default to skip (map manually in UI).
 */
export function guessCsvMapping(headers: string[]): CsvColumnMapping {
  const mapping: CsvColumnMapping = {};
  const keySet = new Set(CSV_MAPPABLE_STANDARD_KEYS.map((k) => NORMALIZE(String(k))));

  for (const raw of headers) {
    const n = NORMALIZE(raw);
    if (!n) {
      mapping[raw] = CSV_MAPPING_SKIP;
      continue;
    }
    if (HEADER_SYNONYMS[n]) {
      mapping[raw] = HEADER_SYNONYMS[n] as string;
      continue;
    }
    if (keySet.has(n)) {
      const found = CSV_MAPPABLE_STANDARD_KEYS.find((k) => NORMALIZE(String(k)) === n);
      mapping[raw] = (found as string) ?? CSV_MAPPING_SKIP;
      continue;
    }
    mapping[raw] = CSV_MAPPING_SKIP;
  }
  return mapping;
}
