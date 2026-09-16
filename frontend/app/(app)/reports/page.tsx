import { FileBarChart } from "lucide-react";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function ReportsPage() {
  return (
    <PlaceholderModule
      title="Compliance Reports"
      description="Legal metrology inspection certificates, audit summaries, and exportable data."
      icon={FileBarChart}
      targetStep="Step 10 Module"
    />
  );
}
