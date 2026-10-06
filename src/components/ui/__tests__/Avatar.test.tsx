import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { Avatar } from "../Avatar";

describe("Avatar component", () => {
  it("renders monogram initials when no src is provided", () => {
    render(<Avatar name="Akshay Patel" />);
    expect(screen.getByText("AP")).toBeInTheDocument();
  });

  it("handles single-word handles and names", () => {
    render(<Avatar name="@saturn" />);
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("renders img element when src is provided", () => {
    render(<Avatar name="Akshay" src="https://example.com/avatar.png" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(img).toHaveAttribute("alt", "Akshay's avatar");
  });
});
