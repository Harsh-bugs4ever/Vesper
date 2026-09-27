"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Clock,
  Compass,
  MapPin,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { amenities as amenitiesApi, guestTokens, type GuestAmenity } from "@/lib/api";
import { getAmenityImage } from "@/lib/marriott-images";
import { DEMO_RESORT_AMENITIES } from "@/lib/demo/guest-demo";

interface GuestAmenitiesSectionProps {
  className?: string;
  isGuestPortal?: boolean;
}

const DEFAULT_RESORT_AMENITIES: GuestAmenity[] = [
  {
    id: "amenity-1",
    name: "Infinity Sky Pool & Cabanas",
    category: "recreation",
    location: "7th Floor Rooftop Deck",
    operating_hours: "06:00 - 22:00 Daily",
    is_available: true,
    closure_notes: null,
    image_url: "/landing/pool.jpg",
  },
  {
    id: "amenity-2",
    name: "Vesper Spa & Wellness Sanctuary",
    category: "wellness",
    location: "East Wing Level 2",
    operating_hours: "08:00 - 21:00",
    is_available: true,
    closure_notes: null,
    image_url: "/landing/spa.jpg",
  },
  {
    id: "amenity-3",
    name: "24/7 Technogym Fitness Studio",
    category: "wellness",
    location: "Level 2",
    operating_hours: "Open 24 Hours",
    is_available: true,
    closure_notes: null,
    image_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: "amenity-4",
    name: "Private Beach Boardwalk & Loungers",
    category: "recreation",
    location: "Beachfront Ground Level",
    operating_hours: "07:00 - 19:00",
    is_available: true,
    closure_notes: null,
    image_url: "/landing/beach.jpg",
  },
  {
    id: "amenity-5",
    name: "Horizon Executive Club Lounge",
    category: "dining",
    location: "Penthouse Floor 14",
    operating_hours: "06:30 - 23:00",
    is_available: true,
    closure_notes: null,
    image_url: "/landing/dining.jpg",
  },
];

export function GuestAmenitiesSection({
  className = "",
  isGuestPortal = false,
}: GuestAmenitiesSectionProps) {
  const [items, setItems] = useState<GuestAmenity[]>(DEFAULT_RESORT_AMENITIES);
  const [loading, setLoading] = useState(false);

  const fetchAmenities = async () => {
    setLoading(true);
    try {
      const data = await amenitiesApi.list();
      if (data && data.length > 0) {
        setItems(data);
      } else if (isGuestPortal || Boolean(guestTokens.access()?.startsWith("demo-token-"))) {
        setItems(DEMO_RESORT_AMENITIES as GuestAmenity[]);
      } else {
        setItems(DEFAULT_RESORT_AMENITIES);
      }
    } catch {
      if (isGuestPortal || Boolean(guestTokens.access()?.startsWith("demo-token-"))) {
        setItems(DEMO_RESORT_AMENITIES as GuestAmenity[]);
      } else {
        setItems(DEFAULT_RESORT_AMENITIES);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAmenities();
  }, []);

  return (
    <section
      id="amenities"
      tabIndex={-1}
      aria-labelledby="amenities-heading"
      className={`scroll-mt-20 border-t border-sand-200 bg-sand-50/50 px-4 py-8 sm:px-8 sm:py-12 lg:px-16 outline-none ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.24em] text-gold-800">
              Resort Facilities
            </p>
            <h2 id="amenities-heading" className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl text-sage-950">
              Guest Amenities.
            </h2>
            <p className="mt-1.5 sm:mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-sage-700">
              Real-time operating hours, location directions, and active maintenance notes.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAmenities}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-full border border-sand-300 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-medium text-sage-700 hover:border-sage-500 hover:text-sage-950 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Check amenity status
          </button>
        </div>

        {/* Loading State */}
        {loading && items.length === 0 && (
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading resort amenities">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-sand-200 bg-white p-5 sm:p-6 space-y-4"
              >
                <div className="h-40 sm:h-44 rounded-xl bg-sand-200/80" />
                <div className="h-6 w-1/2 rounded bg-sand-200" />
                <div className="h-4 w-3/4 rounded bg-sand-100" />
              </div>
            ))}
          </div>
        )}

        {/* Amenities Cards Grid */}
        {items.length > 0 && (
          <div className="mt-6 sm:mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((amenity) => (
              <article
                key={amenity.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-subtle transition-all duration-300 ${
                  amenity.is_available ? "border-sand-200 hover:shadow-md" : "border-rose-200 bg-rose-50/20"
                }`}
              >
                {/* Facility Image */}
                <div className="relative h-40 sm:h-44 w-full bg-sand-100 overflow-hidden">
                  {(() => {
                    let imgSrc = amenity.image_url;
                    if (!imgSrc || imgSrc.includes("cache.marriott.com")) {
                      imgSrc = getAmenityImage(amenity.name, amenity.category);
                    }
                    return (
                      <Image
                        src={imgSrc}
                        alt={`${amenity.name} facility at Vesper Luxury Resort`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 hover:scale-105"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/landing/pool.jpg";
                        }}
                      />
                    );
                  })()}

                  {/* Status badge: Open vs Closed */}
                  <span
                    className={`absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${
                      amenity.is_available
                        ? "bg-emerald-950/80 text-emerald-200"
                        : "bg-rose-950/85 text-rose-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        amenity.is_available ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    {amenity.is_available ? "Available" : "Temporarily Closed"}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gold-800">
                      {amenity.category}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-serif text-xl font-bold text-sage-950">
                    {amenity.name}
                  </h3>

                  <div className="mt-3 space-y-1.5 border-t border-sand-100 pt-3 text-xs text-sage-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-sage-500 shrink-0" aria-hidden="true" />
                      <span>{amenity.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-sage-500 shrink-0" aria-hidden="true" />
                      <span>{amenity.operating_hours}</span>
                    </div>
                  </div>

                  {/* Closure note if not available */}
                  {!amenity.is_available && amenity.closure_notes && (
                    <div
                      role="note"
                      className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900"
                    >
                      <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-semibold block">Notice:</span>
                        <span>{amenity.closure_notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
