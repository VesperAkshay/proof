import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProofSchema, updateProofSchema } from "@/lib/validations/proof";
import {
  validateFilenameAndMime,
  detectMagicBytes,
  auditPdfStructure,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/storage/validation";
import { validateHandle } from "@/lib/handle";
import { sanitizeHttpsUrl, extractSafeHttpsLinks, EXTERNAL_LINK_PROPS } from "@/lib/urls";
import { rateLimiter } from "@/lib/ratelimit";
import nextConfig from "../../../next.config.mjs";

describe("Security Audit & Threat Checklist (M15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter.reset();
  });

  describe("Threat Area 1: Auth & Authorization (IDOR, Privilege Escalation)", () => {
    it("enforces strict anti-mass-assignment on createProofSchema (rejects verificationStatus tampering)", () => {
      const maliciousPayload = {
        title: "Certified Kubernetes Administrator",
        proofType: "certificate",
        verificationStatus: "ISSUER_VERIFIED", // Hostile attempt to self-verify
      };

      const result = createProofSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Unknown fields are forbidden/i);
      }
    });

    it("enforces strict anti-mass-assignment on updateProofSchema (rejects userId and status tampering)", () => {
      const maliciousUpdate = {
        title: "Updated Title",
        userId: "00000000-0000-0000-0000-000000000001", // Attempt to reassign ownership
        verificationStatus: "ISSUER_VERIFIED",
        effectiveStatus: "ISSUER_VERIFIED",
      };

      const result = updateProofSchema.safeParse(maliciousUpdate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Unknown fields are forbidden/i);
      }
    });
  });

  describe("Threat Area 2: Storage & File Upload Security", () => {
    it("rejects path traversal attempts in filenames (../../, \\, %00)", () => {
      expect(validateFilenameAndMime("../../etc/passwd.pdf", "application/pdf").isValid).toBe(false);
      expect(validateFilenameAndMime("..\\..\\windows\\system32.png", "image/png").isValid).toBe(false);
      expect(validateFilenameAndMime("safe.pdf/../../../evil.pdf", "application/pdf").isValid).toBe(false);
    });

    it("rejects dangerous executable and active web extensions disguised with valid MIME", () => {
      expect(validateFilenameAndMime("malware.exe", "application/pdf").isValid).toBe(false);
      expect(validateFilenameAndMime("phishing.html", "image/png").isValid).toBe(false);
      expect(validateFilenameAndMime("script.svg", "image/png").isValid).toBe(false);
      expect(validateFilenameAndMime("archive.zip", "application/pdf").isValid).toBe(false);
    });

    it("rejects polyglot and MIME-forgery (e.g. Windows executable disguised as PDF)", () => {
      // Windows MZ header: 0x4D 0x5A
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      expect(detectMagicBytes(exeBuffer)).toBeNull();

      // HTML disguised as PNG
      const htmlBuffer = Buffer.from("<html><script>alert(1)</script></html>", "utf-8");
      expect(detectMagicBytes(htmlBuffer)).toBeNull();
    });

    it("detects and rejects PDFs with active /JavaScript and /Launch actions", () => {
      const maliciousPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (app.alert(1);) >> >>\nendobj\n%%EOF",
        "latin1"
      );

      const audit = auditPdfStructure(maliciousPdf);
      expect(audit.isValid).toBe(false);
      expect(audit.error).toMatch(/JavaScript/i);
    });

    it("detects and rejects truncated or corrupted PDFs missing %%EOF marker", () => {
      const truncatedPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj", "latin1");
      const audit = auditPdfStructure(truncatedPdf);
      expect(audit.isValid).toBe(false);
      expect(audit.error).toMatch(/missing %%EOF marker/i);
    });

    it("enforces maximum file size cap (10 MB)", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });
  });

  describe("Threat Area 3: Username & Handle Attacks (Homographs, System Hijacking)", () => {
    it("rejects homograph attacks with Cyrillic / Unicode lookalikes", () => {
      // 'а' in 'аkshay' is Cyrillic Unicode U+0430, not ASCII 'a'
      const cyrillicHandle = "аkshay";
      const result = validateHandle(cyrillicHandle);
      expect(result.isValid).toBe(false);
      expect(result.message).toMatch(/lowercase letters, numbers/i);
    });

    it("rejects handles with leading or trailing separators", () => {
      expect(validateHandle("-akshay").isValid).toBe(false);
      expect(validateHandle("akshay-").isValid).toBe(false);
      expect(validateHandle("_akshay").isValid).toBe(false);
      expect(validateHandle("akshay_").isValid).toBe(false);
    });

    it("rejects handles shorter than 3 chars or longer than 30 chars", () => {
      expect(validateHandle("ab").isValid).toBe(false);
      expect(validateHandle("a".repeat(31)).isValid).toBe(false);
      expect(validateHandle("valid-handle-99").isValid).toBe(true);
    });
  });

  describe("Threat Area 4: Public Pages & Web Security (XSS, Injection, CSP)", () => {
    it("sanitizes dangerous URL protocols (javascript:, data:, vbscript:)", () => {
      expect(sanitizeHttpsUrl("javascript:alert(document.cookie)")).toBeNull();
      expect(sanitizeHttpsUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
      expect(sanitizeHttpsUrl("vbscript:msgbox(1)")).toBeNull();
      expect(sanitizeHttpsUrl("http://insecure.example.com")).toBeNull();
      expect(sanitizeHttpsUrl("https://secure.example.com/credential")).toBe(
        "https://secure.example.com/credential"
      );
    });

    it("extracts only safe https links from user bio, rejecting XSS vectors", () => {
      const bio = "Researcher at https://proof.so. Check javascript:alert(1) or http://bad.com";
      const safe = extractSafeHttpsLinks(bio);
      expect(safe).toEqual(["https://proof.so/"]);
    });

    it("enforces rel='noopener noreferrer nofollow ugc' on external user-generated links", () => {
      expect(EXTERNAL_LINK_PROPS.rel).toBe("noopener noreferrer nofollow ugc");
      expect(EXTERNAL_LINK_PROPS.target).toBe("_blank");
    });

    it("verifies global HTTP security headers are configured in next.config.mjs", async () => {
      interface HeaderEntry {
        key: string;
        value: string;
      }
      interface HeaderConfig {
        source: string;
        headers: HeaderEntry[];
      }

      const headersConfig = (await nextConfig.headers!()) as HeaderConfig[];
      const globalHeaders = headersConfig.find((h) => h.source === "/:path*");

      expect(globalHeaders).toBeDefined();
      const headerMap = new Map(globalHeaders!.headers.map((h) => [h.key, h.value]));

      expect(headerMap.get("X-Frame-Options")).toBe("DENY");
      expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
      expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=");
      expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
      expect(headerMap.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    });
  });

  describe("Threat Area 5: Rate Limiting & Denial-of-Service Defense", () => {
    it("enforces rate limits on availability checks, uploads, reports, and writes", () => {
      const key = "sec:ratelimit:test";
      const limit = 5;

      for (let i = 0; i < limit; i++) {
        expect(rateLimiter.check(key, limit, 60).allowed).toBe(true);
      }

      const blocked = rateLimiter.check(key, limit, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.resetSeconds).toBeGreaterThan(0);
    });
  });
});
