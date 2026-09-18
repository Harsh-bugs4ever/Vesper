"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, DEMO_USERS } from "@/lib/auth";

interface AuthContextType {
  user: User;
  role: UserRole;
  login: (role: UserRole) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "vesper_auth_role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>("general_manager");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY) as UserRole | null;
    if (saved && DEMO_USERS[saved]) {
      setRole(saved);
    }
  }, []);

  const switchRole = (newRole: UserRole) => {
    if (DEMO_USERS[newRole]) {
      setRole(newRole);
      localStorage.setItem(STORAGE_KEY, newRole);
    }
  };

  const login = (newRole: UserRole) => {
    switchRole(newRole);
  };

  const logout = () => {
    setRole("general_manager");
    localStorage.removeItem(STORAGE_KEY);
  };

  const user = DEMO_USERS[role];

  const hasPermission = (permission: string): boolean => {
    if (user.permissions.includes("all")) return true;
    return user.permissions.includes(permission);
  };

  const isAdmin = ["general_manager", "dept_manager_fb", "dept_manager_hk", "system_admin"].includes(role);
  const isStaff = role === "employee";
  const isGuest = role === "guest";

  if (!mounted) {
    // Avoid hydration mismatch by rendering default GM
    return (
      <AuthContext.Provider
        value={{
          user: DEMO_USERS.general_manager,
          role: "general_manager",
          login,
          logout,
          switchRole,
          hasPermission,
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
        login,
        logout,
        switchRole,
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
