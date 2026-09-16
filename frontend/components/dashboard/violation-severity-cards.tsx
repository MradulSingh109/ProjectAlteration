import * as React from "react";
import { AlertCircle, AlertOctagon, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ViolationMetrics, ViolationSeverity } from "@/types/dashboard";

interface ViolationSeverityCardsProps {
  violations: ViolationMetrics;
}

interface SeverityConfig {
  label: string;
  key: ViolationSeverity;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: string;
  badgeClasses: string;
  description: string;
}

const SEVERITY_CONFIGS: SeverityConfig[] = [
  {
    label: "Critical",
    key: "CRITICAL",
    icon: AlertOctagon,
    colorClasses: "border-red-200 bg-red-50/50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
    badgeClasses: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
    description: "Major non-compliance (missing MRP, net quantity, manufacturer)",
  },
  {
    label: "High",
    key: "HIGH",
    icon: AlertCircle,
    colorClasses: "border-orange-200 bg-orange-50/50 text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300",
    badgeClasses: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300",
    description: "Significant declaration discrepancies (font size, unit symbol)",
  },
  {
    label: "Medium",
    key: "MEDIUM",
    icon: AlertTriangle,
    colorClasses: "border-amber-200 bg-amber-50/50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    badgeClasses: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    description: "Moderate contrast or positioning discrepancies",
  },
  {
    label: "Low",
    key: "LOW",
    icon: Info,
    colorClasses: "border-blue-200 bg-blue-50/50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300",
    badgeClasses: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
    description: "Minor advisory warnings or borderline legibility flags",
  },
];

export function ViolationSeverityCards({
  violations,
}: ViolationSeverityCardsProps) {
  return (
    <Card className="flex flex-col" data-testid="violation-severity-card">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              Violation Breakdown by Severity
            </CardTitle>
            <CardDescription>
              Categorization based on statutory Legal Metrology rules ({violations.total} total detected)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {violations.open} Open
            </Badge>
            <Badge variant="outline" className="border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {violations.confirmed} Confirmed
            </Badge>
            <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {violations.resolved} Resolved
            </Badge>
            <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              {violations.dismissed} Dismissed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEVERITY_CONFIGS.map((config) => {
            const Icon = config.icon;
            const count = violations.bySeverity?.[config.key] ?? 0;

            return (
              <div
                key={config.key}
                data-testid={`severity-card-${config.key.toLowerCase()}`}
                className={`flex flex-col justify-between rounded-lg border p-4 transition-all ${config.colorClasses}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      {config.label}
                    </span>
                    <Icon className="h-4 w-4 opacity-80" />
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight">
                    {count.toLocaleString()}
                  </div>
                </div>
                <p className="mt-2 text-xs opacity-75">{config.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
