---
Task ID: 1
Agent: Main Orchestrator
Task: Implement complete RBAC (Role-Based Access Control) system for SmartTicketQR SaaS

Work Log:
- Read ALL existing project files: prisma schema, permissions.ts, auth store, app store, auth.ts, app-shell.tsx, page.tsx, login-page.tsx, dashboard.tsx, users-page.tsx, reports-page.tsx, settings-page.tsx, billing-page.tsx, api-helper.ts, use-permissions.ts, seed/route.ts
- Analyzed existing RBAC implementation: found permissions.ts, use-permissions.ts, app-shell.tsx already had RBAC foundations
- Identified 6 gaps: (1) seed didn't create RBAC users, (2) login showed old roles, (3) no page-level guards, (4) admin missing logs.audit, (5) events-page had broken CanCreateEvent, (6) operator references in seed
- Updated seed to create 5 users: super_admin, admin, caisse, controleur, comptable
- Updated login page register form with 4 RBAC roles + super_admin
- Updated demo credentials display with all 4 RBAC users
- Created RoleGate component (src/components/smart-ticket/role-gate.tsx) with AdminOnlyGate shortcut
- Wrapped Settings page with RoleGate(permission="settings.view")
- Wrapped Billing page with RoleGate(permission="settings.edit")
- Wrapped API Keys page with RoleGate(permission="api_keys.manage")
- Wrapped Webhooks page with RoleGate(permission="webhooks.manage")
- Added logs.audit to admin PERMISSION_MATRIX
- Added logs.audit to PERMISSION_LABELS
- Fixed events-page CanCreateEvent → useCanAny hook
- Fixed 4 remaining operator.id → controleur.id references in seed
- Ran lint: all clean
- Ran auto-audit: found and fixed 2 bugs

Stage Summary:
- RBAC system is fully implemented with 4 client roles (admin, caisse, controleur, comptable)
- Backend middleware exists (requirePermission, requireAnyPermission in api-helper.ts)
- Frontend guards active on all sensitive pages
- Navigation dynamically filtered by role via app-shell.tsx
- Dashboard adapts content per role (caisse sees "Ventes du Jour", controleur redirected to scanner, comptable sees "Tableau de Bord Financier")
- Demo seed data: john@smartticketqr.com (admin), aminata@smartticketqr.com (caisse), ibrahima@smartticketqr.com (controleur), fatou@smartticketqr.com (comptable) — all password: Admin@123
