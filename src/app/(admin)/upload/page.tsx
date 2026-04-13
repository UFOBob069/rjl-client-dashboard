"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, Input, Label, Select } from "@/components/ui/Primitives";
import {
  CSV_MAPPABLE_STANDARD_KEYS,
  CSV_MAPPING_SKIP,
  type CsvColumnMapping,
} from "@/lib/fieldConfig";
import { guessCsvMapping } from "@/lib/csvGuessMapping";
import {
  geocodePreparedRows,
  makeImportSource,
  prepareImportRow,
  type ParsedCsv,
} from "@/lib/csvPipeline";
import { toFirestoreCreatePayload } from "@/lib/clientRecord";
import {
  batchImportClients,
  fetchExistingDedupeKeys,
  logImport,
} from "@/lib/firestore/clients";
import { useRouter } from "next/navigation";

const PREVIEW_ROWS = 12;

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [filename, setFilename] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [unmappedToCustom, setUnmappedToCustom] = useState(true);
  const [geocodeMissing, setGeocodeMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    skippedDuplicate: number;
    failed: number;
    geocoded: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback((file: File | null) => {
    setResult(null);
    setError(null);
    if (!file) return;
    setFilename(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        const rows = (res.data ?? []).filter((r) => Object.values(r).some((v) => String(v).trim()));
        const headers = res.meta.fields?.filter(Boolean) as string[];
        if (!headers?.length) {
          setParsed(null);
          setError("Could not read CSV headers.");
          return;
        }
        setParsed({ headers, rows });
        setMapping(guessCsvMapping(headers));
      },
      error: (err) => {
        setError(err.message);
        setParsed(null);
      },
    });
  }, []);

  const preview = useMemo(() => parsed?.rows.slice(0, PREVIEW_ROWS) ?? [], [parsed]);

  const mappingTargets = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: CSV_MAPPING_SKIP, label: "— Skip —" },
      ...CSV_MAPPABLE_STANDARD_KEYS.map((k) => ({ value: k as string, label: String(k) })),
    ];
    return opts;
  }, []);

  async function runImport() {
    if (!parsed || !user) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const importBatchId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `batch-${Date.now()}`;
    const importSource = makeImportSource(filename || "upload.csv", importBatchId);

    try {
      const prepared = parsed.rows.map((row) =>
        prepareImportRow(row, mapping, unmappedToCustom)
      );
      for (const p of prepared) {
        p.input.importSource = importSource;
      }

      let geocoded = 0;
      if (geocodeMissing) {
        const g = await geocodePreparedRows(prepared, 3);
        geocoded = g.geocoded;
      }

      const existingKeys = await fetchExistingDedupeKeys();
      const importResult = await batchImportClients(
        prepared.map((p) => ({ input: p.input, dedupeKey: p.dedupeKey })),
        existingKeys,
        (input, dedupeKey) =>
          toFirestoreCreatePayload(input, dedupeKey, input.importSource)
      );

      await logImport({
        filename: filename || "upload.csv",
        successCount: importResult.success,
        skippedDuplicateCount: importResult.skippedDuplicate,
        failedCount: importResult.failed,
        geocodedCount: geocoded,
        importBatchId,
        userEmail: user.email ?? undefined,
      });

      setResult({
        success: importResult.success,
        skippedDuplicate: importResult.skippedDuplicate,
        failed: importResult.failed,
        geocoded,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Upload CSV</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Parse in-browser, map columns, preview, then write to Firestore. Raw{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">importSource</code> and batch id
          are stored on each client for auditability.
        </p>
      </div>

      <Card className="p-6">
        <Label htmlFor="csv">CSV file</Label>
        <Input
          id="csv"
          type="file"
          accept=".csv,text/csv"
          className="mt-2 cursor-pointer"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {filename && <p className="mt-2 text-xs text-zinc-500">Selected: {filename}</p>}
      </Card>

      {parsed && (
        <>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Column mapping</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Messy headers are expected — adjust dropdowns so each CSV column maps to a client field or skip.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {parsed.headers.map((h) => (
                <div key={h} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{h}</span>
                  <Select
                    value={mapping[h] ?? CSV_MAPPING_SKIP}
                    onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  >
                    {mappingTargets.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={unmappedToCustom}
                onChange={(e) => setUnmappedToCustom(e.target.checked)}
              />
              Put unmapped columns into <code className="text-xs">customFields</code> (column name → value)
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={geocodeMissing}
                onChange={(e) => setGeocodeMissing(e.target.checked)}
              />
              Geocode rows missing coordinates (uses Mapbox; rate-limited — best for smaller files)
            </label>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Preview</h3>
              <p className="text-xs text-zinc-500">First {PREVIEW_ROWS} data rows</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-2 font-medium text-zinc-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                      {parsed.headers.map((h) => (
                        <td key={h} className="max-w-[200px] truncate px-3 py-2 text-zinc-800 dark:text-zinc-200">
                          {row[h] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy} onClick={runImport}>
              {busy ? "Importing…" : `Import ${parsed.rows.length} rows`}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/clients")}>
              View clients
            </Button>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      {result && (
        <Card className="border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Import finished</h3>
          <ul className="mt-2 list-inside list-disc text-sm text-indigo-900/90 dark:text-indigo-100/90">
            <li>Created: {result.success}</li>
            <li>Skipped (duplicates): {result.skippedDuplicate}</li>
            <li>Failed rows (batch errors): {result.failed}</li>
            {geocodeMissing && <li>Geocoded this run: {result.geocoded}</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
