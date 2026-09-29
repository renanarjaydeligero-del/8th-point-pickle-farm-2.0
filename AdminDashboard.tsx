import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Clock, Download, FileText, LogOut, MapPin, Phone, Search, User, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

type Booking = {
  id: string;
  confirmation_code: string;
  customer_name: string;
  contact_number: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  courts: number;
  total_amount: number;
  payment_method: string;
  payment_reference: string | null;
  payment_code: string | null;
  receipt_path: string | null;
  status: BookingStatus;
  created_at: string;
};

const logo = '/images/825260840_1093383066614513_6902349529276500923_n.webp';

const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (value: string) => {
  const [hourStr, minute] = value.split(':');
  const hour = Number(hourStr);
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${minute} ${period}`;
};
const formatCreated = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AdminDashboard() {
  const { signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('booking_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (queryError) {
      console.error('admin load failed', queryError);
      setError('Could not load reservations. Please try again.');
    } else {
      setBookings((data as Booking[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const changeStatus = async (booking: Booking, status: BookingStatus) => {
    setUpdatingId(booking.id);
    setError('');
    const { data, error: updateError } = await supabase
      .from('booking_requests')
      .update({ status })
      .eq('id', booking.id)
      .select('payment_code')
      .maybeSingle();
    setUpdatingId(null);
    if (updateError) {
      console.error('status update failed', updateError);
      setError(`Could not update that reservation: ${updateError.message}`);
      return;
    }
    setBookings((current) => current.map((item) => (item.id === booking.id ? { ...item, status, payment_code: data?.payment_code ?? item.payment_code } : item)));
  };

  const filtered = useMemo(() => {
    return bookings.filter((booking) => {
      if (filter !== 'all' && booking.status !== filter) return false;
      if (!query.trim()) return true;
      const text = query.toLowerCase();
      return (
        booking.confirmation_code.toLowerCase().includes(text) ||
        booking.customer_name.toLowerCase().includes(text) ||
        booking.contact_number.toLowerCase().includes(text) ||
        (booking.payment_code ?? '').toLowerCase().includes(text)
      );
    });
  }, [bookings, filter, query]);

  const counts = useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }), [bookings]);

  const totalRevenue = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed').reduce((sum, b) => sum + b.total_amount, 0),
    [bookings],
  );

  const exportCsv = () => {
    const rows = [
      ['Code', 'Payment Code', 'Name', 'Contact', 'Date', 'Start', 'Hours', 'Courts', 'Total', 'Payment', 'Reference', 'Receipt', 'Status', 'Submitted'],
      ...filtered.map((b) => [
        b.confirmation_code, b.payment_code ?? '', b.customer_name, b.contact_number, b.booking_date, b.start_time,
        String(b.duration_hours), String(b.courts), String(b.total_amount), b.payment_method,
        b.payment_reference ?? '', b.receipt_path ?? '', b.status, formatCreated(b.created_at),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `8th-point-bookings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f5f3ec]">
      <header className="sticky top-0 z-20 border-b border-[#e5e8d7] bg-[#1f2920] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="8th Point Pickle Farm" className="h-10 w-10 rounded-full object-cover" />
            <div>
              <p className="font-display text-base font-bold leading-none">8th Point Pickle Farm</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#bdd86d]">Admin · Reservations</p>
            </div>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/10">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Pending" value={counts.pending} accent="amber" />
          <StatCard label="Confirmed" value={counts.confirmed} accent="green" />
          <StatCard label="Confirmed revenue" value={`P${totalRevenue.toLocaleString()}`} accent="dark" />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'confirmed', 'cancelled'] as const).map((key) => (
              <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors ${filter === key ? 'bg-[#1f2920] text-white' : 'bg-white text-[#596257] hover:bg-[#e5e8d7]'}`}>
                {key} {key !== 'all' && counts[key] > 0 && <span className="ml-1 opacity-60">{counts[key]}</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[#dfe4d3] bg-white px-4">
              <Search size={16} className="text-[#9aa78a]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, name, or phone" className="h-10 w-full bg-transparent text-sm outline-none sm:w-56" />
            </div>
            <button onClick={exportCsv} className="flex items-center gap-2 rounded-full bg-[#e5e8d7] px-4 py-2.5 text-sm font-bold text-[#1f2920] transition-colors hover:bg-[#d3dab9]">
              <Download size={15} /> Export
            </button>
          </div>
        </div>

        {error && <p className="mt-5 rounded-xl bg-[#fbe9e4] px-4 py-3 text-sm font-semibold text-[#9f3e2c]">{error}</p>}

        {loading ? (
          <p className="mt-10 text-center text-[#6c756a]">Loading reservations...</p>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-[#cdd6b8] bg-white py-16 text-center">
            <p className="font-display text-2xl font-bold text-[#1f2920]">No reservations yet</p>
            <p className="mt-2 text-sm text-[#6c756a]">New booking requests from your site will appear here.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onStatus={changeStatus} updating={updatingId === booking.id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: 'amber' | 'green' | 'dark' }) {
  const styles = {
    amber: 'bg-[#fdf3e0] text-[#8a5a1a]',
    green: 'bg-[#dfeec0] text-[#466124]',
    dark: 'bg-[#1f2920] text-white',
  }[accent];
  return (
    <div className={`rounded-2xl p-5 ${styles}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold">{value}</p>
    </div>
  );
}

function BookingCard({ booking, onStatus, updating }: { booking: Booking; onStatus: (b: Booking, s: BookingStatus) => void; updating: boolean }) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const statusStyles = {
    pending: 'bg-[#fdf3e0] text-[#8a5a1a]',
    confirmed: 'bg-[#dfeec0] text-[#466124]',
    cancelled: 'bg-[#fbe1de] text-[#9f3e2c]',
  }[booking.status];

  const viewReceipt = async () => {
    if (!booking.receipt_path || receiptUrl) {
      if (receiptUrl) window.open(receiptUrl, '_blank');
      return;
    }
    setReceiptLoading(true);
    const { data } = await supabase.storage.from('receipts').createSignedUrl(booking.receipt_path, 300);
    setReceiptLoading(false);
    if (data?.signedUrl) {
      setReceiptUrl(data.signedUrl);
      window.open(data.signedUrl, '_blank');
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5e8d7] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-bold tracking-wider text-[#1f2920]">{booking.confirmation_code}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusStyles}`}>{booking.status}</span>
            {booking.payment_code && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#1f2920] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#c7e36d]">
                <Check size={12} /> Paid · {booking.payment_code}
              </span>
            )}
          </div>
          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Detail icon={<User size={15} />} label="Customer" value={booking.customer_name} />
            <Detail icon={<Phone size={15} />} label="Contact" value={booking.contact_number} />
            <Detail icon={<Calendar size={15} />} label="Date" value={formatDate(booking.booking_date)} />
            <Detail icon={<Clock size={15} />} label="Time" value={`${formatTime(booking.start_time)} · ${booking.duration_hours}h`} />
            <Detail icon={<MapPin size={15} />} label="Courts" value={`${booking.courts} court${booking.courts > 1 ? 's' : ''}`} />
            <Detail icon={<Check size={15} />} label="Total" value={`P${booking.total_amount.toLocaleString()}`} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#6c756a]">
            <span>Payment: <strong className="text-[#1f2920]">{booking.payment_method}</strong></span>
            {booking.payment_reference && <span>Reference: <strong className="text-[#1f2920]">{booking.payment_reference}</strong></span>}
            {booking.receipt_path && (
              <button onClick={viewReceipt} disabled={receiptLoading} className="flex items-center gap-1.5 font-bold text-[#466124] underline decoration-[#c7e36d] decoration-2 underline-offset-2 transition-opacity hover:opacity-70 disabled:opacity-50">
                <FileText size={13} /> {receiptLoading ? 'Loading...' : 'View receipt'}
              </button>
            )}
            <span>Submitted: {formatCreated(booking.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2 lg:flex-col">
          {booking.status !== 'confirmed' && (
            <button disabled={updating} onClick={() => onStatus(booking, 'confirmed')} className="flex items-center gap-2 rounded-full bg-[#6f8530] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#5a6e26] disabled:opacity-50">
              <Check size={15} /> Mark as paid
            </button>
          )}
          {booking.status !== 'cancelled' && (
            <button disabled={updating} onClick={() => onStatus(booking, 'cancelled')} className="flex items-center gap-2 rounded-full border border-[#dfe4d3] px-4 py-2.5 text-sm font-bold text-[#9f3e2c] transition-colors hover:bg-[#fbe1de] disabled:opacity-50">
              <X size={15} /> Cancel
            </button>
          )}
          {booking.status === 'cancelled' && (
            <button disabled={updating} onClick={() => onStatus(booking, 'pending')} className="flex items-center gap-2 rounded-full border border-[#dfe4d3] px-4 py-2.5 text-sm font-bold text-[#596257] transition-colors hover:bg-[#e5e8d7] disabled:opacity-50">
              Reopen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[#9aa78a]">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#9aa78a]">{label}</p>
        <p className="text-sm font-semibold text-[#1f2920]">{value}</p>
      </div>
    </div>
  );
}
