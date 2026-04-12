'use client';

import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { usePermissions, type Permission } from '@/hooks/use-permissions';
import { Shield, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRoleConfig } from '@/lib/permissions';

interface RoleGateProps {
  /** Permission required to view this content */
  permission: Permission;
  /** Fallback when permission is denied (default: access denied message) */
  fallback?: React.ReactNode;
  /** Page to redirect to when access is denied */
  redirectTo?: 'dashboard' | 'scanner' | 'login';
  /** Children to render when permission is granted */
  children: React.ReactNode;
}

/**
 * RoleGate - Frontend RBAC guard component.
 * Renders children only if the current user has the required permission.
 * Otherwise shows an access denied message or custom fallback.
 */
export default function RoleGate({
  permission,
  fallback,
  redirectTo,
  children,
}: RoleGateProps) {
  const { role, roleConfig, has } = usePermissions();
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const granted = has(permission);

  if (granted) {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default: access denied message
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <ShieldAlert className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Accès restreint</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Votre rôle <strong>{roleConfig.emoji} {roleConfig.labelFr}</strong> n&apos;a pas
            la permission <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{permission}</code>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Contactez votre administrateur pour demander l&apos;accès à cette fonctionnalité.
          </p>
        </div>
        {redirectTo && (
          <Button
            variant="outline"
            onClick={() => setCurrentPage(redirectTo)}
          >
            <Shield className="h-4 w-4 mr-2" />
            Retour
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * AdminOnlyGate - Shortcut for admin-only content.
 * Grants access to admin and super_admin roles only.
 */
export function AdminOnlyGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <RoleGate permission="settings.edit" fallback={fallback}>
      {children}
    </RoleGate>
  );
}
