import * as React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" data-testid="dashboard-skeleton">
      {/* 4 Summary Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-3.5 w-24 rounded bg-muted" />
              <div className="h-8 w-8 rounded-lg bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="mt-2 h-3 w-32 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Charts Skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-64 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="flex h-[260px] items-center justify-center">
              <div className="h-40 w-40 rounded-full border-8 border-muted" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-pulse">
          <CardHeader className="space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-64 rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="flex h-[260px] items-end justify-between gap-4 px-6 pb-4">
              <div className="h-24 w-12 rounded bg-muted" />
              <div className="h-48 w-12 rounded bg-muted" />
              <div className="h-32 w-12 rounded bg-muted" />
              <div className="h-56 w-12 rounded bg-muted" />
              <div className="h-16 w-12 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Violation Severity Skeleton */}
      <Card className="animate-pulse">
        <CardHeader className="space-y-2">
          <div className="h-4 w-48 rounded bg-muted" />
          <div className="h-3 w-72 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-lg bg-muted p-4" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
