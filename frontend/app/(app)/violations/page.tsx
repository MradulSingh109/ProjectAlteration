import { AlertTriangle } from "lucide-react";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function ViolationsPage() {
  return (
    <PlaceholderModule
      title="Violations Management"
      description="Detected Legal Metrology rule infractions and non-compliance flags."
      icon={AlertTriangle}
      targetStep="Step 9 Module"
    />
  );
}
