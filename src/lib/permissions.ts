// ============================================================
// 🔐 RBAC - Role-Based Access Control System
// ============================================================
// SmartTicketQR Client RBAC
// 4 client roles: Admin, Caisse (Vendeur), Contrôleur, Comptable
// ============================================================

// ── Client Role Types ────────────────────────────────────────────────────────

export type ClientRole = 'admin' | 'caisse' | 'controleur' | 'comptable';

export type SystemRole = 'super_admin' | ClientRole;

// ── Role Display Configuration ──────────────────────────────────────────────

export const ROLE_CONFIG: Record<string, {
  label: string;
  labelFr: string;
  emoji: string;
  color: string; // Tailwind classes for badge
  bgColor: string;
  description: string;
}> = {
  super_admin: {
    label: 'Super Admin',
    labelFr: 'Super Administrateur',
    emoji: '👑',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Accès complet à la plateforme',
  },
  admin: {
    label: 'Admin',
    labelFr: 'Administrateur',
    emoji: '👑',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    description: 'Accès complet au business de l\'organisation',
  },
  caisse: {
    label: 'Cashier',
    labelFr: 'Caisse (Vendeur)',
    emoji: '💰',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    description: 'Vente et création de tickets',
  },
  controleur: {
    label: 'Controller',
    labelFr: 'Contrôleur',
    emoji: '📱',
    color: 'text-sky-700 dark:text-sky-300',
    bgColor: 'bg-sky-100 dark:bg-sky-900/30',
    description: 'Scan et validation de tickets',
  },
  comptable: {
    label: 'Accountant',
    labelFr: 'Comptable',
    emoji: '📊',
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Consultation des revenus et rapports',
  },
};

// ── Permission Types ────────────────────────────────────────────────────────

export type Permission =
  // Dashboard
  | 'dashboard.view'
  | 'dashboard.view_sales'
  | 'dashboard.view_revenue'
  // Tickets
  | 'tickets.create'
  | 'tickets.view'
  | 'tickets.edit'
  | 'tickets.delete'
  | 'tickets.sell'
  // Scanner
  | 'scanner.use'
  | 'scanner.view_logs'
  // Events & Lines
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'lines.manage'
  // Finance
  | 'transactions.view'
  | 'transactions.view_own'
  | 'transactions.export'
  | 'reports.view'
  | 'reports.export'
  // Team
  | 'team.view'
  | 'team.create'
  | 'team.edit'
  | 'team.delete'
  // Display
  | 'display.view'
  | 'display.manage'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  // Logs
  | 'logs.activity'
  | 'logs.scan'
  | 'logs.audit'
  // System (API, Webhooks)
  | 'api_keys.manage'
  | 'webhooks.manage'
  // Data
  | 'data.delete';

// ── Permission Matrix ──────────────────────────────────────────────────────
// Key: admin / caisse / controleur / comptable
// true = granted, false = denied

export const PERMISSION_MATRIX: Record<ClientRole, Permission[]> = {
  admin: [
    // Admin sees everything within client scope
    'dashboard.view', 'dashboard.view_sales', 'dashboard.view_revenue',
    'tickets.create', 'tickets.view', 'tickets.edit', 'tickets.delete', 'tickets.sell',
    'scanner.use', 'scanner.view_logs',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'lines.manage',
    'transactions.view', 'transactions.export',
    'reports.view', 'reports.export',
    'team.view', 'team.create', 'team.edit', 'team.delete',
    'display.view', 'display.manage',
    'settings.view', 'settings.edit',
    'logs.activity', 'logs.scan',
    'api_keys.manage', 'webhooks.manage',
    'data.delete',
  ],
  caisse: [
    // Cashier: sell tickets, view today's sales, own transactions
    'dashboard.view', 'dashboard.view_sales',
    'tickets.create', 'tickets.view', 'tickets.sell',
    'events.view',
    'transactions.view_own',
    'logs.scan',
  ],
  controleur: [
    // Controller: scan/validate tickets ONLY
    'scanner.use', 'scanner.view_logs',
    'events.view',
  ],
  comptable: [
    // Accountant: view all revenue, stats, exports
    'dashboard.view', 'dashboard.view_revenue',
    'tickets.view',
    'events.view',
    'transactions.view', 'transactions.export',
    'reports.view', 'reports.export',
    'logs.scan',
    'logs.activity',
  ],
};

// ── Navigation Menu per Role ────────────────────────────────────────────────

export type NavPage = 
  | 'dashboard' | 'events' | 'tickets' | 'scanner' | 'display'
  | 'users' | 'transactions' | 'reports' | 'scan-logs'
  | 'settings' | 'activity-logs' | 'api-keys' | 'webhooks';

export interface RoleNavItem {
  id: NavPage;
  label: string;
  section: string;
}

const ADMIN_NAV: RoleNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', section: 'Vue d\'ensemble' },
  { id: 'events', label: 'Événements & Transport', section: 'Vue d\'ensemble' },
  { id: 'tickets', label: 'Tickets', section: 'Vue d\'ensemble' },
  { id: 'scanner', label: 'QR Scanner', section: 'Vue d\'ensemble' },
  { id: 'display', label: 'Affichage Public', section: 'Vue d\'ensemble' },
  { id: 'users', label: 'Gérer l\'Équipe', section: 'Opérations' },
  { id: 'transactions', label: 'Transactions', section: 'Suivi' },
  { id: 'reports', label: 'Rapports & Analyses', section: 'Suivi' },
  { id: 'scan-logs', label: 'Logs de Scan', section: 'Suivi' },
  { id: 'settings', label: 'Paramètres', section: 'Paramètres' },
  { id: 'activity-logs', label: 'Activité Récente', section: 'Logs' },
  { id: 'api-keys', label: 'Clés API', section: 'Paramètres' },
  { id: 'webhooks', label: 'Webhooks', section: 'Paramètres' },
];

const CAISSE_NAV: RoleNavItem[] = [
  { id: 'dashboard', label: 'Ventes du Jour', section: 'Caisse' },
  { id: 'events', label: 'Événements', section: 'Caisse' },
  { id: 'tickets', label: 'Vendre un Ticket', section: 'Caisse' },
  { id: 'transactions', label: 'Mes Transactions', section: 'Suivi' },
  { id: 'scan-logs', label: 'Derniers Scans', section: 'Suivi' },
];

const CONTROLEUR_NAV: RoleNavItem[] = [
  { id: 'scanner', label: 'Scanner & Valider', section: 'Contrôle' },
  { id: 'events', label: 'Événements', section: 'Contrôle' },
];

const COMPTABLE_NAV: RoleNavItem[] = [
  { id: 'dashboard', label: 'Tableau de Bord', section: 'Finance' },
  { id: 'transactions', label: 'Transactions', section: 'Finance' },
  { id: 'reports', label: 'Rapports', section: 'Finance' },
  { id: 'scan-logs', label: 'Logs de Scan', section: 'Finance' },
  { id: 'activity-logs', label: 'Activité Récente', section: 'Finance' },
];

export const NAV_BY_ROLE: Record<ClientRole, RoleNavItem[]> = {
  admin: ADMIN_NAV,
  caisse: CAISSE_NAV,
  controleur: CONTROLEUR_NAV,
  comptable: COMPTABLE_NAV,
};

// ── Permission Check Helpers ────────────────────────────────────────────────

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  if (role === 'super_admin') return true;
  if (role in PERMISSION_MATRIX) {
    return (PERMISSION_MATRIX as Record<string, Permission[]>)[role].includes(permission);
  }
  // Fallback: unknown roles have no permissions
  return false;
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  if (role === 'super_admin') return true;
  if (role in PERMISSION_MATRIX) {
    const rolePermissions = (PERMISSION_MATRIX as Record<string, Permission[]>)[role];
    return permissions.some((p) => rolePermissions.includes(p));
  }
  return false;
}

/**
 * Check if a role has ALL of the specified permissions
 */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  if (role === 'super_admin') return true;
  if (role in PERMISSION_MATRIX) {
    const rolePermissions = (PERMISSION_MATRIX as Record<string, Permission[]>)[role];
    return permissions.every((p) => rolePermissions.includes(p));
  }
  return false;
}

/**
 * Get navigation items for a given role
 */
export function getNavForRole(role: string): RoleNavItem[] {
  if (role === 'super_admin') return []; // Super admin uses its own nav
  if (role in NAV_BY_ROLE) {
    return (NAV_BY_ROLE as Record<string, RoleNavItem[]>)[role];
  }
  return [];
}

/**
 * Check if a role can access a specific page/module
 */
export function canAccessPage(role: string, pageId: string): boolean {
  if (role === 'super_admin') return true;
  const nav = getNavForRole(role);
  return nav.some((item) => item.id === pageId);
}

/**
 * Check if a role is a client role (not super_admin)
 */
export function isClientRole(role: string): boolean {
  return role in PERMISSION_MATRIX;
}

/**
 * Check if a role is an admin (full client access)
 */
export function isAdmin(role: string): boolean {
  return role === 'super_admin' || role === 'admin';
}

/**
 * Get role display info
 */
export function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] || {
    label: role,
    labelFr: role,
    emoji: '❓',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Rôle inconnu',
  };
}

/**
 * List all client roles (for admin team management)
 */
export const CLIENT_ROLES: ClientRole[] = ['admin', 'caisse', 'controleur', 'comptable'];

/**
 * Permission descriptions for UI
 */
export const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  'dashboard.view': { label: 'Dashboard', description: 'Accéder au tableau de bord' },
  'dashboard.view_sales': { label: 'Ventes du jour', description: 'Voir les statistiques de vente' },
  'dashboard.view_revenue': { label: 'Revenus', description: 'Voir les revenus et statistiques' },
  'tickets.create': { label: 'Créer ticket', description: 'Créer de nouveaux tickets' },
  'tickets.view': { label: 'Voir tickets', description: 'Consulter la liste des tickets' },
  'tickets.edit': { label: 'Modifier ticket', description: 'Modifier un ticket existant' },
  'tickets.delete': { label: 'Supprimer ticket', description: 'Supprimer un ticket' },
  'tickets.sell': { label: 'Vendre ticket', description: 'Vendre des tickets (point de vente)' },
  'scanner.use': { label: 'Scanner', description: 'Scanner et valider des tickets' },
  'scanner.view_logs': { label: 'Logs scanner', description: 'Voir l\'historique des scans' },
  'events.view': { label: 'Voir événements', description: 'Consulter les événements' },
  'events.create': { label: 'Créer événement', description: 'Créer de nouveaux événements' },
  'events.edit': { label: 'Modifier événement', description: 'Modifier un événement' },
  'events.delete': { label: 'Supprimer événement', description: 'Supprimer un événement' },
  'lines.manage': { label: 'Gérer lignes', description: 'Gérer les lignes de transport' },
  'transactions.view': { label: 'Voir transactions', description: 'Consulter toutes les transactions' },
  'transactions.view_own': { label: 'Mes transactions', description: 'Voir ses propres transactions' },
  'transactions.export': { label: 'Exporter transactions', description: 'Exporter les données financières' },
  'reports.view': { label: 'Voir rapports', description: 'Consulter les rapports' },
  'reports.export': { label: 'Exporter rapports', description: 'Exporter les rapports (PDF, CSV)' },
  'team.view': { label: 'Voir équipe', description: 'Voir la liste des membres' },
  'team.create': { label: 'Ajouter membre', description: 'Ajouter un membre à l\'équipe' },
  'team.edit': { label: 'Modifier membre', description: 'Modifier un membre de l\'équipe' },
  'team.delete': { label: 'Supprimer membre', description: 'Supprimer un membre de l\'équipe' },
  'display.view': { label: 'Voir affichage', description: 'Voir les écrans d\'affichage public' },
  'display.manage': { label: 'Gérer affichage', description: 'Configurer les écrans d\'affichage' },
  'settings.view': { label: 'Voir paramètres', description: 'Consulter les paramètres' },
  'settings.edit': { label: 'Modifier paramètres', description: 'Modifier les paramètres de l\'organisation' },
  'logs.activity': { label: 'Logs activité', description: 'Consulter les logs d\'activité' },
  'logs.scan': { label: 'Logs scan', description: 'Consulter les logs de scan' },
  'api_keys.manage': { label: 'Clés API', description: 'Gérer les clés API' },
  'webhooks.manage': { label: 'Webhooks', description: 'Gérer les webhooks' },
  'data.delete': { label: 'Supprimer données', description: 'Supprimer des données sensibles' },
};
