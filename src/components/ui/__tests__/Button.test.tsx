import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../Button";

describe("Button component", () => {
  it("renders children correctly", () => {
    render(<Button>Submit Evidence</Button>);
    expect(screen.getByRole("button", { name: /submit evidence/i })).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button", { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("prevents clicks and applies disabled state", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("handles loading state with aria-busy and disabled behavior", () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("enforces minimum 44px touch target class", () => {
    render(<Button>Touch Target</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("includes focus-visible accessibility outline", () => {
    render(<Button>Focus</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("focus-visible:outline-focus");
  });
});
