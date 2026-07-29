import { describe, it } from "vitest";
import { App } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import { DataStack } from "../lib/data-stack";
import { EnvConfig } from "../lib/config";

const cfg: EnvConfig = {
  stage: "test",
  account: "111111111111",
  region: "us-east-2",
  isEphemeral: true,
};

function synth(): Template {
  const app = new App();
  const stack = new DataStack(app, "TestData", {
    cfg,
    env: { account: cfg.account, region: cfg.region },
  });
  return Template.fromStack(stack);
}

describe("DataStack", () => {
  it("creates a single pay-per-request table with streams enabled", () => {
    const t = synth();
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      StreamSpecification: { StreamViewType: "NEW_AND_OLD_IMAGES" },
    });
  });

  it("defines the three required GSIs (byBuyer, byState, byToken)", () => {
    const t = synth();
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({ IndexName: "GSI1" }),
        Match.objectLike({ IndexName: "GSI2" }),
        Match.objectLike({ IndexName: "GSI3" }),
      ]),
    });
  });

  it("enables point-in-time recovery", () => {
    const t = synth();
    t.hasResourceProperties("AWS::DynamoDB::Table", {
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });
});
