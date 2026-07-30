import { describe, it, expect } from "vitest";
import { nameFromContributionUrl } from "../src/funding/simulated";
import { matchNames } from "../src/domain/verification";

describe("nameFromContributionUrl (sim account-name from QR)", () => {
  it("strips the trailing id and title-cases the slug", () => {
    expect(nameFromContributionUrl("https://contribute.trumpaccount.com/ryleed-83c28dd6/?secret=x")).toBe("Ryleed");
    expect(nameFromContributionUrl("https://contribute.trumpaccount.com/rylee-dawkins-ab12/?secret=x")).toBe("Rylee Dawkins");
  });

  it("catches the reported bug: a Rylee QR does NOT match a Jerald gift", () => {
    const account = nameFromContributionUrl("https://contribute.trumpaccount.com/ryleed-83c28dd6/?secret=x");
    expect(matchNames("Jerald Dawkins", account, { requireWhenAbsent: true })).toBe("MISMATCH");
  });

  it("a matching slug verifies", () => {
    const account = nameFromContributionUrl("https://contribute.trumpaccount.com/jerald-dawkins-abc123/?secret=x");
    expect(matchNames("Jerald Dawkins", account, { requireWhenAbsent: true })).toBe("MATCH");
  });

  it("returns undefined when there is no usable slug", () => {
    expect(nameFromContributionUrl("https://contribute.trumpaccount.com/")).toBeUndefined();
    expect(nameFromContributionUrl("")).toBeUndefined();
  });
});
