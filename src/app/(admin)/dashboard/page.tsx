"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Primitives";
import { listActiveClients, listRecentImportLogs } from "@/lib/firestore/clients";
import { clientHasCoordinates } from "@/lib/clientRecord";
import type { Client } from "@/types/client";

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof listRecentImportLogs>>>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, l] = await Promise.all([listActiveClients(), listRecentImportLogs(8)]);
        if (!cancelled) {
          setClients(c);
          setLogs(l);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mappable = clients.filter((c) => clientHasCoordinates(c)).length;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-500">
          High-level stats and recent imports. Extend this page with charts or KPIs as workflows grow.
        </p>
      </div>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {loadError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total clients</div>
          <div className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{clients.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">On map (lat/lng)</div>
          <div className="mt-2 text-3xl font-semibold text-indigo-600 dark:text-indigo-400">{mappable}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Needs geocode</div>
          <div className="mt-2 text-3xl font-semibold text-amber-600 dark:text-amber-400">
            {clients.length - mappable}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Use CSV import with geocoding or edit records with a full address.
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Quick links</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="text-indigo-600 hover:underline" href="/upload">
                Upload CSV
              </Link>
            </li>
            <li>
              <Link className="text-indigo-600 hover:underline" href="/clients">
                Browse clients
              </Link>
            </li>
            <li>
              <Link className="text-indigo-600 hover:underline" href="/map">
                Map view
              </Link>
            </li>
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Recent imports</h3>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No imports logged yet.</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-3 overflow-auto text-sm">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
                >
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">{log.filename}</div>
                  <div className="text-xs text-zinc-500">
                    {log.importedAt.toLocaleString()} · OK {log.successCount} · skipped dupes{" "}
                    {log.skippedDuplicateCount} · failed {log.failedCount}
                    {log.geocodedCount ? ` · geocoded ${log.geocodedCount}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
