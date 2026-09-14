import {
  ShieldCheck,
  Server,
  Layers,
  Code2,
  CheckCircle2,
  Palette,
  Network,
  Cpu,
} from "lucide-react";
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

const foundationFeatures = [
  {
    icon: Layers,
    title: "Next.js App Router",
    status: "Active",
    description:
      "Server Components by default, nested layout architecture, root loading, error, and not-found boundaries.",
  },
  {
    icon: Code2,
    title: "TypeScript Strict Mode",
    status: "Configured",
    description:
      "Enterprise type safety with zero unchecked any, path aliases (@/*), and strict compile checks.",
  },
  {
    icon: Palette,
    title: "Tailwind CSS & shadcn/ui",
    status: "Initialized",
    description:
      "Accessible design system tokens, responsive utilities, and reusable primitive components.",
  },
  {
    icon: Network,
    title: "TanStack Query Provider",
    status: "Ready",
    description:
      "Hydration-ready query client instance with single browser-session lifecycle and standard caching policies.",
  },
  {
    icon: Server,
    title: "Axios API Client",
    status: "Connected",
    description:
      "Centralized client configured for http://localhost:5000/api with standardized error normalization.",
  },
  {
    icon: Cpu,
    title: "Form & Chart Foundations",
    status: "Available",
    description:
      "React Hook Form, Zod schema resolvers, and Recharts installed for upcoming workflow modules.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Step 1 Foundation Ready
            </Badge>
          </div>
        </AppContainer>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 md:py-12">
        <AppContainer size="lg">
          <PageHeader
            heading="Frontend Foundation & Architecture"
            subheading="Packaged Commodities Legal Metrology Compliance Checking System (SIH26034)"
          >
            <Badge variant="outline" className="text-xs">
              Next.js 16 • TypeScript • Tailwind CSS
            </Badge>
          </PageHeader>

          {/* Foundation Status Grid */}
          <section
            aria-label="Foundation Architectural Pillars"
            className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {foundationFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <Badge variant="secondary" className="text-[11px]">
                      {feature.status}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <CardTitle className="text-base font-semibold">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* Architectural Notes Banner */}
          <section
            aria-label="Architecture Notes"
            className="mt-8 rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-foreground">
              Architecture & Scope Boundary Notice
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              This deployment confirms the foundational frontend architecture for
              SIH26034. In compliance with the Step 1 scope boundary, business
              modules (Authentication, Role-Based Access Control, Inspections, OCR
              Extraction, Legal Metrology Rule Validations, Human Review, and Report
              Generation) will be integrated incrementally in subsequent steps using
              the validated backend OpenAPI contract.
            </p>
          </section>
        </AppContainer>
      </main>

      {/* Application Footer */}
      <footer className="border-t border-border bg-background py-6 text-center text-xs text-muted-foreground">
        <AppContainer size="lg" className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p>© {new Date().getFullYear()} SIH26034 Legal Metrology Compliance System. All rights reserved.</p>
          <p className="text-[11px] text-muted-foreground/80">Frontend Foundation v1.0.0</p>
        </AppContainer>
      </footer>
    </div>
  );
}
