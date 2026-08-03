import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  signIn,
  signUp,
  confirmSignIn,
  confirmSignUp,
  autoSignIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

/**
 * Passwordless auth (handoff D1): the buyer only ever types an email + a
 * one-time code. New emails are signed up behind a random password (never
 * shown) and confirmed by the emailed code; returning emails use EMAIL_OTP
 * sign-in. Either way the code step then yields a session.
 */

type CodeMode = "confirmSignUp" | "confirmSignIn";

interface AuthState {
  email: string | null;
  loading: boolean;
  /** Start auth for an email. Returns whether a code was sent. */
  begin: (email: string) => Promise<void>;
  /** Complete the emailed code challenge. */
  confirm: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const Ctx = createContext<AuthState | null>(null);

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "");
  // Guarantee policy: upper, lower, digit, length >= 12.
  return `Aa1${b64}`.slice(0, 28);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CodeMode | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setEmail(u.signInDetails?.loginId ?? u.username))
      .catch(() => setEmail(null))
      .finally(() => setLoading(false));
  }, []);

  const begin = useCallback(async (addr: string) => {
    setPendingEmail(addr);
    try {
      await signUp({
        username: addr,
        password: randomPassword(),
        options: { userAttributes: { email: addr }, autoSignIn: true },
      });
      setMode("confirmSignUp"); // new user -> confirm the emailed code
    } catch (e) {
      if ((e as { name?: string }).name === "UsernameExistsException") {
        await signIn({
          username: addr,
          options: { authFlowType: "USER_AUTH", preferredChallenge: "EMAIL_OTP" },
        });
        setMode("confirmSignIn"); // returning user -> EMAIL_OTP
      } else {
        throw e;
      }
    }
  }, []);

  const confirm = useCallback(
    async (code: string) => {
      if (!pendingEmail || !mode) throw new Error("no pending auth");
      if (mode === "confirmSignUp") {
        await confirmSignUp({ username: pendingEmail, confirmationCode: code });
        await autoSignIn();
      } else {
        await confirmSignIn({ challengeResponse: code });
      }
      const u = await getCurrentUser();
      setEmail(u.signInDetails?.loginId ?? u.username);
      setMode(null);
      setPendingEmail(null);
    },
    [pendingEmail, mode],
  );

  const logout = useCallback(async () => {
    await signOut();
    setEmail(null);
  }, []);

  const getToken = useCallback(async () => {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  }, []);

  return (
    <Ctx.Provider value={{ email, loading, begin, confirm, logout, getToken }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
