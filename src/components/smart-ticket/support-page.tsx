'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Filter,
  Search,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Loader2,
  Eye,
  Trash2,
  ArrowUpRight,
  MessageSquare,
  UserCircle,
  Calendar,
  ShieldAlert,
  CircleDot,
  ChevronDown,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';

// ==================== Types ====================

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string };
}

interface SupportTicketsResponse {
  data: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================== API Helper ====================

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  const orgId = useOrgStore.getState().currentOrganization?.id;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': orgId || '',
  };
}

// ==================== Constants ====================

const PRIORITY_CONFIG: Record<
  SupportTicket['priority'],
  { label: string; className: string; icon: React.ReactNode }
> = {
  low: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700',
    icon: <CircleDot className="h-3 w-3" />,
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    icon: <Clock className="h-3 w-3" />,
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
    icon: <AlertOctagon className="h-3 w-3" />,
  },
};

const STATUS_CONFIG: Record<
  SupportTicket['status'],
  { label: string; className: string; icon: React.ReactNode }
> = {
  open: {
    label: 'Open',
    className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-700',
    icon: <CircleDot className="h-3 w-3" />,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700',
    icon: <Loader2 className="h-3 w-3" />,
  },
  resolved: {
    label: 'Resolved',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  closed: {
    label: 'Closed',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
};

const STATUS_FLOW: SupportTicket['status'][] = ['open', 'in_progress', 'resolved', 'closed'];

// ==================== Sub-components ====================

function PriorityBadge({ priority }: { priority: SupportTicket['priority'] }) {
  const config = PRIORITY_CONFIG[priority];
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: SupportTicket['status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function SLAIndicator({ createdAt, status }: { createdAt: string; status: SupportTicket['status'] }) {
  const isStale = status === 'open' || status === 'in_progress';
  const createdDate = new Date(createdAt);
  const hoursDiff = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
  const isBreached = isStale && hoursDiff > 24;

  if (!isStale) return null;

  return (
    <div className="flex items-center gap-1.5">
      {isBreached ? (
        <TooltipWrapper text="SLA breached: over 24 hours without resolution">
          <Badge
            variant="destructive"
            className="text-[10px] gap-1 bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800"
          >
            <ShieldAlert className="h-2.5 w-2.5" />
            SLA Breached
          </Badge>
        </TooltipWrapper>
      ) : (
        <TooltipWrapper text={`Created ${formatDistanceToNow(createdDate, { addSuffix: true })}`}>
          <Badge
            variant="outline"
            className="text-[10px] gap-1 bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
          >
            <Clock className="h-2.5 w-2.5" />
            {hoursDiff < 1
              ? `${Math.round(hoursDiff * 60)}m`
              : `${Math.round(hoursDiff)}h`}
          </Badge>
        </TooltipWrapper>
      )}
    </div>
  );
}

function TooltipWrapper({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span title={text} className="inline-flex">
      {children}
    </span>
  );
}

function StatsRow({ tickets }: { tickets: SupportTicket[] }) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const resolvedTodayCount = tickets.filter(
    (t) => t.status === 'resolved' && new Date(t.resolvedAt || t.updatedAt) >= todayStart
  ).length;
  const criticalCount = tickets.filter(
    (t) => t.priority === 'critical' && t.status !== 'closed' && t.status !== 'resolved'
  ).length;

  const stats = [
    {
      label: 'Open Tickets',
      value: openCount,
      icon: <CircleDot className="h-5 w-5" />,
      color: 'text-sky-500',
      bg: 'bg-sky-50 dark:bg-sky-950/30',
    },
    {
      label: 'In Progress',
      value: inProgressCount,
      icon: <Loader2 className="h-5 w-5" />,
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      label: 'Resolved Today',
      value: resolvedTodayCount,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'Critical',
      value: criticalCount,
      icon: <AlertOctagon className="h-5 w-5" />,
      color: 'text-red-500',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.08, duration: 0.35 }}
        >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                  <span className={stat.color}>{stat.icon}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            <Skeleton className="h-10 w-full rounded-none" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-none" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ statusFilter, priorityFilter }: { statusFilter: string; priorityFilter: string }) {
  const hasFilters = statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        {hasFilters ? (
          <Filter className="h-8 w-8 text-muted-foreground" />
        ) : (
          <LifeBuoy className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-semibold mb-1">
        {hasFilters ? 'No matching tickets' : 'No support tickets yet'}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? 'Try adjusting your filters to find what you\'re looking for.'
          : 'Create your first support ticket and our team will get back to you promptly.'}
      </p>
      {!hasFilters && (
        <Badge variant="outline" className="mt-3 text-xs gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          <Plus className="h-3 w-3" />
          Click "New Ticket" to get started
        </Badge>
      )}
    </motion.div>
  );
}

function TicketMobileCard({
  ticket,
  onView,
  isAdmin,
  onStatusChange,
}: {
  ticket: SupportTicket;
  onView: () => void;
  isAdmin: boolean;
  onStatusChange: (status: SupportTicket['status']) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{ticket.subject}</h4>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ticket.message}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <PriorityBadge priority={ticket.priority} />
              <SLAIndicator createdAt={ticket.createdAt} status={ticket.status} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusBadge status={ticket.status} />
              {ticket.user && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <UserCircle className="h-3 w-3" />
                  {ticket.user.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && ticket.status !== 'closed' && (
                <Select
                  value={ticket.status}
                  onValueChange={(v) => onStatusChange(v as SupportTicket['status'])}
                >
                  <SelectTrigger size="sm" className="w-28 h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FLOW.filter((s) => s !== 'closed').map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onView}>
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateTicketDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { subject: string; message: string; priority: SupportTicket['priority'] }) => void;
  isPending: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<SupportTicket['priority']>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    onCreate({ subject: subject.trim(), message: message.trim(), priority });
    setSubject('');
    setMessage('');
    setPriority('medium');
  };

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
    if (!val) {
      setSubject('');
      setMessage('');
      setPriority('medium');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" />
            Create Support Ticket
          </DialogTitle>
          <DialogDescription>
            Describe your issue and our team will respond as soon as possible.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ticket-subject"
              placeholder="Brief summary of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-message">
              Message <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="ticket-message"
              placeholder="Describe your issue in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={5000}
              disabled={isPending}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length}/5000</p>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as SupportTicket['priority'])}
              disabled={isPending}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Create Ticket
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewTicketDialog({
  ticket,
  open,
  onOpenChange,
  isAdmin,
  onStatusChange,
  onPriorityChange,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onStatusChange: (status: SupportTicket['status']) => void;
  onPriorityChange: (priority: SupportTicket['priority']) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  if (!ticket) return null;

  const nextStatuses = STATUS_FLOW.filter(
    (s) => STATUS_FLOW.indexOf(s) > STATUS_FLOW.indexOf(ticket.status)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg leading-snug">{ticket.subject}</DialogTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <SLAIndicator createdAt={ticket.createdAt} status={ticket.status} />
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reporter Info */}
          {ticket.user && (
            <div className="flex items-center gap-2 text-sm">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Reported by</span>
              <span className="font-medium">{ticket.user.name}</span>
              <span className="text-muted-foreground">({ticket.user.email})</span>
            </div>
          )}

          <Separator />

          {/* Message */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-emerald-500" />
              Message
            </h4>
            <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed">
              {ticket.message}
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created
              </p>
              <p className="text-sm">
                {format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last Updated
              </p>
              <p className="text-sm">
                {format(new Date(ticket.updatedAt), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>

          {ticket.assignedTo && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Assigned to:</span>
              <span className="font-medium">{ticket.assignedTo}</span>
            </div>
          )}

          {ticket.resolvedAt && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-muted-foreground">Resolved at</span>
              <span className="font-medium">
                {format(new Date(ticket.resolvedAt), 'MMM dd, yyyy HH:mm')}
              </span>
            </div>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  Admin Actions
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Update Status</Label>
                    <Select
                      value={ticket.status}
                      onValueChange={(v) => onStatusChange(v as SupportTicket['status'])}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_FLOW.map((s) => (
                          <SelectItem key={s} value={s} className="text-sm">
                            {STATUS_CONFIG[s].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Update Priority</Label>
                    <Select
                      value={ticket.priority}
                      onValueChange={(v) => onPriorityChange(v as SupportTicket['priority'])}
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-full h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key} className="text-sm">
                            <span className="flex items-center gap-2">
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full mt-2"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Ticket
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The ticket &quot;{ticket.subject}&quot; will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onDelete}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Main Component ====================

export default function SupportPage() {
  const { user, token } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Fetch tickets
  const { data, isLoading, isError, refetch } = useQuery<SupportTicketsResponse>({
    queryKey: ['support-tickets', statusFilter, priorityFilter, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (priorityFilter !== 'all') params.set('priority', priorityFilter);
      const res = await fetch(`/api/support-tickets?${params}`, { headers: getApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch support tickets');
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30000,
  });

  // Fetch single ticket for view
  const { data: ticketDetail, isLoading: isTicketLoading } = useQuery<SupportTicket>({
    queryKey: ['support-ticket', selectedTicketId],
    queryFn: async () => {
      const res = await fetch(`/api/support-tickets/${selectedTicketId}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch ticket');
      return res.json();
    },
    enabled: !!selectedTicketId && viewDialogOpen,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (body: { subject: string; message: string; priority: string }) => {
      const res = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Support ticket created successfully');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setCreateDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to create support ticket');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<SupportTicket>;
    }) => {
      const res = await fetch(`/api/support-tickets/${id}`, {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update ticket');
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success('Ticket updated successfully');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.id] });
    },
    onError: () => {
      toast.error('Failed to update ticket');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/support-tickets/${id}`, {
        method: 'DELETE',
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete ticket');
      return res.json();
    },
    onSuccess: (_, id) => {
      toast.success('Ticket deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setViewDialogOpen(false);
      setSelectedTicketId(null);
    },
    onError: () => {
      toast.error('Failed to delete ticket');
    },
  });

  const tickets = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const handleCreate = useCallback(
    (ticketData: { subject: string; message: string; priority: SupportTicket['priority'] }) => {
      createMutation.mutate(ticketData);
    },
    [createMutation]
  );

  const handleView = useCallback((id: string) => {
    setSelectedTicketId(id);
    setViewDialogOpen(true);
  }, []);

  const handleStatusChange = useCallback(
    (id: string, status: SupportTicket['status']) => {
      updateMutation.mutate({ id, data: { status } });
    },
    [updateMutation]
  );

  const handlePriorityChange = useCallback(
    (id: string, priority: SupportTicket['priority']) => {
      updateMutation.mutate({ id, data: { priority } });
    },
    [updateMutation]
  );

  const handleDelete = useCallback(() => {
    if (selectedTicketId) {
      deleteMutation.mutate(selectedTicketId);
    }
  }, [selectedTicketId, deleteMutation]);

  const handleFilterChange = useCallback((filterType: 'status' | 'priority', value: string) => {
    if (filterType === 'status') setStatusFilter(value);
    else setPriorityFilter(value);
    setPage(1);
  }, []);

  // Unauthenticated state
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <LifeBuoy className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Please log in to access support tickets</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="h-7 w-7 text-emerald-500" />
            Support Tickets
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Create, track, and manage support requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Ticket
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="rounded-full bg-red-50 dark:bg-red-950/30 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Failed to load tickets</h3>
          <p className="text-sm text-muted-foreground mb-4">
            There was an error fetching support tickets. Please try again.
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </motion.div>
      ) : (
        <>
          {/* Stats */}
          <StatsRow tickets={tickets} />

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1 sm:mb-0">
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                  </div>
                  <div className="w-full sm:w-40">
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => handleFilterChange('status', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full sm:w-40">
                    <Select
                      value={priorityFilter}
                      onValueChange={(v) => handleFilterChange('priority', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(statusFilter !== 'all' || priorityFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all');
                        setPriorityFilter('all');
                        setPage(1);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Ticket List */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-0">
                {tickets.length === 0 ? (
                  <EmptyState statusFilter={statusFilter} priorityFilter={priorityFilter} />
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                      <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="sticky top-0 bg-background z-10">
                              <TableHead className="min-w-[200px]">Subject</TableHead>
                              <TableHead className="min-w-[90px]">Status</TableHead>
                              <TableHead className="min-w-[90px]">Priority</TableHead>
                              <TableHead className="min-w-[100px]">SLA</TableHead>
                              <TableHead className="min-w-[120px]">Reporter</TableHead>
                              <TableHead className="min-w-[130px]">Created</TableHead>
                              {isAdmin && (
                                <TableHead className="min-w-[130px] text-right">Actions</TableHead>
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <AnimatePresence mode="popLayout">
                              {tickets.map((ticket) => (
                                <motion.tr
                                  key={ticket.id}
                                  layout
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -5 }}
                                  transition={{ duration: 0.15 }}
                                  className="border-b transition-colors hover:bg-muted/50 group"
                                >
                                  <TableCell>
                                    <div className="max-w-[280px]">
                                      <button
                                        onClick={() => handleView(ticket.id)}
                                        className="text-sm font-medium hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left flex items-center gap-1.5"
                                      >
                                        <span className="truncate">{ticket.subject}</span>
                                        <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </button>
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                        {ticket.message}
                                      </p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge status={ticket.status} />
                                  </TableCell>
                                  <TableCell>
                                    <PriorityBadge priority={ticket.priority} />
                                  </TableCell>
                                  <TableCell>
                                    <SLAIndicator
                                      createdAt={ticket.createdAt}
                                      status={ticket.status}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {ticket.user ? (
                                      <span className="text-xs">{ticket.user.name}</span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(ticket.createdAt), 'MMM dd, HH:mm')}
                                    </span>
                                  </TableCell>
                                  {isAdmin && (
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {ticket.status !== 'closed' && (
                                          <Select
                                            value={ticket.status}
                                            onValueChange={(v) =>
                                              handleStatusChange(ticket.id, v as SupportTicket['status'])
                                            }
                                          >
                                            <SelectTrigger
                                              size="sm"
                                              className="w-28 h-7 text-[11px]"
                                            >
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {STATUS_FLOW.filter((s) => s !== 'closed').map((s) => (
                                                <SelectItem key={s} value={s} className="text-xs">
                                                  {STATUS_CONFIG[s].label}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => handleView(ticket.id)}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden p-4 space-y-3">
                      <AnimatePresence mode="popLayout">
                        {tickets.map((ticket) => (
                          <TicketMobileCard
                            key={ticket.id}
                            ticket={ticket}
                            onView={() => handleView(ticket.id)}
                            isAdmin={isAdmin}
                            onStatusChange={(status) =>
                              handleStatusChange(ticket.id, status)
                            }
                          />
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t px-4 py-3">
                        <p className="text-sm text-muted-foreground">
                          Showing {(page - 1) * limit + 1}
                          –{Math.min(page * limit, total)} of {total}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                          >
                            Previous
                          </Button>
                          <span className="px-3 text-sm text-muted-foreground">
                            {page} / {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Create Dialog */}
      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
        isPending={createMutation.isPending}
      />

      {/* View Dialog */}
      <ViewTicketDialog
        ticket={ticketDetail ?? null}
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setSelectedTicketId(null);
        }}
        isAdmin={isAdmin}
        onStatusChange={(status) => {
          if (selectedTicketId) handleStatusChange(selectedTicketId, status);
        }}
        onPriorityChange={(priority) => {
          if (selectedTicketId) handlePriorityChange(selectedTicketId, priority);
        }}
        onDelete={handleDelete}
        isUpdating={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
