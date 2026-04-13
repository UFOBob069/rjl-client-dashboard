"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!configured) {
      router.replace("/login");
      return;
    }
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, configured, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}
