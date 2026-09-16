import * as React from "react";
import { ClipboardList, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSummaryData } from "@/types/dashboard";

interface DashboardSummaryCardsProps {
  data: DashboardSummaryData;
}

export function DashboardSummaryCards({ data }: DashboardSummaryCardsProps) {
  const { inspections, compliance, violations } = data;

  const totalEvaluated = compliance.pass + compliance.fail + compliance.review;
  const passRate =
    totalEvaluated > 0
      ? ((compliance.pass / totalEvaluated) * 100).toFixed(1)
      : "0.0";

  const cards = [
    {
      title: "Total Inspections",
      value: inspections.total.toLocaleString(),
      subtext: `${inspections.completed} completed · ${inspections.processing + inspections.draft} active`,
      icon: ClipboardList,
      iconColor: "text-blue-600 dark:text-blue-400",
      iconBg: "bg-blue-50 dark:bg-blue-950/60",
    },
    {
      title: "Compliant Packages",
      value: compliance.pass.toLocaleString(),
      subtext: `${passRate}% compliance rate`,
      icon: ShieldCheck,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/60",
    },
    {
      title: "Detected Violations",
      value: violations.total.toLocaleString(),
      subtext: `${violations.open} open · ${violations.confirmed} confirmed`,
      icon: AlertTriangle,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-50 dark:bg-rose-950/60",
    },
    {
      title: "Pending Reviews",
      value: inspections.underReview.toLocaleString(),
      subtext: `${compliance.review} require human adjudication`,
      icon: Clock,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-50 dark:bg-amber-950/60",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className="transition-all duration-200 hover:shadow-md"
            data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.title}
              </CardTitle>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <Icon className={`h-4.5 w-4.5 ${card.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {card.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{card.subtext}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
