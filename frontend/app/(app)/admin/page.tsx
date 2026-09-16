import { Settings } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function AdminPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <PlaceholderModule
        title="System Administration"
        description="Inspector accounts, role provisioning, and legal metrology rule matrix management."
        icon={Settings}
        targetStep="Administrative Console"
      />
    </AuthGuard>
  );
}
