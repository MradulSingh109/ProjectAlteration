"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InspectionMetrics } from "@/types/dashboard";

interface InspectionPipelineChartProps {
  inspections: InspectionMetrics;
}

export function InspectionPipelineChart({
  inspections,
}: InspectionPipelineChartProps) {
  const chartData = [
    { stage: "Draft", count: inspections.draft, fill: "#94a3b8" }, // Slate 400
    { stage: "Processing", count: inspections.processing, fill: "#3b82f6" }, // Blue 500
    { stage: "Under Review", count: inspections.underReview, fill: "#f59e0b" }, // Amber 500
    { stage: "Completed", count: inspections.completed, fill: "#10b981" }, // Emerald 500
    { stage: "Cancelled", count: inspections.cancelled, fill: "#64748b" }, // Slate 500
  ];

  return (
    <Card className="flex flex-col" data-testid="inspection-pipeline-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Inspection Pipeline
        </CardTitle>
        <CardDescription>
          Current lifecycle stage distribution ({inspections.total} total)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {inspections.total === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No inspection pipeline data recorded yet.
          </div>
        ) : (
          <div className="h-[260px] w-full" data-testid="inspection-bar-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={260}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: unknown) => [
                    `${Number(value) || 0} inspections`,
                    "Count",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--card))",
                    color: "hsl(var(--card-foreground))",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    fontSize: "12px",
                  }}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
