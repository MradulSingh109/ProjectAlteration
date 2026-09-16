"use client";

import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, UserCheck, KeyRound } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/providers/auth-provider";
import { AppContainer } from "@/components/shared/app-container";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function VerifySessionPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col bg-background">
        {/* Verification Top Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
          <AppContainer size="lg" className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-semibold text-foreground">SIH26034</span>
                <span className="ml-2 hidden text-xs text-muted-foreground sm:inline-block">
                  Session Verification
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign Out
            </Button>
          </AppContainer>
        </header>

        {/* Verification Content */}
        <main className="flex-1 py-8 md:py-12">
          <AppContainer size="md">
            <PageHeader
              heading="Protected Session Verified"
              subheading="Authentication state confirmed via backend token validation."
            >
              <Badge variant="success" className="gap-1 text-xs">
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Authenticated Session Active
              </Badge>
            </PageHeader>

            <div className="mt-8 space-y-6">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Authenticated Identity</CardTitle>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {user?.role}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Cryptographically validated user claims returned by backend auth service.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-md border border-border/60 bg-muted/40 p-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Full Name:</span>
                      <span className="font-medium text-foreground">{user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email Address:</span>
                      <span className="font-medium text-foreground">{user?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="font-mono text-foreground">{user?.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">System Role:</span>
                      <span className="font-semibold text-primary">{user?.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Status:</span>
                      <span className="font-medium text-emerald-600">
                        {user?.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Bearer JWT token stored in memory & local session store.</span>
                  </div>
                </CardContent>
              </Card>

              {/* Scope Boundary Verification Notice */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Step 2 Verification Scope Notice
                  </CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    This verification route demonstrates that unauthenticated visitors are
                    prevented from reaching protected views, tokens are correctly attached to
                    authenticated requests, and sign-out cleanly invalidates frontend session state.
                    Business modules (Inspections, OCR, Violations, Reports) will be introduced in
                    subsequent steps.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </AppContainer>
        </main>
      </div>
    </AuthGuard>
  );
}
