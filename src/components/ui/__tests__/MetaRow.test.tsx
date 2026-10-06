import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MetaRow } from "../MetaRow";

describe("MetaRow component", () => {
  it("renders label and value in technical mono style", () => {
    render(<MetaRow label="Issued" value="05 OCT 2026" helper="UTC" />);
    expect(screen.getByText("Issued")).toBeInTheDocument();
    expect(screen.getByText("05 OCT 2026")).toBeInTheDocument();
    expect(screen.getByText("(UTC)")).toBeInTheDocument();
  });
});
