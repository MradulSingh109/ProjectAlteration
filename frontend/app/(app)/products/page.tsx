import { Package } from "lucide-react";
import { PlaceholderModule } from "@/components/shared/placeholder-module";

export default function ProductsPage() {
  return (
    <PlaceholderModule
      title="Products Catalog"
      description="Registered packaged commodities, categories, and manufacturer brands."
      icon={Package}
      targetStep="Step 4 Module"
    />
  );
}
