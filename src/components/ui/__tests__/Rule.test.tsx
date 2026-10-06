import React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Rule } from "../Rule";

describe("Rule component", () => {
  it("renders hr element with appropriate variant border classes", () => {
    const { container: thinContainer } = render(<Rule variant="thin" />);
    expect(thinContainer.querySelector("hr")?.className).toContain("border-t border-rule");

    const { container: thickContainer } = render(<Rule variant="thick" />);
    expect(thickContainer.querySelector("hr")?.className).toContain("border-t-2 border-rule");

    const { container: softContainer } = render(<Rule variant="soft" />);
    expect(softContainer.querySelector("hr")?.className).toContain("border-t border-rule-soft");
  });
});
