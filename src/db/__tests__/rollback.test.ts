import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runRollback } from "../rollback";

describe("Migration Rollback Verification (M1.5)", () => {
  const upMigrationPath = path.resolve(
    process.cwd(),
    "src/db/migrations/0000_goofy_next_avengers.sql"
  );
  const downMigrationPath = path.resolve(
    process.cwd(),
    "src/db/migrations/0000_goofy_next_avengers_down.sql"
  );

  it("ensures down migration file exists and is readable", () => {
    expect(fs.existsSync(downMigrationPath)).toBe(true);
    const content = fs.readFileSync(downMigrationPath, "utf-8");
    expect(content.length).toBeGreaterThan(50);
  });

  it("verifies every table created in forward migration has a matching DROP in down migration", () => {
    const upContent = fs.readFileSync(upMigrationPath, "utf-8");
    const downContent = fs.readFileSync(downMigrationPath, "utf-8");

    // Extract all created table names: CREATE TABLE "table_name"
    const tableRegex = /CREATE TABLE "([^"]+)"/g;
    const createdTables: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tableRegex.exec(upContent)) !== null) {
      if (match[1]) {
        createdTables.push(match[1]);
      }
    }

    expect(createdTables.length).toBe(14);

    createdTables.forEach((table) => {
      // Must contain: DROP TABLE IF EXISTS "table" CASCADE;
      const dropStatementRegex = new RegExp(
        `DROP TABLE IF EXISTS "${table}" CASCADE;`,
        "i"
      );
      expect(
        dropStatementRegex.test(downContent),
        `Table "${table}" missing corresponding drop statement in down migration`
      ).toBe(true);
    });
  });

  it("verifies drop statements use CASCADE to cleanly release foreign key constraints", () => {
    const downContent = fs.readFileSync(downMigrationPath, "utf-8");
    const dropLines = downContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("DROP TABLE"));

    expect(dropLines.length).toBe(14);
    dropLines.forEach((line) => {
      expect(line.endsWith("CASCADE;")).toBe(true);
    });
  });

  it("verifies runRollback throws when connection string is not provided", async () => {
    const originalUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(runRollback("")).rejects.toThrow(/DATABASE_URL is not set/);

    if (originalUrl) {
      process.env.DATABASE_URL = originalUrl;
    }
  });

  describe("Migration 0001 Rollback Verification (analytics_daily)", () => {
    const up0001Path = path.resolve(
      process.cwd(),
      "src/db/migrations/0001_lean_calypso.sql"
    );
    const down0001Path = path.resolve(
      process.cwd(),
      "src/db/migrations/0001_lean_calypso_down.sql"
    );

    it("ensures 0001 down migration file exists and is readable", () => {
      expect(fs.existsSync(down0001Path)).toBe(true);
      const content = fs.readFileSync(down0001Path, "utf-8");
      expect(content.length).toBeGreaterThan(20);
    });

    it("verifies analytics_daily created in forward migration has matching DROP with CASCADE in down migration", () => {
      const upContent = fs.readFileSync(up0001Path, "utf-8");
      const downContent = fs.readFileSync(down0001Path, "utf-8");

      expect(upContent).toContain('CREATE TABLE "analytics_daily"');
      expect(downContent).toContain('DROP TABLE IF EXISTS "analytics_daily" CASCADE;');
    });
  });
});
