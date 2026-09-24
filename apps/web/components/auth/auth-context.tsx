"use client";

/**
 * Auth for the whole app, in two modes.
 *
 * **Connected** — a real email and password go to `/auth/login`, tokens are stored, and
 * `user.permissions` is whatever the backend actually granted.
 *
 * **Demo** — the original hardcoded users, still there. The design work does not need a
 * running backend, and a demo can carry on if the API is down. `switchRole` keeps
 * working in both: connected, it signs in as that role's seeded account.
 *
 * Components see one shape either way, and `hasPermission` is the honest question in
 * both — the difference is only where the list came from.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, api, auth as authApi, property as propertyApi, tokens } from "@/lib/api";
import { DEMO_PROPERTY, DEMO_USERS, DEFAULT_ROLE_PERMISSIONS, type User, type UserRole } from "@/lib/auth";
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
  user: User;
  role: UserRole;
  rolePermissions: Record<UserRole, string[]>;
  /**
   * The branch, from `GET /property` once connected. Falls back to the demo property
   * so screens render identically with the backend down — which is the whole point of
   * demo mode, and the reason this is not left null.
   */
  property: Property;
  /** Every property this deployment serves, for the header's switcher. */
  properties: PropertyOption[];
  /** True once a real backend session is established. */
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  updateRolePermissions: (role: UserRole, permissions: string[]) => void;
  resetPermissions: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "vesper_auth_role";
const STORAGE_KEY_PERMISSIONS = "vesper_role_permissions";

/** The seeded account behind each demo role — see scripts/seed.py. */
export const DEMO_CREDENTIALS: Partial<Record<UserRole, { email: string; password: string }>> = {
  general_manager: { email: "gm@vesper.demo", password: "vesper123" },
  system_admin: { email: "owner@vesper.demo", password: "vesper123" },
  dept_manager_hk: { email: "exec@vesper.demo", password: "vesper123" },
  dept_manager_fb: { email: "chef@vesper.demo", password: "vesper123" },
  employee: { email: "hk1@vesper.demo", password: "vesper123" },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("general_manager");
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [backendUser, setBackendUser] = useState<User | null>(null);
  const [backendProperty, setBackendProperty] = useState<Property | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore whatever was in play before a refresh: a real session if the stored token
  // is still good, otherwise the demo role & permissions matrix.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = window.localStorage.getItem(STORAGE_KEY) as UserRole | null;
      if (saved && DEMO_USERS[saved]) setRole(saved);

      try {
        const savedPerms = window.localStorage.getItem(STORAGE_KEY_PERMISSIONS);
        if (savedPerms) {
          setRolePermissions(JSON.parse(savedPerms));
        }
      } catch {
        // Fallback to default permissions
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
            setRole(uiUser.role);
            if (branch) setBackendProperty(branch);
            if (branches.length) setProperties(branches);
          }
        } catch {
          // An expired or revoked token just means demo mode; not worth an error.
          tokens.clear();
        }
      }
      if (!cancelled) setMounted(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await authApi.login(email, password);
      const [departments, branch, branches] = await Promise.all([
        loadDepartments(),
        loadProperty(),
        loadProperties(),
      ]);
      const uiUser = toUiUser(me, { departments, propertyName: branch?.name });
      setBackendUser(uiUser);
      setRole(uiUser.role);
      if (branch) setBackendProperty(branch);
      if (branches.length) setProperties(branches);
      window.localStorage.setItem(STORAGE_KEY, uiUser.role);
      return uiUser;
    } catch (caught) {
      // The backend writes these for the person reading the screen.
      const message =
        caught instanceof ApiError ? caught.message : "Could not sign in. Please try again.";
      setError(message);
      throw caught;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateRolePermissions = useCallback((targetRole: UserRole, newPerms: string[]) => {
    setRolePermissions((prev) => {
      const updated = {
        ...prev,
        [targetRole]: newPerms,
      };
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

  const switchRole = useCallback(
    (newRole: UserRole) => {
      if (!DEMO_USERS[newRole]) return;
      setRole(newRole);
      window.localStorage.setItem(STORAGE_KEY, newRole);

      // Connected: actually become that person, so the permissions are real.
      const credentials = DEMO_CREDENTIALS[newRole];
      if (backendUser && credentials) {
        void signIn(credentials.email, credentials.password).catch(() => {
          // Falls back to the mock view for that role rather than stranding the user.
          setBackendUser(null);
        });
      }
    },
    [backendUser, signIn],
  );

  // The role picker is a local demo entry point. Do not let an existing connected
  // session override the selected role or trigger a background seeded-account login.
  const login = useCallback((newRole: UserRole) => {
    if (!DEMO_USERS[newRole]) return;
    tokens.clear();
    setBackendUser(null);
    setBackendProperty(null);
    setProperties([]);
    setError(null);
    setRole(newRole);
    window.localStorage.setItem(STORAGE_KEY, newRole);
  }, []);

  const logout = useCallback(() => {
    void authApi.logout();
    setBackendUser(null);
    // The branch came with the session, so it goes with it. Leaving it behind would
    // show a signed-out screen the name of a property nobody is authenticated to.
    setBackendProperty(null);
    setProperties([]);
    setRole("general_manager");
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Compute active user with permissions from either backend or local permission matrix
  const activePermissions = rolePermissions[role] || DEMO_USERS[role]?.permissions || [];
  const demoUser: User = {
    ...DEMO_USERS[role],
    permissions: activePermissions,
  };
  const user = backendUser ?? demoUser;

  const hasPermission = useCallback(
    (permission: string) => {
      if (user.permissions.includes("all")) return true;
      return holdsPermission(user.permissions, permission);
    },
    [user],
  );

  const value = useMemo<AuthContextType>(() => {
    // Before mount, render the default GM view to avoid a hydration mismatch.
    const effective = mounted ? user : DEMO_USERS.general_manager;
    const branch = mounted ? (backendProperty ?? DEMO_PROPERTY) : DEMO_PROPERTY;
    return {
      user: effective,
      role: mounted ? role : "general_manager",
      rolePermissions,
      property: branch,
      // Before the list arrives, the one property we can name is our own — better than
      // an empty switcher that looks broken.
      properties: properties.length ? properties : [{ id: branch.id, name: branch.name, locality: branch.location }],
      isConnected: backendUser !== null,
      isLoading,
      error,
      signIn,
      login,
      logout,
      switchRole,
      updateRolePermissions,
      resetPermissions,
      hasPermission: mounted
        ? hasPermission
        : (p: string) => holdsPermission(DEMO_USERS.general_manager.permissions, p),
      isAdmin: mounted ? isAdminUser(effective) : true,
      isStaff: effective.role === "employee",
      isGuest: effective.role === "guest",
    };
  }, [
    mounted,
    user,
    role,
    rolePermissions,
    backendProperty,
    properties,
    backendUser,
    isLoading,
    error,
    signIn,
    login,
    logout,
    switchRole,
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
 * Swallowing the failure is deliberate and matches loadDepartments: a property lookup
 * that fails should cost the screen its address, not the user their session. The
 * caller falls back to the demo property.
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
