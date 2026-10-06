import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HandleInput } from "../HandleInput";

describe("HandleInput component (M2.5)", () => {
  it("renders input with label and '@' prefix", () => {
    render(<HandleInput value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText(/claim handle/i)).toBeInTheDocument();
    expect(screen.getByText("@")).toBeInTheDocument();
  });

  it("handles input change events", () => {
    const handleChange = vi.fn();
    render(<HandleInput value="akshay" onChange={handleChange} />);
    const input = screen.getByPlaceholderText("yourname");
    fireEvent.change(input, { target: { value: "akshay-new" } });
    expect(handleChange).toHaveBeenCalledWith("akshay-new");
  });

  it("displays live validation error for invalid handles", () => {
    render(<HandleInput value="ab" onChange={vi.fn()} />);
    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toContain("Handle must be at least 3 characters long");
  });
});
