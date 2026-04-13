"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, Input, Label, Select } from "@/components/ui/Primitives";
import { CLIENT_STATUS_OPTIONS } from "@/lib/fieldConfig";
import { listActiveClients } from "@/lib/firestore/clients";
import { clientHasCoordinates } from "@/lib/clientRecord";
import { geocodeClientsMissingCoordinates } from "@/lib/geocodeMissingClientCoords";
import { addressForGeocode } from "@/lib/address";
import type { Client } from "@/types/client";

const ClientsMap = dynamic(
  () => import("@/components/map/ClientsMap").then((m) => m.ClientsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Loading map…
      </div>
    ),
  }
);

export default function MapPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeNote, setGeocodeNote] = useState<string | null>(null);
  /** Avoid re-geocoding the same doc forever when Mapbox returns no results (prevents a clients→effect loop). */
  const geocodeTriedRef = useRef(new Set<string>());

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

  /** Resolve addresses → lat/lng via Mapbox, save to Firestore, so pins can render. */
  useEffect(() => {
    if (!clients.length) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token?.trim()) return;

    const need = clients.filter(
      (c) =>
        !clientHasCoordinates(c) &&
        addressForGeocode(c) &&
        !geocodeTriedRef.current.has(c.id)
    );
    if (!need.length) return;

    need.forEach((c) => geocodeTriedRef.current.add(c.id));

    let cancelled = false;
    (async () => {
      setGeocoding(true);
      setGeocodeNote(`Placing ${need.length} address(es) on the map…`);
      const onlyIds = new Set(need.map((c) => c.id));
      const { clients: merged, attempted, succeeded } = await geocodeClientsMissingCoordinates(
        clients,
        { concurrency: 3, persist: true, onlyIds }
      );
      if (!cancelled) {
        if (succeeded > 0) {
          setClients(merged);
        }
        if (attempted > 0) {
          const failed = attempted - succeeded;
          setGeocodeNote(
            failed > 0
              ? `Geocoded ${succeeded} of ${attempted}; ${failed} could not be located (check address / Mapbox token).`
              : `Geocoded ${succeeded} address(es). Coordinates saved to Firestore.`
          );
        }
      }
      setGeocoding(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [clients]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (city.trim()) {
        const needle = city.trim().toLowerCase();
        if (!(c.city ?? "").toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [clients, status, city]);

  const withCoords = filtered.filter((c) => clientHasCoordinates(c));

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Map</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pins need <strong className="font-medium text-zinc-700 dark:text-zinc-300">latitude / longitude</strong>. If a
          client only has an address, we forward-geocode with Mapbox when you open this page and save coordinates to
          Firestore. Same <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{" "}
          powers the map and geocoding.
        </p>
      </div>

      <Card className="grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="flt-status">Status</Label>
          <Select
            id="flt-status"
            className="mt-1"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            {CLIENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="flt-city">City contains</Label>
          <Input
            id="flt-city"
            className="mt-1"
            placeholder="e.g. Austin"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!token?.trim() && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Add <code className="text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to <code className="text-xs">.env.local</code>{" "}
          — without it the map and address geocoding cannot run.
        </p>
      )}

      {geocodeNote && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {geocoding ? "… " : ""}
          {geocodeNote}
        </p>
      )}

      <div className="text-xs text-zinc-500">
        Showing {withCoords.length} mappable / {filtered.length} filtered / {clients.length} total clients
      </div>

      {/*
        Explicit height (not only min-height): Mapbox needs a real box size on first paint.
        flex-1 + h-full often leaves the canvas at 0×0.
      */}
      <div className="h-[min(78vh,920px)] min-h-[520px] w-full shrink-0">
        <ClientsMap clients={filtered} accessToken={token} />
      </div>
    </div>
  );
}
