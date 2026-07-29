import { Amplify } from "aws-amplify";
import { config } from "../config";

/** Configure Amplify Auth against our Cognito user pool. Call once at startup. */
export function configureAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
      },
    },
  });
}
