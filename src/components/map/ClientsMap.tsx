"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGL, { Layer, Popup, Source, type MapRef } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import type { Feature, Point } from "geojson";
import type { Client } from "@/types/client";
import { clientHasCoordinates } from "@/lib/clientRecord";
import { CLIENT_FORM_FIELDS } from "@/lib/fieldConfig";
import "mapbox-gl/dist/mapbox-gl.css";

const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

function popupLines(c: Client): string[] {
  const lines: string[] = [];
  for (const f of CLIENT_FORM_FIELDS) {
    if (!f.showOnMapPopup) continue;
    const v = c[f.key];
    if (v === undefined || v === null || v === "") continue;
    lines.push(`${f.label}: ${String(v)}`);
  }
  if (c.fullAddress && !lines.some((l) => l.includes("Address:"))) {
    lines.push(`Address: ${c.fullAddress}`);
  }
  return lines.slice(0, 6);
}

/**
 * Map view with Mapbox native GeoJSON clustering.
 * Extension / swap: change `MAP_STYLE` or replace with Google Maps + equivalent clustering lib.
 */
export function ClientsMap({
  clients,
  accessToken,
}: {
  clients: Client[];
  accessToken: string | undefined;
}) {
  const [popup, setPopup] = useState<{
    longitude: number;
    latitude: number;
    client: Client;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef>(null);

  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const geojson = useMemo(() => {
    const features: Feature<Point, { clientId: string }>[] = clients
      .filter((c) => clientHasCoordinates(c))
      .map((c) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [c.longitude!, c.latitude!],
        },
        properties: { clientId: c.id },
      }));
    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [clients]);

  const initialViewState = useMemo(() => {
    if (!geojson.features.length) {
      return { longitude: -98.5, latitude: 39.8, zoom: 3.5 };
    }
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const f of geojson.features) {
      const [lng, lat] = f.geometry.coordinates;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return {
      longitude: (minLng + maxLng) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom: 4,
    };
  }, [geojson.features]);

  const resizeMap = useCallback(() => {
    const map = mapRef.current?.getMap();
    map?.resize();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      resizeMap();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [accessToken, resizeMap]);

  const onClick = useCallback(
    (e: MapMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.layer?.id === "clusters") {
        const map = e.target;
        const coords = (f.geometry as Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 2, 18) });
        return;
      }
      if (f.layer?.id === "unclustered-point") {
        const id = String((f.properties as { clientId?: string })?.clientId ?? "");
        const client = clientById.get(id);
        if (!client) return;
        const [longitude, latitude] = (f.geometry as Point).coordinates as [number, number];
        setPopup({ longitude, latitude, client });
      }
    },
    [clientById]
  );

  if (!accessToken) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Set <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-800">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{" "}
        to enable the map.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rjl-map-root relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800"
    >
      <MapGL
        ref={mapRef}
        mapboxAccessToken={accessToken}
        initialViewState={{
          ...initialViewState,
          bearing: 0,
          pitch: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={onClick}
        onLoad={() => {
          resizeMap();
          requestAnimationFrame(() => resizeMap());
        }}
      >
        <Source
          id="clients"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={16}
          clusterRadius={56}
        >
          <Layer
            id="clusters"
            type="circle"
            filter={["has", "point_count"]}
            paint={{
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#a5b4fc",
                10,
                "#6366f1",
                50,
                "#4338ca",
              ],
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 50, 28],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-size": 12,
            }}
            paint={{
              "text-color": "#ffffff",
            }}
          />
          <Layer
            id="unclustered-point"
            type="circle"
            filter={["!", ["has", "point_count"]]}
            paint={{
              "circle-color": "#4f46e5",
              "circle-radius": 8,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
        </Source>

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="top"
            onClose={() => setPopup(null)}
            closeButton
            closeOnClick={false}
          >
            <div className="max-w-xs p-1 text-xs text-zinc-800">
              {popupLines(popup.client).map((line) => (
                <div key={line}>{line}</div>
              ))}
              <a
                className="mt-2 inline-block font-medium text-indigo-600 hover:underline"
                href={`/clients/${popup.client.id}`}
              >
                Open record
              </a>
            </div>
          </Popup>
        )}
      </MapGL>
    </div>
  );
}
