import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Input } from "../Input";

describe("Input component", () => {
  it("renders with linked label", () => {
    render(<Input id="test-handle" label="Handle" placeholder="username" />);
    const label = screen.getByText("Handle");
    const input = screen.getByPlaceholderText("username");
    expect(label).toHaveAttribute("for", "test-handle");
    expect(input).toHaveAttribute("id", "test-handle");
  });

  it("links helper text via aria-describedby", () => {
    render(
      <Input
        id="test-username"
        label="Username"
        helperText="Choose 3 to 30 characters"
      />
    );
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("aria-describedby", "test-username-helper");
    expect(screen.getByText("Choose 3 to 30 characters")).toBeInTheDocument();
  });

  it("handles error state with aria-invalid and alert role", () => {
    render(
      <Input
        id="test-handle"
        label="Handle"
        error="Handle is already taken"
      />
    );
    const input = screen.getByLabelText("Handle");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "test-handle-error");
    const errorAlert = screen.getByRole("alert");
    expect(errorAlert).toHaveTextContent("Handle is already taken");
  });

  it("captures text input change events", () => {
    const handleChange = vi.fn();
    render(<Input id="test-input" label="Name" onChange={handleChange} />);
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "akshay" } });
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue("akshay");
  });

  it("maintains minimum 44px hit target", () => {
    render(<Input id="touch-input" label="Touch Target" />);
    const input = screen.getByLabelText("Touch Target");
    expect(input.className).toContain("min-h-[44px]");
  });
});
