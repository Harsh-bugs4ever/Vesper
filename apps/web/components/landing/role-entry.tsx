"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-context";
import { type UserRole } from "@/lib/auth";

const views: {
  role: UserRole;
  destination: string;
  title: string;
  description: string;
  Icon: typeof ShieldCheck;
}[] = [
  {
    role: "general_manager",
    destination: "/admin",
    title: "Owner & manager",
    description: "See the resort, your team, and the decisions ahead.",
    Icon: ShieldCheck,
  },
  {
    role: "employee",
    destination: "/staff",
    title: "Staff",
    description: "See your tasks and care for each stay.",
    Icon: Smartphone,
  },
  {
    role: "guest",
    destination: "/guest",
    title: "Guest",
    description: "Explore services from the comfort of your room.",
    Icon: QrCode,
  },
];

export function RoleEntry({ standalone = false }: { standalone?: boolean }) {
  const { login, signIn } = useAuth();
  const router = useRouter();
  const [showCredentials, setShowCredentials] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState("");

  const enter = (role: UserRole, destination: string) => {
    login(role);
    // A full navigation restores the chosen role before protected dashboard routes
    // render, so their guards never see the previous user's role.
    window.location.assign(destination);
  };

  const submitCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSignInError("");
    setSubmitting(true);
    try {
      const user = await signIn(email.trim(), password);
      router.push(user.role === "employee" ? "/staff" : "/admin");
    } catch (error) {
      setSignInError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id={standalone ? undefined : "portals"}
      tabIndex={standalone ? undefined : -1}
      aria-labelledby="role-entry-title"
      className={`${standalone ? "flex min-h-screen items-center bg-sage-700 py-4 sm:py-8 lg:py-10" : "scroll-mt-20 bg-[#f7f5ef] py-16 sm:py-24"} px-4 outline-none sm:px-8 lg:px-12`}
    >
      <div className="mx-auto grid w-full max-w-7xl overflow-hidden rounded-[1.75rem] border border-sand-200 bg-white shadow-elevated lg:min-h-[690px] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative min-h-[350px] overflow-hidden bg-sage-900 sm:min-h-[460px] lg:min-h-full">
          <Image
            src="/landing/login-retreat.png"
            alt="Quiet resort garden and reflecting pool beside the sea at sunrise"
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sage-950/80 via-sage-950/15 to-transparent" />
          <div className="absolute bottom-9 left-7 right-7 text-white sm:bottom-12 sm:left-12 sm:right-12">
            <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-gold-100">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Vesper
            </p>
            <p className="max-w-md font-serif text-4xl leading-tight sm:text-5xl">
              A calmer way to care for every stay.
            </p>
            <p className="mt-4 text-sm text-white/85">
              One place for the people who make hospitality feel effortless.
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 lg:px-14">
          {standalone && (
            <Link
              href="/"
              className="mb-8 self-start text-xs text-sage-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
            >
              ← Back to Vesper
            </Link>
          )}
          <div className="text-center lg:text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-gold-800">
              Welcome to Vesper
            </p>
            <h2 id="role-entry-title" className="mt-4 font-serif text-4xl text-sage-950 sm:text-5xl">
              Choose your view.
            </h2>
            <p className="mt-4 text-sm leading-7 text-sage-700">
              Select where you would like to begin.
            </p>
          </div>

          <div className="mt-9 space-y-3">
            {views.map(({ role, destination, title, description, Icon }) => (
              <button
                key={role}
                type="button"
                onClick={() => enter(role, destination)}
                className="group flex w-full items-center gap-4 rounded-xl border border-sand-200 bg-sand-50/60 px-4 py-4 text-left transition-colors hover:border-sage-500 hover:bg-sage-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600 focus-visible:ring-offset-2 sm:px-5"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-700">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-xl text-sage-950">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-sage-700">{description}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-sage-700 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="mt-8 border-t border-sand-200 pt-6">
            <button
              type="button"
              onClick={() => setShowCredentials((value) => !value)}
              aria-expanded={showCredentials}
              className="text-sm font-medium text-sage-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-600"
            >
              {showCredentials ? "Hide account sign in" : "Have a staff account? Sign in"}
            </button>
            {showCredentials && (
              <form onSubmit={submitCredentials} className="mt-5 space-y-4">
                <label className="block text-xs font-medium text-sage-800">
                  Work email
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-2 block w-full rounded-lg border border-sand-200 bg-white px-3 py-3 text-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                  />
                </label>
                <label className="block text-xs font-medium text-sage-800">
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 block w-full rounded-lg border border-sand-200 bg-white px-3 py-3 text-sm focus:border-sage-600 focus:outline-none focus:ring-1 focus:ring-sage-600"
                  />
                </label>
                {signInError && <p role="alert" className="text-sm text-rose-700">{signInError}</p>}
                <button type="submit" disabled={submitting} className="w-full rounded-lg bg-sage-700 px-4 py-3 text-sm font-medium text-white hover:bg-sage-800 disabled:opacity-50">
                  {submitting ? "Signing in…" : "Sign in to live data"}
                </button>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-xs leading-5 text-sage-600 lg:text-left">
            Role previews use simulated data. Account sign in connects to the resort API.
          </p>
        </div>
      </div>
    </section>
  );
}
