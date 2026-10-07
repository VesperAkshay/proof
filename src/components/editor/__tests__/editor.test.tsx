import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ProofResponseDTO } from "@/services/proof";
import { ProofLivePreview } from "../ProofLivePreview";
import { ProofReorderList } from "../ProofReorderList";
import { ProofEditor } from "../ProofEditor";

const mockProof1: ProofResponseDTO = {
  id: "proof-1-uuid",
  userId: "user-1-uuid",
  slug: "aws-architect",
  title: "AWS Certified Solutions Architect",
  description: "Official AWS professional architectural credential.",
  proofType: "certificate",
  issuerId: null,
  issuerNameText: "Amazon Web Services",
  issuerDisplayName: "Amazon Web Services",
  issuedAt: new Date("2023-01-15T00:00:00.000Z"),
  expiresAt: new Date("2026-01-15T00:00:00.000Z"),
  credentialId: "AWS-PSA-982314",
  credentialUrl: "https://aws.amazon.com/verify/123",
  lifecycleState: "DRAFT",
  visibility: "public",
  verificationStatus: "ISSUER_REFERENCED",
  effectiveStatus: "ISSUER_REFERENCED",
  sortOrder: 0,
  publishedAt: null,
  createdAt: new Date("2023-01-15T00:00:00.000Z"),
  updatedAt: new Date("2023-01-15T00:00:00.000Z"),
};

const mockProof2: ProofResponseDTO = {
  id: "proof-2-uuid",
  userId: "user-1-uuid",
  slug: "mit-micro-masters",
  title: "MIT MicroMasters in Statistics",
  description: "Advanced program in statistics and data science.",
  proofType: "course_completion",
  issuerId: null,
  issuerNameText: "MIT",
  issuerDisplayName: "MIT",
  issuedAt: new Date("2022-06-01T00:00:00.000Z"),
  expiresAt: null,
  credentialId: "MIT-MM-449",
  credentialUrl: null,
  lifecycleState: "PUBLISHED",
  visibility: "public",
  verificationStatus: "SELF_REPORTED",
  effectiveStatus: "SELF_REPORTED",
  sortOrder: 1,
  publishedAt: new Date("2022-06-02T00:00:00.000Z"),
  createdAt: new Date("2022-06-01T00:00:00.000Z"),
  updatedAt: new Date("2022-06-01T00:00:00.000Z"),
};

describe("Milestone M10: Editor & Preview", () => {
  describe("Exit Gate 1: Preview Parity with Public Page", () => {
    it("renders complete editorial hierarchy matching public proof page", () => {
      render(
        <ProofLivePreview
          proof={mockProof1}
          username="sarah"
          displayName="Sarah Connor"
          accent="cobalt"
          previewAsset={{
            filename: "certificate.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1048576,
            previewUrl: "https://proof.so/preview.pdf",
            downloadUrl: "https://proof.so/download.pdf",
          }}
        />
      );

      // Identity & Canonical URL
      expect(screen.getByText("Sarah Connor")).toBeInTheDocument();
      expect(screen.getByText("@sarah")).toBeInTheDocument();
      expect(
        screen.getByText("https://proof.so/@sarah/aws-architect")
      ).toBeInTheDocument();

      // Proof Type & Title
      expect(
        screen.getByRole("heading", {
          name: /AWS Certified Solutions Architect/i,
        })
      ).toBeInTheDocument();
      expect(screen.getAllByText("CERTIFICATE").length).toBeGreaterThanOrEqual(1);

      // Metadata Rows
      expect(screen.getByText("Amazon Web Services")).toBeInTheDocument();
      expect(screen.getByText("AWS-PSA-982314")).toBeInTheDocument();
      expect(screen.getByText("VERIFY EXTERNAL")).toBeInTheDocument();
      expect(screen.getByText("JAN 2023")).toBeInTheDocument();
      expect(screen.getByText("JAN 2026")).toBeInTheDocument();

      // Status Badge with exact required public copy
      expect(
        screen.getByText("Issuer information supplied by the profile owner.")
      ).toBeInTheDocument();

      // Evidence Document Frame
      expect(screen.getByText("certificate.pdf")).toBeInTheDocument();

      // About Context
      expect(
        screen.getByText("Official AWS professional architectural credential.")
      ).toBeInTheDocument();

      // Colophon
      expect(screen.getByText("SHARED VIA PROOF.SO")).toBeInTheDocument();
    });

    it("adapts dynamic accent styling (cobalt, vermilion, marigold, forest)", () => {
      const { rerender, container } = render(
        <ProofLivePreview
          proof={mockProof1}
          username="sarah"
          accent="vermilion"
        />
      );
      expect(container.firstChild).toHaveClass("border-vermilion");

      rerender(
        <ProofLivePreview
          proof={mockProof1}
          username="sarah"
          accent="forest"
        />
      );
      expect(container.firstChild).toHaveClass("border-forest");
    });
  });

  describe("Exit Gate 2: Keyboard-Accessible Reorder", () => {
    it("provides accessible Move Up and Move Down buttons with ARIA announcements", async () => {
      const handleReorderSubmit = vi.fn().mockResolvedValue(undefined);
      const handleSelectProof = vi.fn();

      render(
        <ProofReorderList
          initialProofs={[mockProof1, mockProof2]}
          selectedProofId={mockProof1.id}
          onSelectProof={handleSelectProof}
          onReorderSubmit={handleReorderSubmit}
        />
      );

      // Verify list labels
      expect(
        screen.getByRole("list", { name: /ordered proofs list/i })
      ).toBeInTheDocument();

      // First item's "Move up" should be disabled
      const moveUpFirst = screen.getByRole("button", {
        name: `Move "${mockProof1.title}" up`,
      });
      expect(moveUpFirst).toBeDisabled();

      // Move down button on first item
      const moveDownFirst = screen.getByRole("button", {
        name: `Move "${mockProof1.title}" down`,
      });
      expect(moveDownFirst).not.toBeDisabled();

      // Click move down
      fireEvent.click(moveDownFirst);

      // Verify accessible live region announcement
      const liveRegion = screen.getByRole("status", { name: /reorder status/i });
      expect(liveRegion).toHaveTextContent(
        `Moved "${mockProof1.title}" to position 2 of 2.`
      );

      // Verify onReorderSubmit was called with reversed order
      await waitFor(() => {
        expect(handleReorderSubmit).toHaveBeenCalledWith([
          mockProof2.id,
          mockProof1.id,
        ]);
      });
    });

    it("supports Alt+ArrowDown and Alt+ArrowUp keyboard shortcuts", async () => {
      const handleReorderSubmit = vi.fn().mockResolvedValue(undefined);
      const handleSelectProof = vi.fn();

      render(
        <ProofReorderList
          initialProofs={[mockProof1, mockProof2]}
          selectedProofId={mockProof1.id}
          onSelectProof={handleSelectProof}
          onReorderSubmit={handleReorderSubmit}
        />
      );

      const items = screen.getAllByRole("listitem");
      expect(items[0]).toBeInTheDocument();

      // Fire Alt+ArrowDown on first item
      fireEvent.keyDown(items[0]!, { key: "ArrowDown", altKey: true });

      const liveRegion = screen.getByRole("status", { name: /reorder status/i });
      expect(liveRegion).toHaveTextContent(
        `Moved "${mockProof1.title}" to position 2 of 2.`
      );

      await waitFor(() => {
        expect(handleReorderSubmit).toHaveBeenCalledWith([
          mockProof2.id,
          mockProof1.id,
        ]);
      });
    });
  });

  describe("Exit Gate 3: Optimistic Updates Reconcile on Failure", () => {
    it("reconciles and rolls back reorder on network/API failure", async () => {
      const failingReorderSubmit = vi
        .fn()
        .mockRejectedValue(new Error("Server 500 error"));
      const handleSelectProof = vi.fn();

      render(
        <ProofReorderList
          initialProofs={[mockProof1, mockProof2]}
          selectedProofId={mockProof1.id}
          onSelectProof={handleSelectProof}
          onReorderSubmit={failingReorderSubmit}
        />
      );

      const moveDownFirst = screen.getByRole("button", {
        name: `Move "${mockProof1.title}" down`,
      });

      // Trigger reorder which will reject
      fireEvent.click(moveDownFirst);

      // Wait for rollback and error notice
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Failed to save new order. Order has been reverted./i
        );
      });

      // Verify items were reverted: item 1 is still AWS architect
      const items = screen.getAllByRole("listitem");
      expect(items[0]).toHaveTextContent(mockProof1.title);
      expect(items[1]).toHaveTextContent(mockProof2.title);
    });

    it("reconciles and rolls back editor changes on save failure", async () => {
      const failingSave = vi.fn().mockRejectedValue(new Error("Save failed"));

      render(
        <ProofEditor
          proof={mockProof1}
          username="sarah"
          onSave={failingSave}
        />
      );

      const titleInput = screen.getByLabelText(/TITLE \*/i);
      expect(titleInput).toHaveValue(mockProof1.title);

      // Change title
      fireEvent.change(titleInput, { target: { value: "Changed Title" } });
      expect(titleInput).toHaveValue("Changed Title");

      // Click SAVE
      const saveBtn = screen.getByRole("button", { name: "SAVE" });
      fireEvent.click(saveBtn);

      // Should alert failure and rollback to initial title
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Failed to save changes. Reverted to previous state./i
        );
      });

      expect(titleInput).toHaveValue(mockProof1.title);
    });

    it("reconciles and rolls back lifecycle transition on publish failure", async () => {
      const failingPublish = vi
        .fn()
        .mockRejectedValue(new Error("Publish failed"));

      render(
        <ProofEditor
          proof={mockProof1} // LifecycleState is DRAFT
          username="sarah"
          onPublish={failingPublish}
        />
      );

      const publishBtn = screen.getByRole("button", { name: "PUBLISH" });
      fireEvent.click(publishBtn);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /Failed to publish proof. Reverted to previous state./i
        );
      });

      // Remains DRAFT
      expect(screen.getByRole("button", { name: "PUBLISH" })).toBeInTheDocument();
    });
  });

  describe("Exit Gate 4: Accent Selection, Visibility, and Lifecycle Controls", () => {
    it("handles accent selection and updates live preview", () => {
      render(<ProofEditor proof={mockProof1} username="sarah" />);

      const vermilionButton = screen.getByRole("button", {
        name: /Vermilion/i,
      });
      fireEvent.click(vermilionButton);

      // The live preview container should now reflect vermilion
      const previewTitle = screen.getByRole("heading", {
        name: mockProof1.title,
      });
      const previewCard = previewTitle.closest("div[class*='border-vermilion']");
      expect(previewCard).not.toBeNull();
    });

    it("triggers publish successfully when onPublish succeeds", async () => {
      const successfulPublish = vi.fn().mockResolvedValue({
        ...mockProof1,
        lifecycleState: "PUBLISHED",
      });

      render(
        <ProofEditor
          proof={mockProof1}
          username="sarah"
          onPublish={successfulPublish}
        />
      );

      const publishBtn = screen.getByRole("button", { name: "PUBLISH" });
      fireEvent.click(publishBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Proof successfully published./i)
        ).toBeInTheDocument();
      });

      // UNPUBLISH button should now appear
      expect(
        screen.getByRole("button", { name: "UNPUBLISH" })
      ).toBeInTheDocument();
    });
  });
});
