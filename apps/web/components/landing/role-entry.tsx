"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, QrCode, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";

export function RoleEntry({ standalone = false }: { standalone?: boolean }) {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState("");

  const submitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignInError("");
    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      // Route strictly based on authenticated backend role
      if (user.role === "employee") {
        router.push("/staff");
      } else {
        router.push("/admin");
      }
    } catch (error) {
      setSignInError(
        error instanceof Error ? error.message : "Authentication failed. Please verify your credentials."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id={standalone ? undefined : "portals"}
      tabIndex={standalone ? undefined : -1}
      aria-labelledby="role-entry-title"
      className={`${
        standalone
          ? "flex min-h-screen items-center bg-sage-800 py-6 sm:py-10 lg:py-12"
          : "scroll-mt-20 bg-sand-50 py-16 sm:py-24"
      } px-4 outline-none sm:px-8 lg:px-12`}
    >
      <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[1.75rem] border border-sand-200 bg-white shadow-elevated lg:min-h-[690px] lg:grid-cols-[1.08fr_0.92fr]">
        {/* Left Visual Panel */}
        <div className="relative min-h-[350px] overflow-hidden bg-sage-950 sm:min-h-[460px] lg:min-h-full">
          <Image
            src="/landing/login-retreat.png"
            alt="Quiet resort garden and reflecting pool beside the sea at sunrise"
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sage-950/85 via-sage-950/20 to-transparent" />
          <div className="absolute bottom-9 left-7 right-7 text-white sm:bottom-12 sm:left-12 sm:right-12">
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold-200">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Vesper
            </p>
            <p className="max-w-md font-serif text-4xl leading-tight sm:text-5xl">
              A calmer way to care for every stay.
            </p>
            <p className="mt-4 text-sm text-white/85 max-w-md">
              Authenticated access to real-time resort operations, front desk, housekeeping, and inventory.
            </p>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
          {standalone && (
            <Link
              href="/"
              className="mb-8 self-start text-xs text-sage-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
            >
              ← Back to Vesper
            </Link>
          )}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold-800">
              Operational Access
            </p>
            <h2 id="role-entry-title" className="mt-3 font-serif text-3xl sm:text-4xl text-sage-950">
              Sign in to Vesper.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sage-700">
              Connect to live resort operations with your staff or management credentials.
            </p>
          </div>

          {/* Real Credentials Form */}
          <form onSubmit={submitCredentials} className="mt-8 space-y-4">
            <div>
              <label htmlFor="work-email" className="block text-xs font-medium text-sage-800">
                Work Email
              </label>
              <input
                id="work-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@vesper.resort"
                className="mt-1.5 block w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-3 text-sm text-sage-950 placeholder:text-sand-400 focus:border-sage-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </div>

            <div>
              <label htmlFor="work-password" className="block text-xs font-medium text-sage-800">
                Password
              </label>
              <input
                id="work-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 block w-full rounded-xl border border-sand-300 bg-sand-50/50 px-3.5 py-3 text-sm text-sage-950 placeholder:text-sand-400 focus:border-sage-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sage-600"
              />
            </div>

            {signInError && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {signInError}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sage-700 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-sage-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              {submitting ? "Authenticating with server…" : "Sign in to live operations"}
            </button>
          </form>

          {/* Guest Access Alternative */}
          <div className="mt-8 border-t border-sand-200 pt-6">
            <p className="text-xs text-sand-500 mb-3">Staying with us as a guest?</p>
            <Link
              href="/guest/room"
              className="group flex w-full items-center gap-4 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-3 text-left transition-colors hover:border-sage-500 hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-base text-sage-950">Guest Room Portal</span>
                <span className="block text-xs text-sage-700">Open in-room dining, services, and amenities</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-sage-700 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-sage-600 lg:text-left">
              Live operations access requires verified staff credentials on the resort API server. No demo data fallback.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
