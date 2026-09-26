"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { UserRole } from "@/lib/auth";
import { ArrowRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackUrl?: string;
  renderInlineFallback?: boolean;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallbackUrl = "/access-denied",
  renderInlineFallback = false,
}: RoleGuardProps) {
  const { role, user, isReady, isConnected, sessionExpired } = useAuth();
  const router = useRouter();

  const isAllowed = role !== null && allowedRoles.includes(role);

  useEffect(() => {
    if (!isReady) return;
    if (sessionExpired) {
      router.replace("/login");
    } else if (!isConnected) {
      // Not authenticated at all — send to login.
      router.replace("/login");
    } else if (!isAllowed && !renderInlineFallback) {
      router.replace(fallbackUrl);
    }
  }, [isReady, sessionExpired, isConnected, isAllowed, renderInlineFallback, fallbackUrl, router]);

  if (!isReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6 text-xs text-sand-500" role="status">
        Restoring your session…
      </div>
    );
  }
  if (sessionExpired) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6 text-sm text-sand-600" role="status">
        Your session has ended. Taking you to sign in…
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6 text-sm text-sand-600" role="status">
        Please sign in to continue…
      </div>
    );
  }

  if (!isAllowed) {
    if (renderInlineFallback) {
      return (
        <AccessDeniedCard
          requiredRole={allowedRoles.join(", ")}
          currentRole={user?.roleTitle}
        />
      );
    }
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6">
        <div className="animate-pulse text-xs text-sand-500 font-medium">
          Checking security credentials & permissions...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  requiredRole?: UserRole | UserRole[];
  fallback?: React.ReactNode;
}

export function PermissionGate({
  children,
  permission,
  requiredRole,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, role } = useAuth();

  let hasAccess = true;

  if (permission && !hasPermission(permission)) {
    hasAccess = false;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!role || !roles.includes(role)) {
      hasAccess = false;
    }
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export function AccessDeniedCard({
  title = "Restricted Operational Area",
  message = "You do not have the required permissions or role elevation to view or modify this module.",
  requiredRole,
  requiredPermission,
  currentRole,
}: {
  title?: string;
  message?: string;
  requiredRole?: string;
  requiredPermission?: string;
  currentRole?: string;
}) {
  const router = useRouter();

  return (
    <div className="p-6 sm:p-8 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/50 via-sand-50 to-amber-50/30 text-sand-900 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800 shrink-0 shadow-xs">
          <Lock className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-base font-bold text-sand-950 font-serif">
              {title}
            </h4>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-900 bg-amber-100/60">
              Access Restricted
            </Badge>
          </div>

          <p className="text-xs sm:text-sm text-sand-600 leading-relaxed mb-4">
            {message}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/70 p-3 rounded-xl border border-sand-200 mb-4">
            {currentRole && (
              <div>
                <span className="text-sand-500 block text-[10px] uppercase font-semibold">
                  Your Current Role
                </span>
                <span className="font-semibold text-sage-800">{currentRole}</span>
              </div>
            )}
            {(requiredRole || requiredPermission) && (
              <div>
                <span className="text-sand-500 block text-[10px] uppercase font-semibold">
                  Required Elevation
                </span>
                <span className="font-mono text-[11px] font-semibold text-amber-900">
                  {requiredPermission || requiredRole}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="text-xs"
            >
              Go Back
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => router.push("/login")}
              className="text-xs"
            >
              Sign In
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
