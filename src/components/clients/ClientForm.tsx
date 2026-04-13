"use client";

import { useMemo, useState } from "react";
import type { ClientInput } from "@/types/client";
import { CLIENT_FORM_FIELDS } from "@/lib/fieldConfig";
import { Button, Input, Label, Select, TextArea } from "@/components/ui/Primitives";

function getFieldValue(c: Partial<ClientInput>, key: string): string {
  const v = (c as Record<string, unknown>)[key];
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Shared create/edit form. Extension: `CLIENT_FORM_FIELDS` drives fields; add rows there for new columns.
 */
export function ClientForm({
  initial,
  onSubmit,
  submitLabel,
  extraActions,
}: {
  initial: ClientInput;
  onSubmit: (data: ClientInput) => Promise<void>;
  submitLabel: string;
  extraActions?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of CLIENT_FORM_FIELDS) {
      o[f.key as string] = getFieldValue(initial, f.key);
    }
    return o;
  });
  const [customJson, setCustomJson] = useState(() =>
    JSON.stringify(initial.customFields ?? {}, null, 2)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedCustom = useMemo(() => {
    try {
      const p = JSON.parse(customJson || "{}") as Record<string, unknown>;
      return { ok: true as const, value: p };
    } catch {
      return { ok: false as const, value: {} as Record<string, unknown> };
    }
  }, [customJson]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!parsedCustom.ok) {
      setError("Custom fields must be valid JSON.");
      return;
    }
    setSaving(true);
    try {
      const latStr = values.latitude?.trim();
      const lngStr = values.longitude?.trim();
      const lat = latStr ? Number(latStr) : undefined;
      const lng = lngStr ? Number(lngStr) : undefined;
      if ((latStr || lngStr) && (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng))) {
        setError("Latitude and longitude must both be valid numbers (or leave both blank).");
        setSaving(false);
        return;
      }

      const next: ClientInput = {
        ...initial,
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        fullName: values.fullName || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        street: values.street || undefined,
        city: values.city || undefined,
        state: values.state || undefined,
        zip: values.zip || undefined,
        fullAddress: values.fullAddress || undefined,
        latitude: lat,
        longitude: lng,
        notes: values.notes || undefined,
        status: (values.status as ClientInput["status"]) || "unknown",
        customFields: parsedCustom.value,
        isDeleted: initial.isDeleted,
        importSource: initial.importSource,
      };
      await onSubmit(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {CLIENT_FORM_FIELDS.map((f) => (
          <div key={f.key as string} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
            <Label htmlFor={f.key as string}>{f.label}</Label>
            {f.type === "textarea" ? (
              <TextArea
                id={f.key as string}
                rows={f.key === "fullAddress" ? 3 : 4}
                value={values[f.key as string] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key as string]: e.target.value }))}
                placeholder={f.placeholder}
              />
            ) : f.type === "select" ? (
              <Select
                id={f.key as string}
                value={values[f.key as string] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key as string]: e.target.value }))}
              >
                {(f.selectOptions ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                id={f.key as string}
                type={f.type === "number" ? "text" : f.type}
                inputMode={f.type === "number" ? "decimal" : undefined}
                value={values[f.key as string] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key as string]: e.target.value }))}
                placeholder={f.placeholder}
              />
            )}
          </div>
        ))}
      </div>

      <div>
        <Label>Custom fields (JSON)</Label>
        <p className="mb-2 text-xs text-zinc-500">
          Extension point: migrate keys from here into `CLIENT_FORM_FIELDS` when they become first-class.
        </p>
        <TextArea
          rows={8}
          className="font-mono text-xs"
          value={customJson}
          onChange={(e) => setCustomJson(e.target.value)}
        />
        {!parsedCustom.ok && <p className="mt-1 text-xs text-red-600">Invalid JSON</p>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );
}
