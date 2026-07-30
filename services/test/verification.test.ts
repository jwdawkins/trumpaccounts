import { describe, it, expect } from "vitest";
import { matchNames, nameTokens } from "../src/domain/verification";

describe("matchNames (D3)", () => {
  it("skips when the buyer left the name blank (default)", () => {
    expect(matchNames(undefined, "Riley Dawkins")).toBe("SKIPPED");
    expect(matchNames("", "Riley Dawkins")).toBe("SKIPPED");
  });

  it("forces manual review when absent + REQUIRE_NAME_MATCH_WHEN_ABSENT", () => {
    expect(matchNames(undefined, "Riley", { requireWhenAbsent: true })).toBe("MISMATCH");
  });

  it("matches exact and case/space-insensitive", () => {
    expect(matchNames("Riley Dawkins", "riley  dawkins")).toBe("MATCH");
    expect(matchNames("SAM", "sam")).toBe("MATCH");
  });

  it("matches a first name against a fuller account name (token subset)", () => {
    expect(matchNames("Riley", "Riley Dawkins")).toBe("MATCH");
    expect(matchNames("Riley Dawkins", "Riley")).toBe("MATCH");
  });

  it("flags a genuine mismatch", () => {
    expect(matchNames("Sam", "Riley Dawkins")).toBe("MISMATCH");
    expect(matchNames("Sam", "Samuel")).toBe("MISMATCH"); // sam != samuel
  });

  it("mismatch when buyer named someone but the account shows no name", () => {
    expect(matchNames("Riley", undefined)).toBe("MISMATCH");
  });

  it("nameTokens splits on punctuation/space", () => {
    expect(nameTokens("Riley-Dawkins  Jr.")).toEqual(["riley", "dawkins", "jr"]);
  });
});
