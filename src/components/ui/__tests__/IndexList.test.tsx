import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { IndexList, IndexItem } from "../IndexList";

describe("IndexList and IndexItem", () => {
  it("renders an ordered index list with semantic role", () => {
    render(
      <IndexList>
        <IndexItem
          index={1}
          title="AWS Certified Solutions Architect"
          proofType="certificate"
          issuerName="Amazon Web Services"
          issuedDate="OCT 2026"
          status="ISSUER_VERIFIED"
          href="/@akshay/aws-csa"
        />
        <IndexItem
          index={2}
          title="Distributed Systems Research Paper"
          proofType="publication"
          issuerName="ACM"
          issuedDate="AUG 2026"
          status="DOCUMENT_UPLOADED"
          href="/@akshay/dist-systems"
        />
      </IndexList>
    );

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();

    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("AWS Certified Solutions Architect")).toBeInTheDocument();
    expect(screen.getByText("Amazon Web Services")).toBeInTheDocument();
    expect(screen.getByText("OCT 2026")).toBeInTheDocument();
    expect(screen.getByText("Issuer Verified")).toBeInTheDocument();

    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("Distributed Systems Research Paper")).toBeInTheDocument();
    expect(screen.getByText("Document Attached")).toBeInTheDocument();
  });

  it("links directly to the canonical proof page", () => {
    render(
      <IndexList>
        <IndexItem
          index={1}
          title="React Certification"
          proofType="certificate"
          status="SELF_REPORTED"
          href="/@akshay/react-cert"
        />
      </IndexList>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/@akshay/react-cert");
  });

  it("formats string indices correctly", () => {
    render(
      <IndexList>
        <IndexItem
          index="APP-01"
          title="Custom Key"
          proofType="project"
          status="SELF_REPORTED"
          href="/@akshay/custom"
        />
      </IndexList>
    );

    expect(screen.getByText("APP-01")).toBeInTheDocument();
  });
});
