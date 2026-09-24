"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Image, { getImageProps } from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCheck,
  Clock3,
  DoorOpen,
  Fingerprint,
  Heart,
  KeyRound,
  Menu,
  Network,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Undo2,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { landingImages } from "@/lib/landing-images";

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-4 focus-visible:ring-offset-sage-950";
const button = `inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-medium ${focus}`;
const links = [
  { id: "tour", label: "Tour" },
  { id: "how-it-works", label: "How it works" },
];

type Scene = {
  title: string;
  description: string;
  detail: string;
  module: string;
  points: { icon: LucideIcon; text: string }[];
};
const scenes: Scene[] = [
  {
    title: "One operating layer for the entire resort.",
    description:
      "A quieter way to run every stay, from first welcome to final farewell.",
    detail: "",
    module: "Smart Resort 360",
    points: [
      { icon: Users, text: "People, in sync" },
      { icon: Sparkles, text: "Intelligence, with care" },
    ],
  },
  {
    title: "A warm welcome. Everything in place.",
    module: "Front Desk",
    description:
      "Make every arrival feel effortless, with rooms, reservations and guest history together.",
    detail: "Give your team the context to greet each guest with care.",
    points: [
      { icon: KeyRound, text: "Seamless check-in & check-out" },
      { icon: DoorOpen, text: "Room allocation at a glance" },
      { icon: Users, text: "A familiar welcome, every visit" },
    ],
  },
  {
    title: "Their room. Their rhythm.",
    module: "Guest QR",
    description:
      "A nightstand QR brings room service, fresh towels and live updates to their phone.",
    detail: "No app to download. No login to remember.",
    points: [
      { icon: QrCode, text: "Scan, browse, request" },
      { icon: Utensils, text: "In-room dining, simply ordered" },
      { icon: Clock3, text: "Live status from request to delivery" },
    ],
  },
  {
    title: "Service that moves with the moment.",
    module: "Staff app",
    description:
      "Tasks reach the right phone in seconds, so your team can stay close to the guest.",
    detail: "Clear priorities keep every promise on time.",
    points: [
      { icon: BellRing, text: "Instant task dispatch" },
      { icon: Clock3, text: "SLA timers, always visible" },
      { icon: CheckCheck, text: "Dirty → cleaning → ready" },
    ],
  },
  {
    title: "Behind every plate, a little foresight.",
    module: "Inventory",
    description:
      "Stock adjusts as orders are served, keeping the kitchen one step ahead.",
    detail: "When supplies run low, a purchase suggestion is ready for review.",
    points: [
      { icon: PackageCheck, text: "Automatic stock deductions" },
      { icon: BellRing, text: "Low-stock signals" },
      { icon: ShieldCheck, text: "Purchasing stays in your hands" },
    ],
  },
  {
    title: "Remember the details that matter.",
    module: "Guest Intelligence",
    description:
      "Turn preferences and feedback into thoughtful, personal moments throughout a stay.",
    detail: "An AI concierge helps guests find just what they need.",
    points: [
      { icon: Heart, text: "Sentiment, understood" },
      { icon: Fingerprint, text: "Individual preference profiles" },
      { icon: Sparkles, text: "A considered AI concierge" },
    ],
  },
  {
    title: "Intelligence with a human touch.",
    module: "AI Action Cards",
    description: "AI recommends, a human decides, the system executes.",
    detail: "Every outcome returns as a lesson for the next recommendation.",
    points: [
      { icon: Check, text: "Approve in one tap" },
      { icon: Undo2, text: "10 seconds to undo" },
      { icon: TrendingUp, text: "Outcomes scored back" },
    ],
  },
];
const flow = [
  { icon: QrCode, label: "Guest scans QR" },
  { icon: Network, label: "Event bus dispatch" },
  { icon: Smartphone, label: "Staff delivers" },
  { icon: PackageCheck, label: "Inventory deducts" },
  { icon: Sparkles, label: "AI action card" },
  { icon: ShieldCheck, label: "GM approves" },
];
function SceneImage({ index }: { index: number }) {
  const [failed, setFailed] = useState(false);
  const photo = landingImages[index];
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-sage-700 via-sage-950 to-sand-300">
      {!failed && (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={index === 0}
          sizes="100vw"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const [activeScene, setActiveScene] = useState(0);
  const [pastHero, setPastHero] = useState(false);
  const [tourVisible, setTourVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const { scrollYProgress } = useScroll({
    target: tourRef,
    offset: ["start start", "end end"],
  });
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [0.85, 1]);

  useEffect(() => {
    // A narrow viewport-center band works for tall sections and landscape phones too.
    const sceneObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setActiveScene(Number((entry.target as HTMLElement).dataset.scene));
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    sectionRefs.current.forEach((section) => {
      if (section) sceneObserver.observe(section);
    });
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        setPastHero(
          entry.intersectionRatio < 0.01 && entry.boundingClientRect.top < 0,
        );
      },
      { threshold: [0, 0.01] },
    );
    const hero = sectionRefs.current[0];
    if (hero) heroObserver.observe(hero);
    const tourObserver = new IntersectionObserver(
      ([entry]) => setTourVisible(entry.isIntersecting),
      { rootMargin: "-81px 0px 0px 0px" },
    );
    if (tourRef.current) tourObserver.observe(tourRef.current);
    return () => {
      sceneObserver.disconnect();
      heroObserver.disconnect();
      tourObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    // Preload the same responsive Next image candidate that the next scene will use.
    const next = landingImages[activeScene + 1];
    if (!next || !tourVisible) return;
    const { props } = getImageProps({
      src: next.src,
      alt: next.alt,
      fill: true,
      sizes: "100vw",
    });
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = props.src;
    if (props.srcSet) preload.imageSrcset = props.srcSet;
    preload.imageSizes = "100vw";
    document.head.appendChild(preload);
    return () => preload.remove();
  }, [activeScene, tourVisible]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document.getElementById("landing-menu-toggle")?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    setMenuOpen(false);
    const target = document.getElementById(id);
    target?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "start",
    });
    target?.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="relative isolate bg-sand-50 font-sans text-sage-950 selection:bg-gold-200 selection:text-sage-950">
      <a
        href="#main-content"
        className={`fixed left-4 top-4 z-[70] -translate-y-24 rounded-lg bg-sand-50 p-3 text-sage-950 focus:translate-y-0 ${focus}`}
      >
        Skip to content
      </a>
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={activeScene}
            className="absolute inset-0"
            initial={{
              opacity: reduceMotion ? 1 : 0,
              scale: reduceMotion ? 1 : 1.08,
            }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: reduceMotion ? 0 : 1.2, ease: "easeInOut" },
              scale: { duration: reduceMotion ? 0 : 7, ease: "easeOut" },
            }}
          >
            <SceneImage index={activeScene} />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50"
          style={{ opacity: reduceMotion ? 1 : overlayOpacity }}
        />
      </div>

      <header
        className={`fixed inset-x-0 top-0 z-50 border-b ${pastHero || menuOpen ? "border-sand-200 bg-sand-50/90 text-sage-950 backdrop-blur-xl" : "border-white/20 bg-black/20 text-white backdrop-blur-sm"}`}
      >
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:px-16">
          <a
            href="#tour"
            onClick={(e) => navigate(e, "tour")}
            aria-label="Vesper home"
            className={`flex items-center gap-3 rounded-sm ${focus}`}
          >
            <span className="font-serif text-4xl leading-none">
              Vesper<span className="text-gold-400">.</span>
            </span>
            <span className="hidden border-l border-current/20 pl-3 text-[9px] uppercase leading-relaxed tracking-[0.22em] sm:block">
              Smart
              <br />
              Resort 360
            </span>
          </a>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-9 md:flex"
          >
            {links.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => navigate(e, id)}
                className={`rounded-sm text-sm ${focus}`}
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className={`${button} border ${pastHero ? "border-sage-700 bg-sage-700 text-white" : "border-white/40 bg-white/10"}`}
            >
              Login <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
          <button
            id="landing-menu-toggle"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            className={`rounded-lg p-3 md:hidden ${focus}`}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="landing-mobile-menu"
              aria-label="Mobile navigation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              className="border-t border-sand-200 bg-sand-50 px-6 py-4 md:hidden"
            >
              {links.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => navigate(e, id)}
                  className={`block rounded-lg px-3 py-4 text-sm ${focus}`}
                >
                  {label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className={`block rounded-lg px-3 py-4 text-sm ${focus}`}
              >
                Login
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative z-10 outline-none"
      >
        <div ref={tourRef}>
          {scenes.map((scene, index) => {
            const photo = landingImages[index];
            return (
              <section
                key={photo.id}
                id={index === 0 ? "tour" : photo.id}
                tabIndex={-1}
                ref={(element) => {
                  sectionRefs.current[index] = element;
                }}
                data-scene={index}
                aria-labelledby={`scene-title-${index}`}
                className="relative flex min-h-screen min-h-[100svh] scroll-mt-0 items-center px-6 py-32 outline-none sm:px-10 lg:px-16"
              >
                <div
                  className={`mx-auto w-full max-w-7xl ${index > 0 && index % 2 === 0 ? "flex justify-end" : ""}`}
                >
                  <div
                    className={
                      index === 0
                        ? "max-w-3xl rounded-2xl border border-white/15 bg-black/30 p-6 text-white backdrop-blur-sm sm:p-10"
                        : "max-w-xl rounded-2xl border border-white/60 bg-sand-50/90 p-7 text-sage-950 shadow-2xl backdrop-blur-xl sm:p-12"
                    }
                  >
                    <p
                      className={`mb-7 text-[11px] font-medium uppercase tracking-[0.24em] ${index === 0 ? "text-gold-200" : "text-gold-800"}`}
                    >
                      0{index + 1} · {photo.scene}
                    </p>
                    {index === 0 ? (
                      <h1
                        id="scene-title-0"
                        className="max-w-[650px] font-serif text-5xl font-normal leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
                      >
                        One operating layer for the{" "}
                        <em className="font-normal text-gold-200">
                          entire resort.
                        </em>
                      </h1>
                    ) : (
                      <h2
                        id={`scene-title-${index}`}
                        className="font-serif text-4xl font-normal leading-[1.08] sm:text-5xl"
                      >
                        {scene.title}
                      </h2>
                    )}
                    <p
                      className={`mt-6 max-w-lg text-base leading-relaxed ${index === 0 ? "text-white" : "text-sage-800"}`}
                    >
                      {scene.description}
                      <span className="hidden md:inline">
                        {scene.detail && ` ${scene.detail}`}
                      </span>
                    </p>
                    {index === 0 ? (
                      <>
                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                          <Link
                            href="/login"
                            className={`${button} bg-sage-700 text-white hover:bg-sage-800`}
                          >
                            Enter Vesper{" "}
                            <ArrowUpRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </Link>
                          <a
                            href="#how-it-works"
                            onClick={(e) => navigate(e, "how-it-works")}
                            className={`${button} border border-white/50 bg-black/20 text-white hover:bg-black/40`}
                          >
                            How Vesper works{" "}
                            <ArrowRight
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </a>
                        </div>
                        <ul className="mt-7 hidden flex-wrap gap-x-6 gap-y-3 md:flex">
                          {scene.points.map(({ icon: Icon, text }) => (
                            <li
                              key={text}
                              className="flex items-center gap-2 text-xs text-white"
                            >
                              <Icon
                                className="h-4 w-4 text-gold-200"
                                aria-hidden="true"
                              />
                              {text}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-6 text-[11px] leading-relaxed tracking-wide text-white/90">
                          JW Marriott Mumbai, Juhu{" "}
                          <span className="mx-2 text-gold-300">/</span> Academic
                          project · Simulated data
                        </p>
                      </>
                    ) : (
                      <>
                        <ul className="mt-8 hidden space-y-4 border-t border-sage-900/15 pt-7 md:block">
                          {scene.points.map(({ icon: Icon, text }) => (
                            <li
                              key={text}
                              className="flex items-center gap-3 text-sm text-sage-800"
                            >
                              <Icon
                                className="h-[18px] w-[18px] shrink-0 text-sage-600"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                              {text}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-7 text-[10px] font-medium uppercase tracking-[0.2em] text-sage-700">
                          Vesper / {scene.module}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                {index === 0 && (
                  <a
                    href="#lobby"
                    onClick={(e) => navigate(e, "lobby")}
                    className={`absolute bottom-8 left-6 inline-flex items-center gap-3 rounded-full bg-black/30 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white sm:left-10 lg:left-16 ${focus}`}
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />A walk
                    through the resort
                  </a>
                )}
                <span className="absolute bottom-9 right-24 hidden text-[10px] uppercase tracking-[0.2em] text-white lg:block">
                  Mumbai · 19.10° N, 72.83° E
                </span>
              </section>
            );
          })}
        </div>

        <div className="relative bg-sand-50">
          <section
            id="how-it-works"
            tabIndex={-1}
            aria-labelledby="flow-title"
            className="scroll-mt-20 border-y border-sand-200 bg-sand-100/50 px-6 py-20 outline-none sm:px-10 lg:px-16"
          >
            <div className="mx-auto max-w-7xl">
              <div className="text-center">
                <p className="mb-4 text-[11px] uppercase tracking-[0.24em] text-gold-800">
                  Connected by design
                </p>
                <h2
                  id="flow-title"
                  className="font-serif text-4xl font-normal sm:text-5xl"
                >
                  How one request flows.
                </h2>
                <p className="mt-4 text-sm text-sage-700">
                  One small request. A whole resort working together.
                </p>
              </div>
              <ol className="mt-14 grid grid-cols-2 gap-x-6 gap-y-9 md:grid-cols-3 lg:grid-cols-6">
                {flow.map(({ icon: Icon, label }, index) => (
                  <li key={label} className="relative text-center">
                    <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-sand-200 bg-sand-50 text-sage-700">
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </div>
                    {index < flow.length - 1 && (
                      <div
                        aria-hidden="true"
                        className="absolute left-[calc(50%+28px)] right-[calc(-50%-24px)] top-7 hidden h-px bg-sand-300 lg:block"
                      />
                    )}
                    <p className="mt-5 text-[10px] tracking-widest text-gold-800">
                      0{index + 1}
                    </p>
                    <p className="mt-2 text-xs font-medium text-sage-800">
                      {label}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <footer className="border-t border-sand-200 px-6 py-10 sm:px-10 lg:px-16">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <span className="font-serif text-4xl">
                  Vesper<span className="text-gold-600">.</span>
                </span>
                <p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-sage-700">
                  Smart Resort 360
                </p>
              </div>
              <div className="max-w-md text-xs leading-6 text-sage-700">
                <p>
                  Academic project. Not affiliated with Marriott International.
                  All data is simulated.
                </p>
                <a
                  href="/landing/credits.txt"
                  className={`mt-1 inline-block underline underline-offset-4 ${focus}`}
                >
                  Photography credits
                </a>
              </div>
              <a
                href="#tour"
                onClick={(e) => navigate(e, "tour")}
                className={`inline-flex items-center gap-2 self-start rounded-sm text-xs text-sage-700 md:self-center ${focus}`}
              >
                Back to arrival{" "}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
