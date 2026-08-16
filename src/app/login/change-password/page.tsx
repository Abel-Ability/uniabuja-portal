import type { Metadata } from "next";
import Link from "next/link";
import { ChangePasswordForm } from "@/components/change-password-form";
import { FloatingActions } from "@/components/floating-actions";

export const metadata: Metadata = { title: "Set New Password" };

export default function ChangePasswordPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh items-center justify-center bg-brand-strong px-4 py-12"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-slate-800 sm:p-10">
        <h1 className="font-head text-2xl font-bold text-slate">Set a new password</h1>
        <p className="mb-6 mt-1 text-sm text-slate/75">
          For your first sign-in, or after a password reset.
        </p>
        <ChangePasswordForm />
        <p className="mt-6 text-center text-xs text-slate/70">
          <Link href="/login" className="hover:text-brand-strong">
            ← Back to sign in
          </Link>
        </p>
      </div>
      <FloatingActions />
    </main>
  );
}
