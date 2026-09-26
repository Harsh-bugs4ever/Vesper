"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Clock,
  Compass,
  FileCode,
  ImageOff,
  MapPin,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { amenities as amenitiesApi, type GuestAmenity } from "@/lib/api";
import { getAmenityImage } from "@/lib/marriott-images";

interface GuestAmenitiesSectionProps {
  className?: string;
  isGuestPortal?: boolean;
}

export function GuestAmenitiesSection({
  className = "",
  isGuestPortal = false,
}: GuestAmenitiesSectionProps) {
  const [items, setItems] = useState<GuestAmenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointMissing, setEndpointMissing] = useState(false);

  const fetchAmenities = async () => {
    setLoading(true);
    setError(null);
    setEndpointMissing(false);
    try {
      const data = await amenitiesApi.list();
      setItems(data ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to reach amenities service.";
      setError(msg);
      // Check if 404 or missing endpoint
      if (
        msg.includes("404") ||
        msg.includes("not_found") ||
        msg.includes("Request failed (404)")
      ) {
        setEndpointMissing(true);
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
      className={`scroll-mt-20 border-t border-sand-200 bg-sand-50/50 px-6 py-20 outline-none sm:px-10 lg:px-16 ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-gold-800">
              Resort Facilities
            </p>
            <h2 id="amenities-heading" className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl text-sage-950">
              Guest Amenities.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sage-700">
              Real-time operating hours, location directions, and active maintenance notes.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAmenities}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium text-sage-700 hover:border-sage-500 hover:text-sage-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Check amenity status
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading resort amenities">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="animate-pulse rounded-2xl border border-sand-200 bg-white p-6 space-y-4"
              >
                <div className="h-44 rounded-xl bg-sand-200/80" />
                <div className="h-6 w-1/2 rounded bg-sand-200" />
                <div className="h-4 w-3/4 rounded bg-sand-100" />
              </div>
            ))}
          </div>
        )}

        {/* Endpoint Missing / Explicit Unavailable State (Contract Documented) */}
        {!loading && (endpointMissing || (error && items.length === 0)) && (
          <div
            role="region"
            aria-labelledby="amenity-contract-title"
            className="mt-10 rounded-2xl border border-sand-300 bg-white p-8 sm:p-10 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <h3 id="amenity-contract-title" className="font-serif text-2xl text-sage-950">
                  Guest Amenities Service Unavailable
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-sage-700 max-w-2xl">
                  As required by Vesper's live data policy, resort amenities must be supplied by the backend operational database. Because the server endpoint is currently absent or returning an error, this catalogue is kept explicitly unavailable rather than substituting simulated records.
                </p>

                {error && (
                  <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800">
                    <span className="font-semibold">Backend response:</span> {error}
                  </div>
                )}

                <div className="mt-6 rounded-xl border border-sand-200 bg-sand-50/80 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sage-800">
                    <FileCode className="h-4 w-4 text-gold-700" aria-hidden="true" />
                    Required API Contract Specification
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-xs font-mono text-sage-800 sm:grid-cols-2">
                    <div className="rounded bg-white p-2.5 border border-sand-200">
                      <dt className="text-sage-500 font-sans text-[11px]">HTTP Request</dt>
                      <dd className="mt-1 font-semibold">GET /guest/amenities</dd>
                    </div>
                    <div className="rounded bg-white p-2.5 border border-sand-200">
                      <dt className="text-sage-500 font-sans text-[11px]">Authorization</dt>
                      <dd className="mt-1 font-semibold">Public or Guest Stay Token</dd>
                    </div>
                  </dl>
                  <pre className="mt-3 overflow-x-auto rounded bg-sand-900 p-4 text-[11px] leading-relaxed text-sand-100">
{`// Expected backend payload
[
  {
    "id": "uuid",
    "name": "string",
    "category": "wellness | dining | recreation | services",
    "location": "string",
    "operating_hours": "string",
    "is_available": true | false,
    "closure_notes": "string | null",
    "image_url": "string | null"
  }
]`}
                  </pre>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={fetchAmenities}
                    className="inline-flex items-center gap-2 rounded-full bg-sage-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-sage-800 shadow-sm"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry backend connection
                  </button>
                  <span className="text-xs text-sage-600">
                    Endpoint contract documented in <code className="font-mono text-sage-800">@/lib/api.ts</code>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && !endpointMissing && (
          <div className="mt-10 rounded-2xl border border-sand-200 bg-white p-12 text-center">
            <Compass className="mx-auto h-8 w-8 text-sand-400" aria-hidden="true" />
            <h3 className="mt-4 font-serif text-xl text-sage-950">No amenities registered</h3>
            <p className="mt-2 text-sm text-sage-600">
              The resort database currently has no amenities marked for public or guest display.
            </p>
          </div>
        )}

        {/* Amenities Cards (when live data is returned) */}
        {!loading && items.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {items.map((amenity) => (
              <article
                key={amenity.id}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-subtle transition-all duration-300 ${
                  amenity.is_available ? "border-sand-200" : "border-rose-200 bg-rose-50/20"
                }`}
              >
                {/* Facility Image */}
                <div className="relative h-48 w-full bg-sand-100 overflow-hidden">
                  {(() => {
                    const imgSrc = amenity.image_url || getAmenityImage(amenity.name, amenity.category);
                    return (
                      <Image
                        src={imgSrc}
                        alt={`${amenity.name} facility at JW Marriott Mumbai Juhu`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 hover:scale-105"
                      />
                    );
                  })()}

                  {/* Status badge: Open vs Closed */}
                  <span
                    className={`absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium backdrop-blur-sm ${
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
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gold-800">
                      {amenity.category}
                    </span>
                  </div>

                  <h3 className="mt-2 font-serif text-2xl text-sage-950">
                    {amenity.name}
                  </h3>

                  <div className="mt-4 space-y-2 border-t border-sand-100 pt-4 text-xs text-sage-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-sage-500 shrink-0" aria-hidden="true" />
                      <span>{amenity.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sage-500 shrink-0" aria-hidden="true" />
                      <span>{amenity.operating_hours}</span>
                    </div>
                  </div>

                  {/* Closure note if not available */}
                  {!amenity.is_available && amenity.closure_notes && (
                    <div
                      role="note"
                      className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900"
                    >
                      <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
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
