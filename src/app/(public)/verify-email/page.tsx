import type { Metadata } from "next";
import Link from "next/link";
import { Card, PillLink } from "@/components/ui";
import { verifyEmailToken } from "@/lib/verification";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await verifyEmailToken(token) : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl items-center px-4 py-16">
      {result?.ok ? (
        <Card>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-2xl">
              ✅
            </div>
            <h1 className="font-head text-2xl font-bold text-slate">Email verified</h1>
            <p className="text-sm text-slate">
              Thank you, {result.fullName}. Your email is verified and your account is now
              ready to sign in.
            </p>
            <PillLink href="/login">Continue to sign in</PillLink>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
              ⚠️
            </div>
            <h1 className="font-head text-2xl font-bold text-slate">Verification failed</h1>
            <p className="text-sm text-slate">
              {result?.error ?? "This link is missing its verification token."}
            </p>
            <p className="text-xs text-slate/70">
              You can request a new link from the sign-in screen, or{" "}
              <Link href="/login" className="font-medium text-brand-strong underline">
                go back to sign in
              </Link>
              .
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
