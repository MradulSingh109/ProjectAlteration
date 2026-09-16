"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComplianceMetrics } from "@/types/dashboard";

interface ComplianceChartProps {
  compliance: ComplianceMetrics;
}

const COLORS = {
  Pass: "#10b981", // Emerald 500
  Fail: "#ef4444", // Red 500
  Review: "#f59e0b", // Amber 500
};

export function ComplianceChart({ compliance }: ComplianceChartProps) {
  const chartData = [
    { name: "Pass (Compliant)", value: compliance.pass, color: COLORS.Pass },
    { name: "Fail (Non-Compliant)", value: compliance.fail, color: COLORS.Fail },
    { name: "Requires Review", value: compliance.review, color: COLORS.Review },
  ];

  const total = compliance.pass + compliance.fail + compliance.review;

  return (
    <Card className="flex flex-col" data-testid="compliance-chart-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Compliance Evaluation
        </CardTitle>
        <CardDescription>
          Automated rule checks vs human review flags ({total} evaluated)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {total === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No compliance evaluation data recorded yet.
          </div>
        ) : (
          <div className="h-[260px] w-full" data-testid="compliance-pie-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    `${Number(value) || 0} packages (${
                      total > 0
                        ? (((Number(value) || 0) / total) * 100).toFixed(1)
                        : "0.0"
                    }%)`,
                    String(name ?? ""),
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
