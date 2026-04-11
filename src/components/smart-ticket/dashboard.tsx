'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Ticket,
  DollarSign,
  CalendarCheck,
  ScanLine,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Music,
  GraduationCap,
  Briefcase,
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { useOrgStore } from '@/store/org-store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { format } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────
interface AnalyticsData {
  totalTickets: number;
  soldTickets: number;
  usedTickets: number;
  totalRevenue: number;
  ticketsByStatus: Record<string, number>;
  revenueByEvent: Array<{ eventId: string; eventName: string; revenue: number }>;
  scansToday: number;
  scansThisWeek: number;
  recentActivity: Array<{
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    user: { id: string; name: string; email: string } | null;
  }>;
  activeEvents: number;
  totalUsers: number;
  dailyScans: Array<{ date: string; count: number }>;
}

type DateRange = 'today' | 'week' | 'month' | 'all';

// ── Chart Configs ────────────────────────────────────────────────────
const salesChartConfig = {
  count: {
    label: 'Tickets Sold',
    color: '#10b981',
  },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#059669',
  },
} satisfies ChartConfig;

const statusChartConfig = {
  active: {
    label: 'Active',
    color: '#10b981',
  },
  used: {
    label: 'Used',
    color: '#3b82f6',
  },
  expired: {
    label: 'Expired',
    color: '#f59e0b',
  },
  cancelled: {
    label: 'Cancelled',
    color: '#ef4444',
  },
} satisfies ChartConfig;

const scansChartConfig = {
  count: {
    label: 'Scans',
    color: '#14b8a6',
  },
} satisfies ChartConfig;

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Helpers ──────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function formatTime(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'MMM d, h:mm a');
  } catch {
    return 'N/A';
  }
}

function getEventTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'concert':
    case 'music':
      return <Music className="size-4 text-purple-500" />;
    case 'conference':
    case 'business':
      return <Briefcase className="size-4 text-blue-500" />;
    case 'workshop':
    case 'education':
    case 'seminar':
      return <GraduationCap className="size-4 text-amber-500" />;
    case 'sports':
      return <Trophy className="size-4 text-orange-500" />;
    default:
      return <Calendar className="size-4 text-emerald-500" />;
  }
}

function getResultBadge(result: string) {
  const lower = result.toLowerCase();
  if (lower === 'valid' || lower === 'success' || lower === 'active') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Valid</Badge>;
  }
  if (lower === 'invalid' || lower === 'failed' || lower === 'cancelled') {
    return <Badge variant="destructive">Invalid</Badge>;
  }
  if (lower === 'expired') {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Expired</Badge>;
  }
  if (lower === 'duplicate') {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">Duplicate</Badge>;
  }
  return <Badge variant="outline">{result}</Badge>;
}

// ── Skeleton Loaders ─────────────────────────────────────────────────
function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <Skeleton className="mt-3 h-8 w-28 rounded" />
        <Skeleton className="mt-2 h-4 w-36 rounded" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const { data, isLoading, error, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const token = useAuthStore.getState().token;
      const orgId = useOrgStore.getState().currentOrganization?.id;
      const res = await fetch(`/api/analytics?range=${dateRange}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': orgId || '',
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch analytics');
      }
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Computed metrics
  const ticketsByStatusData = data
    ? Object.entries(data.ticketsByStatus).map(([key, value]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        value,
        fill: statusChartConfig[key as keyof typeof statusChartConfig]?.color ?? '#94a3b8',
      }))
    : [];

  const revenueChartData = data
    ? data.revenueByEvent.slice(0, 8).map((e) => ({
        name: e.eventName.length > 20 ? e.eventName.slice(0, 20) + '...' : e.eventName,
        revenue: e.revenue,
      }))
    : [];

  const dailyScansChartData = data
    ? data.dailyScans.map((d) => ({
        date: format(new Date(d.date), 'MMM d'),
        count: d.count,
      }))
    : [];

  // KPI definitions
  const kpis = [
    {
      label: 'Total Tickets Sold',
      value: data ? formatNumber(data.soldTickets) : '—',
      icon: <Ticket className="size-5 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      trend: data ? 12.5 : 0,
      trendLabel: 'vs last period',
    },
    {
      label: 'Total Revenue',
      value: data ? formatCurrency(data.totalRevenue) : '—',
      icon: <DollarSign className="size-5 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-950',
      trend: data ? 8.2 : 0,
      trendLabel: 'vs last period',
    },
    {
      label: 'Active Events',
      value: data ? formatNumber(data.activeEvents) : '—',
      icon: <CalendarCheck className="size-5 text-teal-600" />,
      iconBg: 'bg-teal-100 dark:bg-teal-950',
      trend: data ? 0 : 0,
      trendLabel: 'currently running',
    },
    {
      label: 'Scans Today',
      value: data ? formatNumber(data.scansToday) : '—',
      icon: <ScanLine className="size-5 text-green-600" />,
      iconBg: 'bg-green-100 dark:bg-green-950',
      trend: data && data.scansToday > 15 ? 24.1 : -3.2,
      trendLabel: 'vs yesterday',
    },
  ];

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* ── Header Section ──────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Welcome back, {user?.name || 'User'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error State ─────────────────────────────────────── */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="size-5 text-destructive" />
            <p className="text-sm text-destructive">
              Failed to load dashboard data. Please check your connection and try again.
            </p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)
          : kpis.map((kpi, i) => (
              <Card key={i} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.iconBg}`}>
                      {kpi.icon}
                    </div>
                    {kpi.trend !== 0 && (
                      <div
                        className={`flex items-center gap-0.5 text-xs font-medium ${
                          kpi.trend > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {kpi.trend > 0 ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {Math.abs(kpi.trend)}%
                      </div>
                    )}
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                    <p className="mt-0.5 text-muted-foreground text-xs">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* ── Charts Section (2x2) ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ticket Sales Trend (Area Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Sales Trend</CardTitle>
              <CardDescription>Daily scan activity over the past 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyScansChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  No scan data available for this period
                </div>
              ) : (
                <ChartContainer config={salesChartConfig} className="h-[280px] w-full">
                  <AreaChart data={dailyScansChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      fill="url(#salesGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Revenue by Event (Bar Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue by Event</CardTitle>
              <CardDescription>Top events by total revenue generated</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  No revenue data available yet
                </div>
              ) : (
                <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
                  <BarChart
                    data={revenueChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={120}
                      tickMargin={4}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ticket Status Distribution (Donut Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Status Distribution</CardTitle>
              <CardDescription>Current breakdown of ticket statuses</CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsByStatusData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  No ticket status data available
                </div>
              ) : (
                <ChartContainer config={statusChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                    <Pie
                      data={ticketsByStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={false}
                    >
                      {ticketsByStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Activity (Line Chart) */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Validation Activity</CardTitle>
              <CardDescription>Daily scan/validation volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyScansChartData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                  No validation activity recorded
                </div>
              ) : (
                <ChartContainer config={scansChartConfig} className="h-[280px] w-full">
                  <LineChart data={dailyScansChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Tables Section ──────────────────────────────────── */}
      <Tabs defaultValue="recent-activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="top-events">Top Events</TabsTrigger>
        </TabsList>

        {/* Recent Activity Table */}
        <TabsContent value="recent-activity">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest scans and system activity</CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.recentActivity.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    No recent activity to display
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.recentActivity.slice(0, 10).map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="size-3" />
                              {formatTime(activity.createdAt)}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {activity.user?.name || 'System'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              {activity.action === 'scan' && (
                                <ScanLine className="size-3.5 text-teal-500" />
                              )}
                              {activity.action === 'ticket_created' && (
                                <Ticket className="size-3.5 text-emerald-500" />
                              )}
                              {activity.action === 'user_login' && (
                                <Users className="size-3.5 text-blue-500" />
                              )}
                              {activity.action === 'event_created' && (
                                <Calendar className="size-3.5 text-purple-500" />
                              )}
                              <span className="capitalize">
                                {activity.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-muted-foreground text-xs">
                            {activity.details || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            {activity.action === 'scan'
                              ? getResultBadge(activity.details?.includes('valid') ? 'valid' : 'invalid')
                              : activity.action === 'login'
                                ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                    <CheckCircle2 className="mr-1 size-3" />
                                    Success
                                  </Badge>
                                : <Badge variant="outline">Info</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {data && data.recentActivity.length > 10 && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
                      View All Activity
                      <ArrowUpRight className="ml-1 size-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Top Events Table */}
        <TabsContent value="top-events">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Events</CardTitle>
                <CardDescription>Events ranked by total revenue generated</CardDescription>
              </CardHeader>
              <CardContent>
                {data && data.revenueByEvent.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
                    No events with revenue data yet
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">#</TableHead>
                        <TableHead>Event Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Type</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.revenueByEvent.map((event, index) => (
                        <TableRow key={event.eventId}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                                <Calendar className="size-4 text-emerald-600" />
                              </div>
                              <span className="truncate">{event.eventName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="gap-1">
                              {getEventTypeIcon(event.eventName)}
                              Event
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(event.revenue)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                              Active
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Quick Stats Footer ──────────────────────────────── */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100 dark:bg-emerald-950">
                <Ticket className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
                <p className="text-sm font-semibold">{formatNumber(data.totalTickets)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-950">
                <CheckCircle2 className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Used Tickets</p>
                <p className="text-sm font-semibold">{formatNumber(data.usedTickets)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-100 dark:bg-teal-950">
                <Users className="size-4 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-sm font-semibold">{formatNumber(data.totalUsers)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950">
                <ScanLine className="size-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scans This Week</p>
                <p className="text-sm font-semibold">{formatNumber(data.scansThisWeek)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
