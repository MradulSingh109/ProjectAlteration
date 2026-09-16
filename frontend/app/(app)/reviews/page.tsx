import { FileSearch } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function ReviewsPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN", "REVIEWER"]}>
      <PlaceholderModule
        title="Human Adjudication & Reviews"
        description="Formal review workflows, status transitions, and inspector dispute resolution."
        icon={FileSearch}
        targetStep="Step 9 Module"
      />
    </AuthGuard>
  );
}
