"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, DEMO_USERS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/auth";

interface AuthContextType {
  user: User;
  role: UserRole;
  rolePermissions: Record<UserRole, string[]>;
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

const STORAGE_KEY_ROLE = "vesper_auth_role";
const STORAGE_KEY_PERMISSIONS = "vesper_role_permissions";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("general_manager");
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, string[]>>(DEFAULT_ROLE_PERMISSIONS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedRole = localStorage.getItem(STORAGE_KEY_ROLE) as UserRole | null;
    if (savedRole && DEMO_USERS[savedRole]) {
      setRole(savedRole);
    }

    try {
      const savedPerms = localStorage.getItem(STORAGE_KEY_PERMISSIONS);
      if (savedPerms) {
        setRolePermissions(JSON.parse(savedPerms));
      }
    } catch {
      // Fallback to default
    }
  }, []);

  const switchRole = (newRole: UserRole) => {
    if (DEMO_USERS[newRole]) {
      setRole(newRole);
      localStorage.setItem(STORAGE_KEY_ROLE, newRole);
    }
  };

  const login = (newRole: UserRole) => {
    switchRole(newRole);
  };

  const logout = () => {
    setRole("general_manager");
    localStorage.removeItem(STORAGE_KEY_ROLE);
  };

  const updateRolePermissions = (targetRole: UserRole, newPerms: string[]) => {
    setRolePermissions((prev) => {
      const updated = {
        ...prev,
        [targetRole]: newPerms,
      };
      try {
        localStorage.setItem(STORAGE_KEY_PERMISSIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetPermissions = () => {
    setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    try {
      localStorage.removeItem(STORAGE_KEY_PERMISSIONS);
    } catch {}
  };

  // Merge active permissions for current role
  const activePermissions = rolePermissions[role] || DEMO_USERS[role].permissions;

  const user: User = {
    ...DEMO_USERS[role],
    permissions: activePermissions,
  };

  const hasPermission = (permission: string): boolean => {
    if (activePermissions.includes("all")) return true;
    return activePermissions.includes(permission);
  };

  const isAdmin = ["general_manager", "dept_manager_fb", "dept_manager_hk", "system_admin"].includes(role);
  const isStaff = role === "employee";
  const isGuest = role === "guest";

  if (!mounted) {
    return (
      <AuthContext.Provider
        value={{
          user: DEMO_USERS.general_manager,
          role: "general_manager",
          rolePermissions: DEFAULT_ROLE_PERMISSIONS,
          login,
          logout,
          switchRole,
          updateRolePermissions,
          resetPermissions,
          hasPermission: () => true,
          isAdmin: true,
          isStaff: false,
          isGuest: false,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        rolePermissions,
        login,
        logout,
        switchRole,
        updateRolePermissions,
        resetPermissions,
        hasPermission,
        isAdmin,
        isStaff,
        isGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
