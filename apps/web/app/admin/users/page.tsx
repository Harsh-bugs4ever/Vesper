"use client";

import React, { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-context";
import {
  UserRole,
  User,
  PERMISSIONS_LIST,
  PERMISSION_DOMAINS,
  RESORT_STAFF_DIRECTORY,
  DEFAULT_ROLE_PERMISSIONS,
} from "@/lib/auth";
import {
  Users,
  ShieldCheck,
  KeyRound,
  Search,
  Filter,
  UserPlus,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Lock,
  ArrowRightLeft,
  Mail,
  Building2,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  Info,
  Save,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessDeniedCard } from "@/components/auth/role-guard";
import { cn } from "@/lib/utils";

export default function UsersAndPermissionsPage() {
  const { user, role, rolePermissions, updateRolePermissions, resetPermissions, switchRole } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"directory" | "roles" | "matrix">("directory");

  // User Directory State
  const [usersList, setUsersList] = useState<User[]>(RESORT_STAFF_DIRECTORY);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserDept, setNewUserDept] = useState("Housekeeping");
  const [newUserRole, setNewUserRole] = useState<UserRole>("employee");
  const [newUserShift, setNewUserShift] = useState("Morning (07:00 - 15:30)");

  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Permission Matrix State
  const [matrixState, setMatrixState] = useState<Record<UserRole, string[]>>(rolePermissions);
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>("all");
  const [matrixSearch, setMatrixSearch] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Synchronize matrixState when rolePermissions updates from context
  React.useEffect(() => {
    setMatrixState(rolePermissions);
  }, [rolePermissions]);

  // Check access: Only General Manager and System Admin can manage permissions
  const isAuthorizedAdmin = ["general_manager", "system_admin"].includes(role);

  // Filtered Users Directory
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        u.roleTitle.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDept =
        departmentFilter === "all" ||
        (u.department && u.department.toLowerCase().includes(departmentFilter.toLowerCase()));

      const matchesRole = roleFilter === "all" || u.role === roleFilter;

      return matchesSearch && matchesDept && matchesRole;
    });
  }, [usersList, searchQuery, departmentFilter, roleFilter]);

  // Handlers for User Directory
  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    const newUser: User = {
      id: `usr_${Date.now().toString().slice(-4)}`,
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      roleTitle:
        newUserRole === "employee"
          ? `${newUserDept} Attendant`
          : newUserRole === "dept_manager_fb"
          ? "F&B Manager"
          : newUserRole === "dept_manager_hk"
          ? "Executive Housekeeper"
          : newUserRole === "system_admin"
          ? "Systems Administrator"
          : "General Manager",
      department: newUserDept,
      propertyId: "prop_mumbai_01",
      propertyName: "JW Marriott Mumbai, Juhu",
      shift: newUserShift,
      status: "active",
      permissions: matrixState[newUserRole] || [],
    };

    setUsersList((prev) => [newUser, ...prev]);
    setShowInviteModal(false);
    setNewUserName("");
    setNewUserEmail("");

    showToast({
      title: `Team Member Invited: ${newUser.name}`,
      description: `Assigned role ${newUser.roleTitle} in ${newUser.department}. Credentials emailed.`,
      type: "success",
    });
  };

  const handleUpdateUserRole = (newRole: UserRole) => {
    if (!editingUser) return;

    setUsersList((prev) =>
      prev.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              role: newRole,
              roleTitle:
                newRole === "employee"
                  ? `${u.department || "Floor"} Attendant`
                  : newRole === "dept_manager_fb"
                  ? "F&B Manager"
                  : newRole === "dept_manager_hk"
                  ? "Executive Housekeeper"
                  : newRole === "system_admin"
                  ? "System Administrator"
                  : "General Manager",
              permissions: matrixState[newRole] || [],
            }
          : u
      )
    );

    showToast({
      title: `Role Updated for ${editingUser.name}`,
      description: `Account elevated/reassigned to ${newRole}.`,
      type: "success",
    });

    setEditingUser(null);
  };

  const handleSimulateLoginAs = (targetUser: User) => {
    switchRole(targetUser.role);
    showToast({
      title: `Simulated Login: ${targetUser.name}`,
      description: `Active session flipped to ${targetUser.roleTitle} (${targetUser.role}).`,
      type: "default",
    });
  };

  // Handlers for Permission Matrix
  const handleTogglePermission = (targetRole: UserRole, permKey: string) => {
    setMatrixState((prev) => {
      const currentRolePerms = prev[targetRole] || [];
      const hasPerm = currentRolePerms.includes(permKey) || currentRolePerms.includes("all");

      let updatedRolePerms: string[];
      if (hasPerm) {
        // If it was "all", expand all permissions except this one
        if (currentRolePerms.includes("all")) {
          updatedRolePerms = PERMISSIONS_LIST.map((p) => p.key).filter((k) => k !== permKey);
        } else {
          updatedRolePerms = currentRolePerms.filter((k) => k !== permKey);
        }
      } else {
        updatedRolePerms = [...currentRolePerms, permKey];
      }

      setHasUnsavedChanges(true);
      return {
        ...prev,
        [targetRole]: updatedRolePerms,
      };
    });
  };

  const handleSaveMatrix = () => {
    // Commit all roles to context and localStorage
    (Object.keys(matrixState) as UserRole[]).forEach((r) => {
      updateRolePermissions(r, matrixState[r]);
    });

    setHasUnsavedChanges(false);
    showToast({
      title: "Permission Matrix Saved",
      description: "Updated access rules and operational thresholds across all 6 roles.",
      type: "success",
    });
  };

  const handleResetMatrix = () => {
    resetPermissions();
    setMatrixState(DEFAULT_ROLE_PERMISSIONS);
    setHasUnsavedChanges(false);
    showToast({
      title: "Matrix Reset to Defaults",
      description: "Restored baseline Vesper Smart Resort 360 permission matrix.",
      type: "default",
    });
  };

  // Filtered Permissions for Matrix view
  const filteredPermissions = useMemo(() => {
    return PERMISSIONS_LIST.filter((p) => {
      const matchesDomain = matrixCategoryFilter === "all" || p.domain === matrixCategoryFilter;
      const matchesSearch =
        p.label.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        p.key.toLowerCase().includes(matrixSearch.toLowerCase()) ||
        p.description.toLowerCase().includes(matrixSearch.toLowerCase());
      return matchesDomain && matchesSearch;
    });
  }, [matrixCategoryFilter, matrixSearch]);

  const rolesColumnList: { role: UserRole; label: string; badge: string; variant: "gold" | "sage" | "sand" | "outline" }[] = [
    { role: "system_admin", label: "Admin", badge: "IT Systems", variant: "outline" },
    { role: "general_manager", label: "General Mgr", badge: "Executive", variant: "gold" },
    { role: "dept_manager_fb", label: "F&B Mgr", badge: "Dining/Kitchen", variant: "sage" },
    { role: "dept_manager_hk", label: "Housekeeping", badge: "Rooms", variant: "sage" },
    { role: "employee", label: "Staff", badge: "Attendant", variant: "sand" },
    { role: "guest", label: "Guest", badge: "Room QR", variant: "gold" },
  ];

  if (!isAuthorizedAdmin) {
    return (
      <div className="space-y-6">
        <AccessDeniedCard
          title="Governance Deck Restricted"
          message="User account provisioning and permission matrix editing are restricted to General Managers and System Administrators."
          currentRole={user.roleTitle}
          requiredPermission="roles:manage or users:manage"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-sage-50 via-sand-50 to-gold-50/40 p-6 rounded-2xl border border-sand-200 shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-sage-800 uppercase tracking-wider">
              Governance & Security
            </span>
            <span className="text-sand-300">·</span>
            <Badge variant="sage" className="text-[10px] py-0 px-2">
              Day 2 Permissions Engine
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-sand-950 font-serif">
            Users & Roles Governance
          </h1>
          <p className="text-xs sm:text-sm text-sand-600 mt-1 max-w-2xl">
            Audit staff accounts, configure role hierarchies, and define granular action permissions for the 145-key resort.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "matrix" && hasUnsavedChanges && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveMatrix}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-soft animate-pulse"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              Save Matrix Changes
            </Button>
          )}

          {activeTab === "directory" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowInviteModal(true)}
            >
              <UserPlus className="w-3.5 h-3.5 mr-1" />
              Invite Team Member
            </Button>
          )}

          {activeTab === "matrix" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetMatrix}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset Matrix
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center justify-between border-b border-sand-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("directory")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
              activeTab === "directory"
                ? "bg-sage-700 text-white shadow-soft"
                : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
            )}
          >
            <Users className="w-4 h-4" />
            <span>Staff Directory ({usersList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0",
              activeTab === "roles"
                ? "bg-sage-700 text-white shadow-soft"
                : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Roles & Hierarchy (6)</span>
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 relative",
              activeTab === "matrix"
                ? "bg-sage-700 text-white shadow-soft"
                : "text-sand-600 hover:text-sand-950 hover:bg-sand-100"
            )}
          >
            <KeyRound className="w-4 h-4" />
            <span>Permission Matrix Editor</span>
            {hasUnsavedChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1.5 right-1.5 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: USER DIRECTORY */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-sand-200 shadow-soft">
              <span className="text-[11px] font-semibold text-sand-500 uppercase block">
                Total Staff Roster
              </span>
              <span className="text-xl font-bold text-sand-950 font-sans mt-0.5 block tabular-nums">
                180 Personnel
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-sand-200 shadow-soft">
              <span className="text-[11px] font-semibold text-sand-500 uppercase block">
                Active On Shift
              </span>
              <span className="text-xl font-bold text-emerald-700 font-sans mt-0.5 flex items-center gap-1.5 tabular-nums">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                44 Active
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-sand-200 shadow-soft">
              <span className="text-[11px] font-semibold text-sand-500 uppercase block">
                Resort Departments
              </span>
              <span className="text-xl font-bold text-sand-950 font-sans mt-0.5 block tabular-nums">
                6 Divisions
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-sand-200 shadow-soft">
              <span className="text-[11px] font-semibold text-sand-500 uppercase block">
                PMS / HR Sync
              </span>
              <span className="text-xl font-bold text-sage-800 font-sans mt-0.5 block tabular-nums">
                100% Synced
              </span>
            </div>
          </div>

          {/* Search & Department Filters */}
          <div className="p-4 rounded-xl bg-white border border-sand-200 shadow-soft flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, email, department, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-sand-50/70 border border-sand-200 text-xs text-sand-950 placeholder:text-sand-400 focus:outline-none focus:ring-1 focus:ring-sage-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sand-400 hover:text-sand-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-medium text-sand-500 shrink-0">Dept:</span>
              {["all", "Housekeeping", "Food & Beverage", "Front Office", "Engineering", "IT & Systems"].map(
                (dept) => (
                  <button
                    key={dept}
                    onClick={() => setDepartmentFilter(dept)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0",
                      departmentFilter === dept
                        ? "bg-sage-100 text-sage-900 border border-sage-300 font-semibold"
                        : "text-sand-600 hover:bg-sand-100 border border-transparent"
                    )}
                  >
                    {dept === "all" ? "All Departments" : dept}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <EmptyState
              title="No Team Members Found"
              description={`No staff profiles matching query "${searchQuery}". Try clearing filters or search parameters.`}
              actionLabel="Clear Search"
              onAction={() => {
                setSearchQuery("");
                setDepartmentFilter("all");
                setRoleFilter("all");
              }}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-sand-200 shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-sand-700">
                  <thead className="bg-sand-50/80 border-b border-sand-200 text-[11px] uppercase font-bold text-sand-500 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Staff Member</th>
                      <th className="py-3.5 px-4">Role & Elevation</th>
                      <th className="py-3.5 px-4">Department & Shift</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Operational Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sand-100">
                    {filteredUsers.map((u) => {
                      const isCurrentActive = user.email === u.email;

                      return (
                        <tr
                          key={u.id}
                          className={cn(
                            "hover:bg-sand-50/60 transition-colors group",
                            isCurrentActive && "bg-sage-50/40"
                          )}
                        >
                          {/* Name & Avatar */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <div className="w-9 h-9 rounded-xl bg-sand-100 border border-sand-200 flex items-center justify-center font-bold text-sage-800 text-xs shadow-xs">
                                  {u.name.split(" ").map((n) => n[0]).join("")}
                                </div>
                                <span
                                  className={cn(
                                    "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
                                    u.status === "on_shift" && "bg-emerald-500 animate-pulse",
                                    u.status === "active" && "bg-blue-500",
                                    u.status === "off_duty" && "bg-sand-400"
                                  )}
                                />
                              </div>

                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sand-950 group-hover:text-sage-950">
                                    {u.name}
                                  </span>
                                  {isCurrentActive && (
                                    <Badge variant="sage" className="text-[9px] py-0 px-1">
                                      You
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[11px] text-sand-500 flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3 text-sand-400" />
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <div>
                              <Badge
                                variant={
                                  u.role === "general_manager"
                                    ? "gold"
                                    : u.role === "system_admin"
                                    ? "outline"
                                    : u.role === "employee"
                                    ? "sand"
                                    : "sage"
                                }
                                className="text-[10px] font-semibold"
                              >
                                {u.roleTitle}
                              </Badge>
                              <p className="text-[10px] text-sand-400 mt-1 font-mono">
                                {u.role}
                              </p>
                            </div>
                          </td>

                          {/* Department & Shift */}
                          <td className="py-3.5 px-4">
                            <div>
                              <span className="font-medium text-sand-900 block">
                                {u.department || "General Staff"}
                              </span>
                              <span className="text-[11px] text-sand-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-sand-400" />
                                {u.shift || "Regular (09:00 - 18:00)"}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                                u.status === "on_shift" && "bg-emerald-50 text-emerald-800 border border-emerald-200",
                                u.status === "active" && "bg-blue-50 text-blue-800 border border-blue-200",
                                u.status === "off_duty" && "bg-sand-100 text-sand-700 border border-sand-200"
                              )}
                            >
                              {u.status === "on_shift"
                                ? "On Duty"
                                : u.status === "active"
                                ? "Active"
                                : "Off Duty"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingUser(u)}
                                className="h-7 px-2 text-[11px]"
                              >
                                Edit Role
                              </Button>

                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSimulateLoginAs(u)}
                                className="h-7 px-2 text-[11px] bg-sand-100 hover:bg-sage-100 text-sage-900"
                                title="Switch session to this user to view resort from their perspective"
                              >
                                <ArrowRightLeft className="w-3 h-3 mr-1 text-sage-600" />
                                Login As
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES & HIERARCHY */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <p className="text-xs text-sand-600">
            Vesper uses a 5-tier role-based access control (RBAC) hierarchy. Permissions can be customized in the Permission Matrix.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* System Administrator */}
            <Card className="border-sand-200 shadow-soft bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">
                    Level 1 · System Owner
                  </Badge>
                  <KeyRound className="w-4 h-4 text-sand-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  System Administrator
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">system_admin</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Responsible for IT infrastructure, permission matrix configuration, resort keys setup, PMS/BMS connectors, and full cryptographic audit ledger access.
                </p>
                <div className="p-2.5 rounded-lg bg-sand-50 border border-sand-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Default Staff Count:</span>
                    <span className="font-semibold text-sand-900">2 Personnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Granted Privileges:</span>
                    <span className="font-semibold text-sage-800">Governance & Systems</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* General Manager */}
            <Card className="border-gold-300 shadow-soft bg-gradient-to-br from-white to-gold-50/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="gold" className="text-[10px]">
                    Level 2 · Executive Office
                  </Badge>
                  <ShieldCheck className="w-4 h-4 text-gold-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  General Manager / Owner
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">general_manager</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Supreme operational and financial decision maker. Approves AI rate cards, high-impact procurement orders (&gt;₹50,000), and inspects full resort analytics.
                </p>
                <div className="p-2.5 rounded-lg bg-gold-50/60 border border-gold-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Default Staff Count:</span>
                    <span className="font-semibold text-sand-900">1 Personnel (Arjun Mehta)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Special Privilege:</span>
                    <span className="font-semibold text-gold-900">10s Safe Undo on AI Actions</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* F&B Manager */}
            <Card className="border-sand-200 shadow-soft bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="sage" className="text-[10px]">
                    Level 3 · Department Lead
                  </Badge>
                  <Building2 className="w-4 h-4 text-sage-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  Food & Beverage Manager
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">dept_manager_fb</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Supervises kitchen orders, dining SLA timers, ingredient low-par auto-deductions, and F&B staff shift attendance.
                </p>
                <div className="p-2.5 rounded-lg bg-sand-50 border border-sand-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Default Staff Count:</span>
                    <span className="font-semibold text-sand-900">48 Personnel (4 Outlets)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Scope Restriction:</span>
                    <span className="font-semibold text-sand-800">Cannot modify room rates</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Housekeeping Manager */}
            <Card className="border-sand-200 shadow-soft bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="sage" className="text-[10px]">
                    Level 3 · Department Lead
                  </Badge>
                  <Sparkles className="w-4 h-4 text-sage-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  Executive Housekeeper
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">dept_manager_hk</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Directs the live 145-room board (dirty → cleaning → ready), floor attendant checklists, turnover inspections, and linen par levels.
                </p>
                <div className="p-2.5 rounded-lg bg-sand-50 border border-sand-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Default Staff Count:</span>
                    <span className="font-semibold text-sand-900">55 Attendants</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Key Feature:</span>
                    <span className="font-semibold text-sage-800">Live Turnover Room Board</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Floor Attendant / Employee */}
            <Card className="border-sand-200 shadow-soft bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="sand" className="text-[10px]">
                    Level 4 · Floor Operations
                  </Badge>
                  <Users className="w-4 h-4 text-emerald-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  Floor Attendant / Staff
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">employee</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Mobile-first staff portal view: marks GPS attendance, checks off room cleaning tasks, flips status by QR scan, and snaps photo issue reports.
                </p>
                <div className="p-2.5 rounded-lg bg-sand-50 border border-sand-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Default Staff Count:</span>
                    <span className="font-semibold text-sand-900">~150 Field Personnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Access Boundary:</span>
                    <span className="font-semibold text-sand-800">Redirected to /staff</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* In-House Guest */}
            <Card className="border-sand-200 shadow-soft bg-white">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="gold" className="text-[10px]">
                    Level 5 · Transient
                  </Badge>
                  <Info className="w-4 h-4 text-gold-600" />
                </div>
                <CardTitle className="text-lg text-sand-950 mt-1">
                  In-House Guest (QR Companion)
                </CardTitle>
                <CardDescription className="text-xs text-sand-500">
                  Role: <span className="font-mono">guest</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-sand-700">
                <p>
                  Tokenized nightstand QR access: order dining, request cleaning, chat with RAG AI concierge. No password or login required.
                </p>
                <div className="p-2.5 rounded-lg bg-sand-50 border border-sand-200 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sand-500">Active Keys:</span>
                    <span className="font-semibold text-sand-900">112 Stays Occupied</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sand-500">Scope:</span>
                    <span className="font-semibold text-gold-900">Restricted to room token</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 3: PERMISSION MATRIX EDITOR */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          {/* Matrix Controls & Search */}
          <div className="p-4 rounded-xl bg-white border border-sand-200 shadow-soft flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-sand-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search permissions by name, key, or category..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-sand-50/70 border border-sand-200 text-xs text-sand-950 placeholder:text-sand-400 focus:outline-none focus:ring-1 focus:ring-sage-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-medium text-sand-500 shrink-0">Category:</span>
              <select
                value={matrixCategoryFilter}
                onChange={(e) => setMatrixCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-sand-50 border border-sand-200 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                <option value="all">All Domains (8)</option>
                {PERMISSION_DOMAINS.map((dom) => (
                  <option key={dom.id} value={dom.id}>
                    {dom.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="bg-white rounded-2xl border border-sand-200 shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-sand-800">
                <thead className="bg-sand-50/80 border-b border-sand-200 text-[11px] font-bold text-sand-600">
                  <tr>
                    <th className="py-4 px-4 min-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-sage-600" />
                        <span>Permission Privilege</span>
                      </div>
                    </th>
                    {rolesColumnList.map((col) => (
                      <th key={col.role} className="py-4 px-3 text-center min-w-[110px]">
                        <div>
                          <span className="block font-bold text-sand-950">{col.label}</span>
                          <span className="text-[10px] text-sand-400 font-mono font-normal">
                            {col.badge}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-sand-100">
                  {PERMISSION_DOMAINS.filter(
                    (d) => matrixCategoryFilter === "all" || d.id === matrixCategoryFilter
                  ).map((domain) => {
                    const domainPerms = filteredPermissions.filter((p) => p.domain === domain.id);
                    if (domainPerms.length === 0) return null;

                    return (
                      <React.Fragment key={domain.id}>
                        {/* Domain Category Separator Header */}
                        <tr className="bg-sage-50/40 border-y border-sand-200/80">
                          <td
                            colSpan={rolesColumnList.length + 1}
                            className="py-2.5 px-4 font-bold text-xs text-sage-950 font-serif tracking-wide"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-sage-600" />
                                {domain.label}
                              </span>
                              <span className="text-[11px] font-sans font-normal text-sand-500">
                                {domain.description}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Domain Permission Items */}
                        {domainPerms.map((perm) => (
                          <tr
                            key={perm.key}
                            className="hover:bg-sand-50/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sand-950">
                                    {perm.label}
                                  </span>
                                  {perm.isHighImpact && (
                                    <Badge
                                      variant="gold"
                                      className="text-[9px] py-0 px-1 bg-amber-100 border-amber-300 text-amber-900"
                                      title="High-Impact Financial or Configuration Action requiring executive guardrail"
                                    >
                                      ⚠️ High-Impact
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-sand-500 leading-snug">
                                  {perm.description}
                                </p>
                                <span className="text-[10px] font-mono text-sand-400">
                                  {perm.key}
                                </span>
                              </div>
                            </td>

                            {/* Toggles for Each Role */}
                            {rolesColumnList.map((col) => {
                              const rolePerms = matrixState[col.role] || [];
                              const isGranted =
                                rolePerms.includes("all") || rolePerms.includes(perm.key);
                              const isGmAll = col.role === "general_manager" && rolePerms.includes("all");

                              return (
                                <td
                                  key={col.role}
                                  className="py-3 px-3 text-center align-middle"
                                >
                                  <button
                                    onClick={() => handleTogglePermission(col.role, perm.key)}
                                    disabled={isGmAll}
                                    title={
                                      isGmAll
                                        ? "General Manager holds all wildcard permissions"
                                        : `Toggle ${perm.label} for ${col.label}`
                                    }
                                    className={cn(
                                      "w-7 h-7 rounded-lg inline-flex items-center justify-center transition-all border shadow-2xs",
                                      isGranted
                                        ? "bg-sage-600 border-sage-700 text-white hover:bg-sage-700"
                                        : "bg-white border-sand-200 text-sand-300 hover:border-sand-400 hover:text-sand-500",
                                      isGmAll && "opacity-75 cursor-not-allowed bg-gold-500 border-gold-600 text-sand-950"
                                    )}
                                  >
                                    {isGranted ? (
                                      <Check className="w-4 h-4 stroke-[2.5]" />
                                    ) : (
                                      <X className="w-3.5 h-3.5 stroke-[2]" />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INVITE TEAM MEMBER MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-md w-full p-6 shadow-elevated animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-sand-200">
              <h3 className="text-lg font-bold text-sand-950 font-serif">
                Invite Resort Team Member
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-sand-400 hover:text-sand-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-4 pt-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-sand-800">Full Name</label>
                <Input
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-sand-800">Work Email</label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="name@vesperresorts.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-sand-800">Department</label>
                  <select
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
                  >
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Front Office">Front Office</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Security">Security</option>
                    <option value="IT & Systems">IT & Systems</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-sand-800">Role Elevation</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
                  >
                    <option value="employee">Floor Attendant (Staff)</option>
                    <option value="dept_manager_hk">Housekeeping Lead</option>
                    <option value="dept_manager_fb">F&B Manager</option>
                    <option value="system_admin">System Administrator</option>
                    <option value="general_manager">General Manager</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-sand-800">Assigned Shift</label>
                <select
                  value={newUserShift}
                  onChange={(e) => setNewUserShift(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-sand-50 border border-sand-200 text-xs font-medium text-sand-900 focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="Morning (07:00 - 15:30)">Morning Shift (07:00 - 15:30)</option>
                  <option value="Afternoon (14:30 - 23:00)">Afternoon Shift (14:30 - 23:00)</option>
                  <option value="Night (22:30 - 07:00)">Night Shift (22:30 - 07:00)</option>
                  <option value="General (09:00 - 18:00)">General Office (09:00 - 18:00)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-sand-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm">
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROLE MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-sand-200 max-w-sm w-full p-6 shadow-elevated animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-sand-200">
              <div>
                <h3 className="text-base font-bold text-sand-950 font-serif">
                  Reassign Role
                </h3>
                <p className="text-[11px] text-sand-500">{editingUser.name}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-sand-400 hover:text-sand-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-2">
              <p className="text-sand-600 mb-2">Select new role elevation for this account:</p>

              {(["employee", "dept_manager_hk", "dept_manager_fb", "system_admin", "general_manager"] as UserRole[]).map(
                (r) => (
                  <button
                    key={r}
                    onClick={() => handleUpdateUserRole(r)}
                    className={cn(
                      "w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-all",
                      editingUser.role === r
                        ? "bg-sage-50 border-sage-400 font-bold text-sage-950 shadow-2xs"
                        : "bg-white border-sand-200 text-sand-800 hover:bg-sand-50"
                    )}
                  >
                    <span className="capitalize">{r.replace("_", " ")}</span>
                    {editingUser.role === r && <Check className="w-4 h-4 text-sage-600" />}
                  </button>
                )
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
