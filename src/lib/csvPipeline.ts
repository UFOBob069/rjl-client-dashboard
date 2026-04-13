import type { ClientImportSource, ClientInput } from "@/types/client";
import type { CsvColumnMapping } from "@/lib/fieldConfig";
import { CSV_MAPPING_SKIP } from "@/lib/fieldConfig";
import {
  computeDedupeKey,
  mergeRowIntoClientFields,
  newClientDefaults,
} from "@/lib/clientRecord";
import { addressForGeocode } from "@/lib/address";
import { geocodeAddress, mapPool } from "@/lib/geocode";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

/**
 * Apply user column mapping: standard fields + unmapped columns -> customFields (optional).
 */
export function buildRowFromMapping(
  rawRow: Record<string, string>,
  mapping: CsvColumnMapping,
  unmappedToCustom: boolean
): { standard: Record<string, string | undefined>; custom: Record<string, string> } {
  const standard: Record<string, string | undefined> = {};
  const custom: Record<string, string> = {};

  for (const header of Object.keys(rawRow)) {
    const target = mapping[header];
    if (!target || target === CSV_MAPPING_SKIP) {
      if (unmappedToCustom) {
        const v = (rawRow[header] ?? "").trim();
        if (v) custom[header] = v;
      }
      continue;
    }
    const val = (rawRow[header] ?? "").trim();
    if (val === "") continue;
    (standard as Record<string, string>)[target] = val;
  }

  return { standard, custom };
}

function parseCoordinatePair(lat?: string, lng?: string): { lat?: number; lng?: number } {
  const la = lat?.trim() ? Number(lat) : undefined;
  const lo = lng?.trim() ? Number(lng) : undefined;
  return {
    lat: la !== undefined && Number.isFinite(la) ? la : undefined,
    lng: lo !== undefined && Number.isFinite(lo) ? lo : undefined,
  };
}

export type PreparedImportRow = {
  input: ClientInput;
  dedupeKey: string;
};

export function prepareImportRow(
  rawRow: Record<string, string>,
  mapping: CsvColumnMapping,
  unmappedToCustom: boolean
): PreparedImportRow {
  const { standard, custom } = buildRowFromMapping(rawRow, mapping, unmappedToCustom);
  const coords = parseCoordinatePair(standard.latitude, standard.longitude);
  const restStandard = { ...standard };
  delete restStandard.latitude;
  delete restStandard.longitude;
  const merged = mergeRowIntoClientFields(restStandard, custom);
  if (coords.lat !== undefined) merged.latitude = coords.lat;
  if (coords.lng !== undefined) merged.longitude = coords.lng;

  const input = newClientDefaults(merged);
  const flatForDedupe: Record<string, unknown> = {
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.fullName,
    phone: input.phone,
    zip: input.zip,
  };
  const dedupeKey = computeDedupeKey(flatForDedupe);
  return { input, dedupeKey };
}

export async function geocodePreparedRows(
  rows: PreparedImportRow[],
  concurrency: number
): Promise<{ geocoded: number }> {
  let geocoded = 0;
  await mapPool(rows, concurrency, async (r) => {
    const has =
      typeof r.input.latitude === "number" && typeof r.input.longitude === "number";
    if (has) return;
    const addr = addressForGeocode(r.input);
    if (!addr) return;
    const g = await geocodeAddress(addr);
    if (g) {
      r.input.latitude = g.latitude;
      r.input.longitude = g.longitude;
      geocoded++;
    }
  });
  return { geocoded };
}

export function makeImportSource(
  filename: string,
  importBatchId: string
): ClientImportSource {
  return {
    filename,
    importedAt: new Date(),
    importBatchId,
  };
}
