import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AppContainer } from "@/components/shared/app-container";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

describe("Shared Foundation Components", () => {
  describe("AppContainer", () => {
    it("renders children with responsive container classes", () => {
      render(
        <AppContainer size="lg" data-testid="container">
          <span>Container Content</span>
        </AppContainer>
      );
      const container = screen.getByTestId("container");
      expect(container).toBeInTheDocument();
      expect(container).toHaveTextContent("Container Content");
      expect(container.className).toContain("max-w-7xl");
    });
  });

  describe("PageHeader", () => {
    it("renders heading and subheading semantically", () => {
      render(
        <PageHeader
          heading="System Overview"
          subheading="Status of legal metrology components"
        />
      );
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "System Overview"
      );
      expect(
        screen.getByText("Status of legal metrology components")
      ).toBeInTheDocument();
    });
  });

  describe("LoadingSpinner", () => {
    it("renders accessible loading indicator with role and sr-only label", () => {
      render(<LoadingSpinner label="Fetching records..." />);
      const status = screen.getByRole("status");
      expect(status).toBeInTheDocument();
      expect(status).toHaveAttribute("aria-label", "Fetching records...");
    });
  });

  describe("EmptyState", () => {
    it("renders title, description, and action", () => {
      render(
        <EmptyState
          title="No Inspections Found"
          description="Start by creating a new inspection"
          action={<Button>Create Inspection</Button>}
        />
      );
      expect(screen.getByText("No Inspections Found")).toBeInTheDocument();
      expect(
        screen.getByText("Start by creating a new inspection")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create Inspection" })
      ).toBeInTheDocument();
    });
  });

  describe("UI Primitives", () => {
    it("renders button with correct variant classes", () => {
      render(<Button variant="destructive">Delete Item</Button>);
      const btn = screen.getByRole("button", { name: "Delete Item" });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toContain("bg-destructive");
    });

    it("renders badge with correct variant", () => {
      render(<Badge variant="success">Compliant</Badge>);
      expect(screen.getByText("Compliant")).toBeInTheDocument();
    });
  });
});
