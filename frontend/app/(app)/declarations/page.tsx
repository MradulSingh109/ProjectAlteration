import { FileCheck2 } from "lucide-react";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function DeclarationsPage() {
  return (
    <PlaceholderModule
      title="Declarations"
      description="Mandatory packaged commodity declarations extracted via OCR/AI."
      icon={FileCheck2}
      targetStep="Step 6 Module"
    />
  );
}
