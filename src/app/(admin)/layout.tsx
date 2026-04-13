import { AdminShell } from "@/components/layout/AdminShell";
import { AuthGate } from "@/components/auth/AuthGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
