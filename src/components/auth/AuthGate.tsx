"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && configured && !user) {
      router.replace("/login");
    }
  }, [user, loading, configured, router]);

  if (!configured) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Firebase is not configured</p>
        <p className="max-w-md text-sm text-zinc-500">
          Add your Firebase web keys to <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">.env.local</code>{" "}
          (see README).
        </p>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
