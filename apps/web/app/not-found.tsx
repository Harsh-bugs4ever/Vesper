import React from "react";
import Link from "next/link";
import {
  Compass,
  Home,
  ArrowRight,
  Sparkles,
  Smartphone,
  BedDouble,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const quickLinks = [
    {
      title: "Resort Operations Deck",
      desc: "Live occupancy, revenue AI action queue, and department overview.",
      href: "/admin",
      icon: Sparkles,
    },
    {
      title: "Staff Mobile Portal",
      desc: "Floor attendance, housekeeping turnover, and room task checklist.",
      href: "/staff",
      icon: Smartphone,
    },
    {
      title: "Guest Digital Companion",
      desc: "Room 412 dining ordering, amenities, and AI concierge.",
      href: "/guest",
      icon: BedDouble,
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 text-sand-950 relative overflow-hidden">
      {/* Decorative Warm Ambient Glow */}
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-sand-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-sage-100/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full text-center relative z-10">
        {/* Crest Icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-sage-50 border-2 border-sage-200/80 flex items-center justify-center text-sage-800 shadow-card mb-4">
          <Compass className="w-8 h-8 stroke-[1.75]" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-semibold text-sand-700 mb-3">
          <span>Error 404 · Unmapped Location</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold font-serif text-sand-950 tracking-tight">
          Villa Not Found
        </h1>

        <p className="text-sm text-sand-600 mt-2 max-w-md mx-auto leading-relaxed">
          You appear to have wandered off the marked resort pathways. The room, document, or deck you are looking for does not exist or has been relocated.
        </p>

        {/* Quick Resort Destinations */}
        <div className="mt-8 text-left space-y-2.5">
          <p className="text-xs font-semibold text-sand-500 uppercase tracking-wider px-1">
            Return to Marked Resort Sectors:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="p-3.5 rounded-xl border border-sand-200 bg-white/70 hover:bg-sage-50/70 hover:border-sage-300 transition-all group flex items-center justify-between shadow-xs hover:shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-sand-100 group-hover:bg-white border border-sand-200/80 text-sage-800 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-sand-950 group-hover:text-sage-950">
                        {link.title}
                      </h4>
                      <p className="text-[11px] text-sand-500 line-clamp-1">
                        {link.desc}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-sand-400 group-hover:text-sage-800 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Primary CTA */}
        <div className="mt-8">
          <Link href="/login">
            <Button variant="default" size="default" className="shadow-soft">
              <Home className="w-4 h-4 mr-2" />
              Return to Resort Front Desk
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
