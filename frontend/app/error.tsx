"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppContainer } from "@/components/shared/app-container";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  React.useEffect(() => {
    // In production, log to a telemetry / error reporting service safely
    // without leaking sensitive user data or credentials
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center p-4">
      <AppContainer size="sm">
        <Card className="border-destructive/30 shadow-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-2">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Application Encountered an Error</CardTitle>
            <CardDescription>
              An unexpected error occurred while processing your request. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted/60 p-3 text-center text-xs text-muted-foreground">
              {error.message || "An unexpected runtime error occurred."}
              {error.digest ? (
                <p className="mt-1 text-[10px] text-muted-foreground/80">
                  Reference: {error.digest}
                </p>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-3">
            <Button
              onClick={() => reset()}
              variant="default"
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Link
              href="/"
              className={buttonVariants({ variant: "outline" })}
            >
              Go to Home
            </Link>
          </CardFooter>
        </Card>
      </AppContainer>
    </main>
  );
}
