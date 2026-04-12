'use client';

import { useAuthStore } from '@/store/auth-store';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  canAccessPage as checkPageAccess,
  getRoleConfig,
  isAdmin as checkIsAdmin,
  isClientRole,
  type Permission,
  type ClientRole,
} from '@/lib/permissions';

/**
 * Hook for checking RBAC permissions on the client side.
 * Uses the current user's role from the auth store.
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'operator';

  return {
    role,
    roleConfig: getRoleConfig(role),
    isSuperAdmin: role === 'super_admin',
    isAdmin: checkIsAdmin(role),
    isClient: isClientRole(role),

    /**
     * Check if the current user has a specific permission
     */
    has: (permission: Permission): boolean => checkPermission(role, permission),

    /**
     * Check if the current user has any of the specified permissions
     */
    hasAny: (permissions: Permission[]): boolean => checkAnyPermission(role, permissions),

    /**
     * Check if the current user has all of the specified permissions
     */
    hasAll: (permissions: Permission[]): boolean => checkAllPermissions(role, permissions),

    /**
     * Check if the current user can access a specific page
     */
    canAccessPage: (pageId: string): boolean => checkPageAccess(role, pageId),
  };
}

/**
 * Simplified hook that returns just whether the user has specific permissions.
 * Useful for conditional rendering in components.
 */
export function useCan(permission: Permission): boolean {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'operator';
  return checkPermission(role, permission);
}

/**
 * Hook that returns whether the user can access any of the given permissions.
 */
export function useCanAny(permissions: Permission[]): boolean {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || 'operator';
  return checkAnyPermission(role, permissions);
}
