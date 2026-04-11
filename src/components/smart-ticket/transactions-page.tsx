'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  Download,
  DollarSign,
  Clock,
  CheckCircle2,
  RotateCcw,
  Search,
  Filter,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  FileSpreadsheet,
  Banknote,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/auth-store';

interface TransactionRecord {
  id: string;
  eventId: string | null;
  ticketId: string | null;
  userId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  reference: string | null;
  description: string | null;
  createdAt: string;
  event: {
    id: string;
    name: string;
    type: string;
  } | null;
  ticket: {
    id: string;
    ticketCode: string;
    ticketType: string;
    holderName: string;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface TransactionsResponse {
  data: TransactionRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function getApiHeaders() {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: {
    label: 'Completed',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: <Clock className="h-3 w-3" />,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    icon: <RotateCcw className="h-3 w-3" />,
  },
};

const paymentMethodConfig: Record<string, { label: string; color: string }> = {
  stripe: { label: 'Stripe', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  wave: { label: 'Wave', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  orange_money: { label: 'Orange Money', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  cash: { label: 'Cash', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400' },
  free: { label: 'Free', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const STATUS_OPTIONS = ['all', 'completed', 'pending', 'failed', 'refunded'];
const PAYMENT_OPTIONS = ['all', 'stripe', 'wave', 'orange_money', 'cash', 'free'];

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Fetch transactions
  const { data: txData, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ['transactions', statusFilter, paymentFilter, startDate, endDate, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (paymentFilter !== 'all') params.set('paymentMethod', paymentFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/transactions?${params}`, {
        headers: getApiHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
  });

  // Compute stats from the current page data (simplified; ideally server-side)
  const stats = useMemo(() => {
    const transactions = txData?.data || [];
    const totalRevenue = transactions
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    const pending = transactions.filter((t) => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0);
    const completed = transactions.filter((t) => t.status === 'completed').length;
    const refunded = transactions.filter((t) => t.status === 'refunded').reduce((sum, t) => sum + t.amount, 0);

    return { totalRevenue, pending, completed, refunded };
  }, [txData]);

  const exportCSV = useCallback(() => {
    if (!txData || txData.data.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['ID', 'Event', 'Ticket Code', 'Holder', 'Amount', 'Currency', 'Method', 'Status', 'Date'];
    const rows = txData.data.map((t) => [
      t.id,
      t.event?.name || '-',
      t.ticket?.ticketCode || '-',
      t.ticket?.holderName || '-',
      t.amount.toFixed(2),
      t.currency,
      t.paymentMethod,
      t.status,
      new Date(t.createdAt).toLocaleString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported successfully');
  }, [txData]);

  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-emerald-500" />
            Transactions
          </h2>
          <p className="text-muted-foreground">View and manage all payment transactions</p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">${stats.pending.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800/30 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">${stats.refunded.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Refunded</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt === 'all' ? 'All Statuses' : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentFilter} onValueChange={handleFilterChange(setPaymentFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All methods" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt === 'all'
                          ? 'All Methods'
                          : paymentMethodConfig[opt]?.label || opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleFilterChange(setStartDate)(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
                />
              </div>
            </div>
            {(statusFilter !== 'all' || paymentFilter !== 'all' || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit text-xs"
                onClick={() => {
                  setStatusFilter('all');
                  setPaymentFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
              >
                Clear all filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : txData && txData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Event</TableHead>
                    <TableHead className="hidden sm:table-cell">Ticket</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txData.data.map((tx) => {
                    const sc = statusConfig[tx.status] || statusConfig.pending;
                    const pc = paymentMethodConfig[tx.paymentMethod] || paymentMethodConfig.cash;
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="pl-4">
                          <div>
                            <p className="text-sm font-medium truncate max-w-[180px]">
                              {tx.event?.name || 'N/A'}
                            </p>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {tx.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div>
                            <p className="text-sm font-mono text-xs">{tx.ticket?.ticketCode || '-'}</p>
                            <p className="text-xs text-muted-foreground">{tx.ticket?.holderName || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-semibold">
                            {tx.amount === 0 ? (
                              <span className="text-emerald-600">Free</span>
                            ) : (
                              `${tx.currency === 'USD' ? '$' : tx.currency}${tx.amount.toFixed(2)}`
                            )}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border-transparent text-xs ${pc.color}`}>
                            {pc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${sc.color}`}>
                            {sc.icon}
                            <span className="ml-1">{sc.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              {txData.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {txData.page} of {txData.totalPages} ({txData.total} transactions)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= txData.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(statusFilter !== 'all' || paymentFilter !== 'all' || startDate || endDate)
                  ? 'Try adjusting your filters'
                  : 'Transactions will appear here once payments are made'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
