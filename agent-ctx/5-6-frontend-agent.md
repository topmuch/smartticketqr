# Task ID: 5-6 — Frontend Agent

## Task: Build API Keys management UI page for SmartTicketQR Phase 5

### Work Log
- Read worklog.md to understand full project context (Phases 1-5, multi-tenant architecture)
- Studied reference pages: scan-logs-page.tsx and audit-logs-page.tsx for consistent patterns
- Read API route source files (/api/api-keys and /api/api-keys/[id]) to understand response shapes
- Confirmed PageName already includes 'api-keys' in app-store.ts
- Confirmed all needed UI components exist (Dialog, AlertDialog, Table, Badge, Checkbox, Select, Tooltip, DropdownMenu, Separator, etc.)

### Created File
**`src/components/smart-ticket/api-keys-page.tsx`** (~1060 lines)

### Features Implemented

1. **Stats Cards Row** (3 cards with Framer Motion):
   - Total Keys count
   - Active Keys count with green badge showing % active
   - Revoked/Expired Keys count with conditional red/green badge

2. **API Keys Table (Desktop) + Cards (Mobile)**:
   - Key prefix display with mask/unmask toggle (Eye/EyeOff icons)
   - Name column
   - Permission badges (Read = sky/blue, Write = orange)
   - Rate limit display with Zap icon tooltip
   - Status badge (Active = green, Expired = red, Expiring Soon = amber, Revoked = gray)
   - Last Used (relative time via date-fns formatDistanceToNow)
   - Expires At (formatted date or "Never", with color coding for expired/expiring)
   - Created date (MMM d, yyyy)
   - Dropdown menu actions per row (Edit, Rotate, Revoke)

3. **Create API Key Dialog**:
   - Name input (required, max 100 chars)
   - Permissions checkboxes: Read, Write with descriptions
   - Rate limit number input (1-10000, default 100)
   - Optional expiry date picker (min = today)
   - Loading state on submit button

4. **New Key Reveal Dialog**:
   - Amber warning box: "Make sure to copy your API key now"
   - Raw key in dark code block (font-mono, break-all, selectable)
   - COPY button with Check/Copy icon toggle
   - Key details summary (name, prefix, permissions, rate limit, expiry)
   - "I Have Saved My Key" dismiss button (emerald)
   - `onPointerDownOutside` prevention to avoid accidental dismissal

5. **Edit API Key Dialog**:
   - Displays current key info in muted box
   - Edit name, permissions (checkboxes), rate limit
   - Disabled when key is revoked

6. **Revoke Confirmation (AlertDialog)**:
   - Warning with key name
   - Red "This action is irreversible" box
   - Cancel/Revoke Key buttons

7. **Rotate Key Action**:
   - Confirmation AlertDialog explaining rotation steps
   - Amber "What happens during rotation" box with bullet points
   - Mutation: DELETE old key → POST new key → show reveal dialog

### Design & Patterns
- `'use client'` directive
- TanStack Query: useQuery for list, useMutation for create/update/revoke/rotate
- All API calls use `getApiHeaders()` with Authorization + X-Organization-Id
- shadcn/ui components throughout (Card, Table, Dialog, AlertDialog, Badge, Button, Input, Label, Checkbox, Select, Separator, Tooltip, DropdownMenu, Skeleton)
- Framer Motion: card entry animations, table row AnimatePresence
- Responsive: Table on desktop (hidden md:block), Cards on mobile (md:hidden)
- Emerald primary color scheme consistent with app
- Sonner toast notifications for all actions
- Lucide icons: Key, KeyRound, Copy, Check, AlertTriangle, Plus, RotateCw, Trash2, Eye, EyeOff, Shield, Clock, Zap, Globe, RefreshCw, Search, MoreHorizontal, Pencil
- Search filter + status filter (All/Active/Revoked)
- Security best practices info card at bottom
- Admin-only controls (create, edit, rotate, revoke) checked via `user.role`
- `cn()` utility for conditional classNames
- Proper TypeScript typing throughout

### Lint Check
- ESLint: 0 errors ✅
- Dev server compiles successfully on port 3000 ✅
