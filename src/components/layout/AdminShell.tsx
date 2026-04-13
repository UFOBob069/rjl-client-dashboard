"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button, cn } from "@/components/ui/Primitives";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload CSV" },
  { href: "/clients", label: "Clients" },
  { href: "/map", label: "Map" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOutUser } = useAuth();

  return (
    <div className="flex min-h-0 flex-1 bg-zinc-50 dark:bg-zinc-950">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Ramos James Law</div>
          <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Client data</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <Button variant="ghost" className="w-full justify-start" onClick={() => signOutUser()}>
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Internal admin</h1>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
