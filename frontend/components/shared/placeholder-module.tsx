import * as React from "react";
import { LucideIcon, Sparkles } from "lucide-react";
import { AppContainer } from "@/components/shared/app-container";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PlaceholderModuleProps {
  title: string;
  description: string;
  icon: LucideIcon;
  targetStep?: string;
}

/**
 * Clean placeholder view for future business modules.
 * Confirms that authenticated routing, shell navigation, and role-based access
 * are functioning correctly without prematurely introducing business logic.
 */
export function PlaceholderModule({
  title,
  description,
  icon: Icon,
  targetStep = "Upcoming Implementation Step",
}: PlaceholderModuleProps) {
  return (
    <div className="py-6 md:py-8">
      <AppContainer size="lg">
        <PageHeader heading={title} subheading={description}>
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" />
            {targetStep}
          </Badge>
        </PageHeader>

        <div className="mt-6 space-y-6">
          <EmptyState
            icon={Icon}
            title={`${title} Module`}
            description="Navigation, shell layout, and role-based access boundaries for this module are established. Core business functionality will be introduced in subsequent steps."
          />

          <Card className="border-dashed border-border/80 bg-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                Architecture & Scope Boundary Notice
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Under Step 3 guidelines, this route serves as a validated shell
                navigation placeholder. No business forms, data queries, or domain
                logic are active on this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Official backend API integrations and workflows will connect to this
                view according to the project roadmap.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppContainer>
    </div>
  );
}
