"use client";

import React, { useMemo } from "react";
import {
  Check,
  ChefHat,
  Flame,
  Info,
  Plus,
  Sparkles,
  Utensils,
} from "lucide-react";
import {
  MenuItem,
  OrderItemHistorySummary,
  getAiDiningRecommendations,
} from "@/lib/dining-catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GuestAiDiningRecommendationsProps {
  orderHistory: OrderItemHistorySummary[];
  cart: Record<string, number>;
  availableCatalog?: MenuItem[];
  onAddToCart: (item: MenuItem) => void;
  className?: string;
}

export function GuestAiDiningRecommendations({
  orderHistory,
  cart,
  availableCatalog,
  onAddToCart,
  className,
}: GuestAiDiningRecommendationsProps) {
  const activeCartIds = Object.keys(cart).filter((id) => (cart[id] ?? 0) > 0);

  const aiResult = useMemo(() => {
    return getAiDiningRecommendations(orderHistory, activeCartIds, availableCatalog);
  }, [orderHistory, activeCartIds, availableCatalog]);

  const isNonVegPreference = aiResult.preference === "non-veg";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-amber-300/80 bg-linear-to-br from-amber-50/50 via-white to-sand-50/60 p-5 shadow-xs sm:p-6",
        className
      )}
    >
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/10 blur-2xl"
        aria-hidden="true"
      />

      {/* Header with AI Badge */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-sand-200/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm ring-4 ring-amber-100">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg font-bold text-sage-950">
                {aiResult.headline}
              </h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900 border border-amber-300">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-sand-600">
              Personalized culinary curation dynamically adjusted to your taste
            </p>
          </div>
        </div>

        {/* Dietary Palate Badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border shadow-2xs",
            isNonVegPreference
              ? "bg-rose-50 text-rose-900 border-rose-200"
              : aiResult.preference === "veg"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-sand-100 text-sage-900 border-sand-200"
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isNonVegPreference
                ? "bg-rose-600 animate-pulse"
                : aiResult.preference === "veg"
                ? "bg-emerald-600"
                : "bg-amber-600"
            )}
          />
          <span>{aiResult.preferenceLabel}</span>
        </div>
      </div>

      {/* AI Explanation Banner */}
      <div className="relative mt-3.5 flex items-start gap-2.5 rounded-2xl bg-amber-50/80 p-3.5 text-xs text-amber-950 border border-amber-200/90">
        <ChefHat className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
        <p className="leading-relaxed">
          {aiResult.explanation}
        </p>
      </div>

      {/* Suggested Food Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {aiResult.recommendations.map((item) => {
          const inCartCount = cart[item.id] ?? 0;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-sand-200/90 bg-white p-4 shadow-2xs hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-xs border p-0.5",
                        item.is_veg
                          ? "border-emerald-600"
                          : "border-rose-600"
                      )}
                      title={item.is_veg ? "Vegetarian" : "Non-Vegetarian"}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          item.is_veg ? "bg-emerald-600" : "bg-rose-600"
                        )}
                      />
                    </span>
                    <span className="font-serif text-sm font-bold text-sage-950 line-clamp-1">
                      {item.name}
                    </span>
                  </div>

                  {item.tag && (
                    <span className="shrink-0 rounded bg-sand-100 px-1.5 py-0.5 text-[10px] font-semibold text-sage-800">
                      {item.tag}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-xs text-sand-600 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>

                {item.aiRationale && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-800">
                    <Sparkles className="h-3 w-3 text-amber-600 shrink-0" />
                    <span className="line-clamp-1">{item.aiRationale}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-2.5">
                <div>
                  <span className="font-mono text-sm font-bold text-sage-950">
                    ₹{item.price.toLocaleString("en-IN")}
                  </span>
                  <span className="ml-1 text-[10px] text-sand-500">
                    · ~{item.preparationTimeMinutes}m
                  </span>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAddToCart(item)}
                  className={cn(
                    "h-8 px-3 rounded-xl text-xs font-semibold shadow-2xs transition",
                    inCartCount > 0
                      ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                      : "bg-sage-800 hover:bg-sage-900 text-white"
                  )}
                >
                  {inCartCount > 0 ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      <span>Added ({inCartCount})</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 mr-1" />
                      <span>Add to Cart</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
