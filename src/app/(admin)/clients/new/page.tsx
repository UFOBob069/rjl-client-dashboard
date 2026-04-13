"use client";

import { useRouter } from "next/navigation";
import { ClientForm } from "@/components/clients/ClientForm";
import { computeDedupeKey, newClientDefaults } from "@/lib/clientRecord";
import { createClient } from "@/lib/firestore/clients";

export default function NewClientPage() {
  const router = useRouter();
  const initial = newClientDefaults({});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">New client</h2>
        <p className="mt-1 text-sm text-zinc-500">Creates a Firestore document in the shared `clients` collection.</p>
      </div>
      <ClientForm
        initial={initial}
        submitLabel="Create client"
        onSubmit={async (data) => {
          const dedupe = computeDedupeKey({
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            fullName: data.fullName,
            phone: data.phone,
            zip: data.zip,
          });
          const id = await createClient(data, dedupe);
          router.push(`/clients/${id}`);
        }}
      />
    </div>
  );
}
