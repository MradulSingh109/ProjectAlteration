import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Home from "@/app/page";

describe("Root Foundation Page (app/page.tsx)", () => {
  it("renders main heading and system identity", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", {
        name: /Frontend Foundation & Architecture/i,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/SIH26034/i).length).toBeGreaterThan(0);
  });

  it("displays step readiness badge and sign in navigation", () => {
    render(<Home />);
    expect(screen.getByText(/Step 2 Auth Ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
  });


  it("renders key architectural pillar cards", () => {
    render(<Home />);
    expect(screen.getByText(/Next.js App Router/i)).toBeInTheDocument();
    expect(screen.getByText(/TypeScript Strict Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Tailwind CSS & shadcn\/ui/i)).toBeInTheDocument();
    expect(screen.getByText(/TanStack Query Provider/i)).toBeInTheDocument();
    expect(screen.getByText(/Axios API Client/i)).toBeInTheDocument();
  });

  it("renders scope boundary notice", () => {
    render(<Home />);
    expect(
      screen.getByText(/Architecture & Scope Boundary Notice/i)
    ).toBeInTheDocument();
  });
});
