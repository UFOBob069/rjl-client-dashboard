"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ClientForm } from "@/components/clients/ClientForm";
import { Button, Card } from "@/components/ui/Primitives";
import { clientToFormInput } from "@/lib/clientRecord";
import { getClient, softDeleteClient, updateClient } from "@/lib/firestore/clients";
import type { Client, ClientInput } from "@/types/client";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [client, setClient] = useState<Client | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const c = await getClient(id);
      setClient(c);
      if (!c) setLoadError("Client not found.");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave(data: ClientInput) {
    await updateClient(id, data);
    await load();
  }

  async function onSoftDelete() {
    if (!confirm("Soft-delete this client? They will be hidden from lists and the map.")) return;
    setDeleting(true);
    try {
      await softDeleteClient(id);
      router.push("/clients");
    } finally {
      setDeleting(false);
    }
  }

  if (loadError && !client) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link href="/clients" className="text-sm text-indigo-600 hover:underline">
          ← Back to clients
        </Link>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (client.isDeleted) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          This record is soft-deleted and hidden from the main list and map.
        </p>
        <Link href="/clients" className="text-sm text-indigo-600 hover:underline">
          ← Back to clients
        </Link>
      </div>
    );
  }

  const initial = clientToFormInput(client);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {client.fullName || [client.firstName, client.lastName].filter(Boolean).join(" ") || "Client"}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Dedupe key (import): <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">{client.dedupeKey ?? "—"}</code>
          </p>
        </div>
        <Link href="/clients" className="text-sm text-indigo-600 hover:underline">
          ← All clients
        </Link>
      </div>

      {client.importSource && (
        <Card className="p-4 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Import source: </span>
          {(client.importSource.filename as string) ?? "—"} ·{" "}
          {client.importSource.importedAt &&
          typeof (client.importSource.importedAt as { toDate?: () => Date }).toDate === "function"
            ? (client.importSource.importedAt as { toDate: () => Date }).toDate().toLocaleString()
            : String(client.importSource.importedAt)}
        </Card>
      )}

      <ClientForm
        initial={initial}
        submitLabel="Save changes"
        onSubmit={onSave}
        extraActions={
          <Button type="button" variant="danger" disabled={deleting} onClick={onSoftDelete}>
            {deleting ? "Deleting…" : "Soft delete"}
          </Button>
        }
      />
    </div>
  );
}
