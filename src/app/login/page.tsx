"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_ERROR_DOMAIN, useAuth } from "@/contexts/AuthContext";
import { allowedEmailDomainHint } from "@/lib/authPolicy";
import { Button, Card } from "@/components/ui/Primitives";

export default function LoginPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && configured && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, configured, router]);

  async function onGoogleClick() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : "";
      if (code === "auth/popup-closed-by-user") {
        setError("Sign-in was cancelled.");
      } else if (e instanceof Error && (e.message === AUTH_ERROR_DOMAIN || e.name === AUTH_ERROR_DOMAIN)) {
        setError(`Only ${allowedEmailDomainHint()} Google accounts can access this app.`);
      } else {
        setError("Google sign-in failed. Check Firebase Auth (Google provider) and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!configured) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Configure Firebase in .env.local (see README).</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Ramos James Law</div>
          <h1 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Staff sign in</h1>
          <p className="mt-1 text-sm text-zinc-500">Internal client data platform</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Use your Google workspace account ending in{" "}
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{allowedEmailDomainHint()}</span>.
          </p>
        </div>
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="button" className="w-full" disabled={submitting || loading} onClick={onGoogleClick}>
            {submitting ? "Signing in…" : "Continue with Google"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
