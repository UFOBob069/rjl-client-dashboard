"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDebouncedCallback } from "use-debounce";
import { Button, Card, Input } from "@/components/ui/Primitives";
import { CLIENT_FORM_FIELDS } from "@/lib/fieldConfig";
import { listActiveClients } from "@/lib/firestore/clients";
import type { Client } from "@/types/client";

const TABLE_FIELDS = CLIENT_FORM_FIELDS.filter((f) => f.showInTable);

export default function ClientsTablePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const debouncedSetFilter = useDebouncedCallback((value: string) => setFilterQ(value), 300);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listActiveClients();
        if (!cancelled) setClients(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = filterQ.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      const hay = [
        c.fullName,
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.city,
        c.state,
        c.zip,
        c.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [clients, filterQ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Clients</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Search across name, email, phone, location, status. Table columns come from{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">fieldConfig.ts</code>.
          </p>
        </div>
        <Link href="/clients/new">
          <Button type="button">Add client</Button>
        </Link>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            debouncedSetFilter(e.target.value);
          }}
          className="max-w-md"
        />
      </Card>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                {TABLE_FIELDS.map((f) => (
                  <th key={f.key as string} className="whitespace-nowrap px-4 py-3 font-medium text-zinc-600">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-zinc-600"> </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  {TABLE_FIELDS.map((f) => (
                    <td key={f.key as string} className="max-w-[220px] truncate px-4 py-2.5 text-zinc-800 dark:text-zinc-200">
                      {c[f.key] === undefined || c[f.key] === null ? "—" : String(c[f.key])}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Link className="font-medium text-indigo-600 hover:underline" href={`/clients/${c.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800">
          Showing {filtered.length} of {clients.length} clients
        </div>
      </Card>
    </div>
  );
}
