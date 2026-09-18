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

import { ApiError, api, auth as authApi, tokens } from "@/lib/api";
import { DEMO_USERS, DEFAULT_ROLE_PERMISSIONS, type User, type UserRole } from "@/lib/auth";
import { type Department, holdsPermission, isAdminUser, toUiUser } from "@/lib/session";

interface AuthContextType {
  user: User;
  role: UserRole;
  rolePermissions: Record<UserRole, string[]>;
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
          const departments = await loadDepartments();
          if (!cancelled) {
            const uiUser = toUiUser(me, { departments });
            setBackendUser(uiUser);
            setRole(uiUser.role);
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
      const uiUser = toUiUser(me, { departments: await loadDepartments() });
      setBackendUser(uiUser);
      setRole(uiUser.role);
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

  const login = useCallback((newRole: UserRole) => switchRole(newRole), [switchRole]);

  const logout = useCallback(() => {
    void authApi.logout();
    setBackendUser(null);
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
    return {
      user: effective,
      role: mounted ? role : "general_manager",
      rolePermissions,
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
