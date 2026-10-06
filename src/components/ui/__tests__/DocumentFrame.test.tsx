import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DocumentFrame } from "../DocumentFrame";

describe("DocumentFrame Component (M7)", () => {
  it("renders image preview when MIME type is an image", () => {
    render(
      <DocumentFrame
        title="AWS Certificate"
        mimeType="image/png"
        previewUrl="https://example.com/preview.png"
        filename="aws-cert.png"
        sizeBytes={1024 * 500}
      />
    );

    const img = screen.getByRole("img", { name: "AWS Certificate" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/preview.png");
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("500.0 KB")).toBeInTheDocument();
  });

  it("renders PDF artifact card with download button when MIME is application/pdf", () => {
    render(
      <DocumentFrame
        title="Harvard Diploma"
        mimeType="application/pdf"
        downloadUrl="/@akshay/diploma/download"
        filename="diploma.pdf"
        sizeBytes={1024 * 1024 * 2}
      />
    );

    expect(screen.getAllByText("PDF").length).toBeGreaterThan(0);
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
    expect(screen.getByText("Document Artifact")).toBeInTheDocument();
    const downloadLink = screen.getByRole("link", { name: /Download PDF/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("href", "/@akshay/diploma/download");
    expect(downloadLink).toHaveAttribute("download");
  });

  it("renders placeholder artifact state when no preview or mimeType provided", () => {
    render(
      <DocumentFrame
        title="Arbitrary Evidence"
        filename="custom-evidence.txt"
        downloadUrl="/@akshay/evidence/download"
      />
    );

    expect(screen.getByText("ARTIFACT ATTACHED")).toBeInTheDocument();
    expect(screen.getAllByText("custom-evidence.txt").length).toBeGreaterThan(0);
    const downloadLink = screen.getByRole("link", { name: "Download Document" });
    expect(downloadLink).toHaveAttribute("href", "/@akshay/evidence/download");
  });

  it("never outputs the protected word 'Verified' on unverified evidence frames", () => {
    const { container } = render(
      <DocumentFrame
        title="Self Reported Evidence"
        filename="notes.pdf"
        mimeType="application/pdf"
        downloadUrl="/@akshay/notes/download"
      />
    );
    expect(container.textContent).not.toMatch(/\bVerified\b/);
  });
});
