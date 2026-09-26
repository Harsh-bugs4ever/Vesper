"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Bed, ImageOff, RefreshCw, Users } from "lucide-react";
import { property as propertyApi, type BackendRoomCategory } from "@/lib/api";

interface RoomCategoryGalleryProps {
  propertyId?: string;
  className?: string;
}

export function RoomCategoryGallery({ propertyId, className = "" }: RoomCategoryGalleryProps) {
  const [categories, setCategories] = useState<BackendRoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await propertyApi.roomCategories(propertyId);
      setCategories(data ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load room categories from the property server."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [propertyId]);

  return (
    <section
      id="rooms"
      tabIndex={-1}
      aria-labelledby="rooms-heading"
      className={`scroll-mt-20 border-t border-sand-200 bg-sand-50/70 px-6 py-20 outline-none sm:px-10 lg:px-16 ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-gold-800">
              Accommodations
            </p>
            <h2 id="rooms-heading" className="mt-3 font-serif text-3xl sm:text-4xl lg:text-5xl text-sage-950">
              Rooms &amp; Suites.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-sage-700">
              Live room categories and specifications retrieved from the resort's operational database.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchCategories}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium text-sage-700 hover:border-sage-500 hover:text-sage-950 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh categories
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading room categories">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="animate-pulse overflow-hidden rounded-2xl border border-sand-200 bg-white"
              >
                <div className="h-64 bg-sand-200/80" />
                <div className="space-y-4 p-6">
                  <div className="h-6 w-3/4 rounded bg-sand-200" />
                  <div className="h-4 w-1/2 rounded bg-sand-100" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-6 w-16 rounded-full bg-sand-100" />
                    <div className="h-6 w-20 rounded-full bg-sand-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error / API Failure State */}
        {!loading && error && (
          <div
            role="alert"
            className="mt-10 rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center sm:p-10"
          >
            <AlertCircle className="mx-auto h-8 w-8 text-rose-600" aria-hidden="true" />
            <h3 className="mt-4 font-serif text-xl font-medium text-rose-950">
              Unable to reach room category service
            </h3>
            <p className="mt-2 text-sm text-rose-700 max-w-lg mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchCategories}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-rose-700 px-5 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-rose-800"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try connecting again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && categories.length === 0 && (
          <div className="mt-10 rounded-2xl border border-sand-200 bg-white p-12 text-center">
            <Bed className="mx-auto h-8 w-8 text-sand-400" aria-hidden="true" />
            <h3 className="mt-4 font-serif text-xl text-sage-950">No room categories published</h3>
            <p className="mt-2 text-sm text-sage-600">
              The property has not yet registered room categories in the operational database.
            </p>
          </div>
        )}

        {/* Category Cards */}
        {!loading && !error && categories.length > 0 && (
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => {
              const sortedImages = category.images
                ? [...category.images].sort((a, b) => a.order - b.order)
                : [];
              const primaryImage = sortedImages[0];

              return (
                <article
                  key={category.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-subtle transition-all duration-300 hover:shadow-elevated"
                >
                  {/* Image / Neutral Placeholder */}
                  <div className="relative h-64 w-full bg-sand-100 overflow-hidden">
                    {primaryImage?.url ? (
                      <Image
                        src={primaryImage.url}
                        alt={primaryImage.alt_text || `${category.name} photograph`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover"
                      />
                    ) : (
                      /* Neutral placeholder when backend has no uploaded photo */
                      <div
                        className="flex h-full w-full flex-col items-center justify-center bg-sand-100/90 p-6 text-center text-sand-500 border-b border-sand-200"
                        role="img"
                        aria-label={`Neutral placeholder for ${category.name}. No photo currently uploaded.`}
                      >
                        <ImageOff className="h-9 w-9 text-sand-400" strokeWidth={1.5} aria-hidden="true" />
                        <span className="mt-3 text-xs font-medium text-sand-600">
                          Photo pending
                        </span>
                        <span className="mt-1 text-[11px] text-sand-400">
                          Official property photograph not uploaded
                        </span>
                      </div>
                    )}

                    {/* Max Occupancy Badge */}
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-sage-950/75 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      Up to {category.max_occupancy} guests
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl text-sage-950">
                          {category.name}
                        </h3>
                        <p className="mt-1 text-xs uppercase tracking-wider text-gold-800">
                          Category: {category.key}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block font-serif text-xl font-medium text-sage-950">
                          ₹{Number(category.base_rate).toLocaleString("en-IN")}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-sage-600">
                          per night
                        </span>
                      </div>
                    </div>

                    {/* Amenities list */}
                    {category.amenities && category.amenities.length > 0 && (
                      <div className="mt-6 border-t border-sand-100 pt-5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-sage-600">
                          In-room inclusions
                        </p>
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {category.amenities.map((item) => (
                            <li
                              key={item}
                              className="rounded-full border border-sand-200 bg-sand-50/80 px-3 py-1 text-xs text-sage-800"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
