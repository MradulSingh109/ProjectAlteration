import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AppContainer } from "@/components/shared/app-container";

export default function NotFound() {
  return (
    <main className="flex min-h-[65vh] flex-1 items-center justify-center p-4">
      <AppContainer size="sm">
        <Card className="text-center shadow-md">
          <CardHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
              <FileQuestion className="h-7 w-7" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl font-bold">404 - Page Not Found</CardTitle>
            <CardDescription className="text-sm">
              The page you are looking for does not exist or has been moved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Please check the URL or navigate back to the home page.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link
              href="/"
              className={buttonVariants({ variant: "default", className: "gap-2" })}
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Home
            </Link>
          </CardFooter>
        </Card>
      </AppContainer>
    </main>
  );
}
