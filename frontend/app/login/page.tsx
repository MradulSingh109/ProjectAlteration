"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, AlertCircle, Loader2, Lock } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { loginApi } from "@/lib/api/auth";
import { ApiClientError } from "@/lib/api/errors";
import { loginSchema, LoginFormValues } from "@/lib/validations/auth";
import { AppContainer } from "@/components/shared/app-container";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const { isAuthenticated, isLoading: isAuthLoading, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/dashboard";

  const [apiErrorMessage, setApiErrorMessage] = React.useState<string | null>(null);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(redirectParam);
    }
  }, [isAuthLoading, isAuthenticated, router, redirectParam]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginFormValues) => loginApi(credentials),
    onSuccess: (data) => {
      setApiErrorMessage(null);
      login(data);
      router.replace(redirectParam);
    },
    onError: (error: unknown) => {
      if (error instanceof ApiClientError) {
        if (error.code === "INVALID_CREDENTIALS") {
          setApiErrorMessage("Invalid email or password. Please try again.");
        } else if (error.code === "ACCOUNT_DISABLED") {
          setApiErrorMessage(
            "Your account has been disabled. Please contact your system administrator."
          );
        } else if (error.code === "VALIDATION_ERROR") {
          setApiErrorMessage("Please check the credentials format and try again.");
        } else {
          setApiErrorMessage(error.message);
        }
      } else {
        setApiErrorMessage("An unexpected error occurred. Please try again.");
      }
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setApiErrorMessage(null);
    loginMutation.mutate(values);
  };

  if (isAuthLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
      >
        <LoadingSpinner size="lg" />
        <p className="text-xs text-muted-foreground">Checking session status...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="w-full border-b border-border bg-background/95">
        <AppContainer size="lg" className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-semibold text-foreground">SIH26034</span>
              <span className="ml-2 hidden text-xs text-muted-foreground sm:inline-block">
                Legal Metrology Compliance System
              </span>
            </div>
          </div>
        </AppContainer>
      </header>

      {/* Main Login Card */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md space-y-6">
          <Card className="border-border shadow-md">
            <CardHeader className="space-y-1 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Lock className="h-5 w-5" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl font-bold tracking-tight">
                Sign In to Portal
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Enter your credentials to access the Legal Metrology Compliance system.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* API Error Callout */}
              {apiErrorMessage && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="leading-relaxed">{apiErrorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={loginMutation.isPending}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    placeholder="inspector@example.com"
                    {...register("email")}
                  />
                  {errors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-[11px] font-medium text-destructive"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    disabled={loginMutation.isPending}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    placeholder="••••••••"
                    {...register("password")}
                  />
                  {errors.password && (
                    <p
                      id="password-error"
                      role="alert"
                      className="text-[11px] font-medium text-destructive"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full text-xs font-medium"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      Authenticating...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-center text-[11px] text-muted-foreground">
            <p>
              Authorized personnel only. System activity and inspection operations are
              monitored and audited under the Legal Metrology Rules.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
