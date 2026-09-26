"use client";

/**
 * Auth context for the whole app.
 *
 * **Connected** — email and password go to `/auth/login`, tokens are stored in
 * localStorage, and `user.permissions` is whatever the backend actually granted.
 *
 * There is no demo fallback. Unauthenticated users see a loading state while session
 * restoration is in progress, then are redirected to /login if no valid token exists.
 *
 * Components gate on `hasPermission(key)` — derived from the backend's permission list,
 * never from a hardcoded role assumption.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ApiError, api, auth as authApi, property as propertyApi, tokens } from "@/lib/api";
import { DEFAULT_ROLE_PERMISSIONS, type User, type UserRole } from "@/lib/auth";
import {
  type Department,
  type Property,
  type PropertyOption,
  holdsPermission,
  isAdminUser,
  toPropertyOptions,
  toUiProperty,
  toUiUser,
} from "@/lib/session";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  rolePermissions: Record<UserRole, string[]>;
  /**
   * The branch from `GET /property`, populated once connected.
   * Null until the session is established; screens must handle the absent state.
   */
  property: Property | null;
  /** Properties the current user can select. Scoped to the live token. */
  properties: PropertyOption[];
  /** True once a real backend session is established. */
  isConnected: boolean;
  /** True once the initial token check (or its absence) has been determined. */
  isReady: boolean;
  /** True when a previously valid session expired or the token was rejected. */
  sessionExpired: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateRolePermissions: (role: UserRole, permissions: string[]) => void;
  resetPermissions: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_PERMISSIONS = "vesper_role_permissions";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [backendUser, setBackendUser] = useState<User | null>(null);
  const [backendProperty, setBackendProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  // On mount: restore a live session if the stored token is still valid.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Restore locally-persisted permission-matrix edits (used by the admin editor).
      try {
        const savedPerms = window.localStorage.getItem(STORAGE_KEY_PERMISSIONS);
        if (savedPerms) {
          setRolePermissions(JSON.parse(savedPerms));
        }
      } catch {
        // Corrupt entry — use defaults, keep going.
      }

      if (tokens.access()) {
        try {
          const me = await authApi.me();
          const [departments, branch, branches] = await Promise.all([
            loadDepartments(),
            loadProperty(),
            loadProperties(),
          ]);
          if (!cancelled) {
            const uiUser = toUiUser(me, {
              departments,
              propertyName: branch?.name,
            });
            setBackendUser(uiUser);
            if (branch) setBackendProperty(branch);
            if (branches.length) setProperties(branches);
          }
        } catch {
          // An expired or invalid token — clear it so the app reaches a clean state.
          tokens.clear();
          queryClient.clear();
          if (!cancelled) setSessionExpired(true);
        }
      }

      if (!cancelled) setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      queryClient.clear();
      const me = await authApi.login(email, password);
      const [departments, branch, branches] = await Promise.all([
        loadDepartments(),
        loadProperty(),
        loadProperties(),
      ]);
      const uiUser = toUiUser(me, { departments, propertyName: branch?.name });
      setBackendUser(uiUser);
      setSessionExpired(false);
      if (branch) setBackendProperty(branch);
      if (branches.length) setProperties(branches);
      return uiUser;
    } catch (caught) {
      const message =
        caught instanceof ApiError ? caught.message : "Could not sign in. Please try again.";
      setError(message);
      throw caught;
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const logout = useCallback(() => {
    void authApi.logout();
    queryClient.clear();
    // Clear all protected state immediately. Leaving stale data behind risks showing
    // the next user another person's session data during the loading flash.
    setBackendUser(null);
    setBackendProperty(null);
    setProperties([]);
    setSessionExpired(false);
    setError(null);
  }, [queryClient]);

  const updateRolePermissions = useCallback((targetRole: UserRole, newPerms: string[]) => {
    setRolePermissions((prev) => {
      const updated = { ...prev, [targetRole]: newPerms };
      try {
        window.localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const resetPermissions = useCallback(() => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    try {
      window.localStorage.removeItem(STORAGE_KEY_PERMISSIONS);
    } catch {}
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!backendUser) return false;
      return holdsPermission(backendUser.permissions, permission);
    },
    [backendUser],
  );

  const value = useMemo<AuthContextType>(() => {
    const user = backendUser;
    const role = user?.role ?? null;

    return {
      user,
      role,
      rolePermissions,
      property: backendProperty,
      properties,
      isConnected: backendUser !== null,
      isReady,
      sessionExpired,
      isLoading,
      error,
      signIn,
      logout,
      updateRolePermissions,
      resetPermissions,
      hasPermission,
      isAdmin: user ? isAdminUser(user) : false,
      isStaff: user?.role === "employee",
      isGuest: user?.role === "guest",
    };
  }, [
    backendUser,
    backendProperty,
    properties,
    rolePermissions,
    isReady,
    sessionExpired,
    isLoading,
    error,
    signIn,
    logout,
    updateRolePermissions,
    resetPermissions,
    hasPermission,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Department names, so a manager's department reads "Housekeeping" and not a UUID. */
async function loadDepartments(): Promise<Department[]> {
  try {
    return await api.get<Department[]>("/property/departments");
  } catch {
    return [];
  }
}

/**
 * The branch, from the backend.
 *
 * A failure here costs the screen its address; it must not cost the user their session.
 */
async function loadProperty(): Promise<Property | null> {
  try {
    return toUiProperty(await propertyApi.current());
  } catch {
    return null;
  }
}

async function loadProperties(): Promise<PropertyOption[]> {
  try {
    return toPropertyOptions(await propertyApi.list());
  } catch {
    return [];
  }
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
