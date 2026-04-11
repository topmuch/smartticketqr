# Task ID: 5-7 — Frontend Agent
# Task: Build Webhooks management UI page for SmartTicketQR Phase 5

## Work Log
- Read `/home/z/my-project/worklog.md` to understand full project history and context
- Read existing page components (api-keys-page.tsx, activity-logs-page.tsx, reports-page.tsx, app-shell.tsx) to understand patterns
- Created `src/components/smart-ticket/webhooks-page.tsx` with comprehensive webhook management UI
- Ran `bun run lint` — 0 errors
- Dev server compiles successfully

## File Created
- **src/components/smart-ticket/webhooks-page.tsx** (~680 lines)

## Component Structure

### Types
- `WebhookEndpoint` — id, url, events[], isActive, createdAt, totalLogs
- `WebhookLog` — id, endpointId, endpointUrl, eventType, httpStatus, attempts, status, createdAt, nextRetryAt
- `WebhookLogsResponse` — data + meta with pagination

### Constants
- `ALLOWED_EVENT_TYPES` — 6 event types (ticket.created/validated/cancelled, subscription.created/expired, user.created)
- `EVENT_COLORS` — color-coded badge classes for each event type
- `EVENT_LABELS` — human-readable labels
- Framer Motion animation variants for card entrance and fade-in

### Helper Functions
- `getApiHeaders()` — standard auth + org headers using useAuthStore/useOrgStore
- `truncateUrl()` — smart URL truncation with ellipsis
- `formatHttpColor()` — color coding: 2xx=green, 4xx=amber, 5xx=red
- `getStatusConfig()` — status badge styling (pending=yellow, delivered=green, failed=red)

### Sub-Components
- `EventBadge` — colored badge for event types with label
- `StatsCard` — animated stat card with icon, value, label (motion wrapper)
- `EndpointSkeleton` — loading skeleton for endpoint cards

### Main Component: WebhooksPage

#### Tabs
1. **Endpoints Tab**:
   - Stats Row: 3 animated cards (Total Endpoints, Active, Total Deliveries)
   - Endpoint Cards grid (1/2/3 cols responsive) with:
     - Active status bar (green/gray top border)
     - URL display (truncated, monospace) with green/gray dot indicator
     - Status badge (Active/Inactive)
     - Event type badges (colored)
     - Meta info (total deliveries, created date)
     - Action buttons: Edit, Toggle Active/Inactive, Delete
   - Empty state with illustration and CTA

2. **Delivery Logs Tab**:
   - Filter Row (3-column grid): Status dropdown, Event Type dropdown, Endpoint dropdown
   - Clear filters button
   - Desktop Table (sticky header, scrollable):
     - Event type (colored badge)
     - Endpoint URL (truncated, monospace)
     - HTTP Status (color-coded)
     - Attempts count
     - Status badge
     - Created date
     - Next retry date (amber for pending retries)
     - Retry button for failed logs
   - Mobile Cards: all same info in card layout
   - Pagination with page numbers (5 visible)

#### Dialogs
1. **Create Endpoint Dialog**:
   - HTTPS URL input with validation
   - Event type multi-select checkboxes with colored badges
   - Disabled submit if URL invalid or no events selected

2. **Secret Reveal Dialog** (after create or regenerate):
   - Amber warning box about saving secret
   - Monospace code block with masked/visible toggle
   - Copy to clipboard button
   - Info about X-Webhook-Signature header verification

3. **Edit Endpoint Dialog**:
   - Current endpoint info display
   - URL input
   - Event type checkboxes
   - Active/Inactive switch toggle
   - "Regenerate Signing Secret" button (opens confirmation)

4. **Regenerate Secret Confirmation** (AlertDialog):
   - Warning about invalidating current secret
   - Amber action button

5. **Delete Endpoint Confirmation** (AlertDialog):
   - Shows endpoint URL being deleted
   - Warning about permanent deletion + log cascade
   - Red action button

#### Mutations
- `createMutation` — POST /api/webhooks/endpoints, shows secret dialog on success
- `updateMutation` — PUT /api/webhooks/endpoints/[id], handles both regular update and regenerateSecret
- `deleteMutation` — DELETE /api/webhooks/endpoints/[id], invalidates both endpoints and logs queries
- `toggleMutation` — PUT with isActive toggle
- `retryMutation` — POST /api/webhooks/retry for failed logs
- `processQueueMutation` — POST /api/webhooks/process, shows result in toast

#### API Integration
All API calls use `getApiHeaders()` with Authorization + X-Organization-Id headers.
TanStack Query for data fetching with proper query keys and invalidation.

## Design Patterns Followed
- Emerald color scheme throughout
- Framer Motion for card animations and AnimatePresence for list transitions
- shadcn/ui components (Card, Table, Button, Dialog, Badge, Input, Label, Switch, Tabs, Select, Checkbox, Separator, AlertDialog, Skeleton)
- Responsive design: mobile cards + desktop table
- Toast notifications via sonner
- `cn()` utility for conditional class merging
- Consistent with existing project patterns (api-keys-page.tsx, activity-logs-page.tsx)

## Stage Summary
- 1 new file created: `src/components/smart-ticket/webhooks-page.tsx`
- Complete webhook management UI with endpoints CRUD, delivery logs with filtering/pagination, and manual queue processing
- All ESLint checks pass: 0 errors
- Dev server compiles successfully
