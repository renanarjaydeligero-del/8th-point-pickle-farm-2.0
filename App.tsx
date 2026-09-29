import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Clock3, Facebook, Leaf, MapPin, Menu, Minus, Plus, QrCode, ShieldCheck, Upload, X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminAuth from '@/components/AdminAuth';
import AdminDashboard from '@/components/AdminDashboard';

const logo = '/images/825260840_1093383066614513_6902349529276500923_n.webp';
const gotymeQr = '/images/825309912_2947175415649021_2289088107652196839_n.jpg';
const maribankQr = '/images/825309928_1435068905425404_1426408138501781341_n.jpg';
const courtPhoto = '/images/825261377_1088388640829304_1399317452509230016_n.jpg';
const paddlesImage = '/images/image.png';

const today = new Date().toISOString().split('T')[0];

function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function getHourlyRate(date: string, startTime: string, courts: number, hourOffset: number) {
  const startHour = Number(startTime.split(':')[0]);
  const hour = (startHour + hourOffset) % 24;
  const weekend = isWeekend(date);
  if (hour >= 6 && hour < 16) {
    return weekend ? (courts === 1 ? 180 : 360) : (courts === 1 ? 150 : 300);
  }
  return weekend ? (courts === 1 ? 230 : 460) : (courts === 1 ? 200 : 400);
}

function calculateTotal(date: string, startTime: string, duration: number, courts: number) {
  return Array.from({ length: duration }, (_, index) => getHourlyRate(date, startTime, courts, index))
    .reduce((total, rate) => total + rate, 0);
}

function createConfirmationCode() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `8PF-${stamp}-${random}`;
}

function getAdminRoute() {
  return window.location.pathname === '/admin' || window.location.hash.startsWith('#admin');
}

function App() {
  const [isAdmin, setIsAdmin] = useState(getAdminRoute());

  useEffect(() => {
    const onHashChange = () => setIsAdmin(getAdminRoute());
    const onPopState = () => setIsAdmin(getAdminRoute());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  if (isAdmin) {
    return (
      <AuthProvider>
        <AdminGate />
      </AuthProvider>
    );
  }

  return <PublicSite />;
}

function AdminGate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1f2920] text-white">
        <p className="text-sm text-white/60">Loading...</p>
      </div>
    );
  }
  if (!session) return <AdminAuth />;
  return <AdminDashboard />;
}

function PublicSite() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submittedCode, setSubmittedCode] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: today,
    startTime: '06:00',
    duration: 1,
    courts: 1,
    payment: 'GoTyme Bank',
    reference: '',
  });

  const total = useMemo(
    () => calculateTotal(form.date, form.startTime, form.duration, form.courts),
    [form.date, form.startTime, form.duration, form.courts],
  );

  const updateForm = (field: string, value: string | number) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const openBooking = () => {
    setSubmittedCode('');
    setFormError('');
    setReceiptFile(null);
    setReceiptError('');
    setReferenceError('');
    setBookingOpen(true);
  };

  const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReceiptError('');
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i)) {
      setReceiptError('Please upload an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptError('Receipt image must be under 5 MB.');
      return;
    }
    setReceiptFile(file);
  };

  const handleReferenceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReferenceError('');
    updateForm('reference', event.target.value);
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!form.reference.trim()) {
      setReferenceError('Payment reference number is required.');
      return;
    }
    if (!receiptFile) {
      setReceiptError('Please attach your payment receipt screenshot.');
      return;
    }

    setIsSubmitting(true);
    const confirmationCode = createConfirmationCode();

    const safeName = receiptFile.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const filePath = `${confirmationCode}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, receiptFile);
    if (uploadError) {
      console.error('receipt upload failed', uploadError);
      setIsSubmitting(false);
      setFormError('We could not upload your receipt. Please try again.');
      return;
    }

    const { error } = await supabase.from('booking_requests').insert({
      confirmation_code: confirmationCode,
      customer_name: form.name.trim(),
      contact_number: form.phone.trim(),
      booking_date: form.date,
      start_time: form.startTime,
      duration_hours: form.duration,
      courts: form.courts,
      total_amount: total,
      payment_method: form.payment,
      payment_reference: form.reference.trim(),
      receipt_path: filePath,
      status: 'pending',
    });

    setIsSubmitting(false);
    if (error) {
      console.error('booking submission failed', error);
      setFormError('We could not save your booking request. Please try again.');
      return;
    }
    setSubmittedCode(confirmationCode);
  };

  return (
    <div className="min-h-screen bg-[#f5f3ec] text-[#1f2920]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/15 bg-[#1f2920]/90 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
          <a href="#top" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
            <img src={logo} alt="8th Point Pickle Farm" className="h-12 w-12 rounded-full object-cover" />
            <div className="hidden sm:block">
              <p className="font-display text-lg font-bold leading-none tracking-tight">8th Point</p>
              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-[#bdd86d]">Pickle Farm</p>
            </div>
          </a>
          <nav className={`${menuOpen ? 'absolute left-0 right-0 top-[72px] flex' : 'hidden'} flex-col gap-5 bg-[#1f2920] px-5 py-6 text-sm font-medium md:static md:flex md:flex-row md:items-center md:gap-8 md:bg-transparent md:p-0`}>
            <a href="#experience" onClick={() => setMenuOpen(false)} className="transition-colors hover:text-[#c7e36d]">The experience</a>
            <a href="#rates" onClick={() => setMenuOpen(false)} className="transition-colors hover:text-[#c7e36d]">Rates</a>
            <a href="#location" onClick={() => setMenuOpen(false)} className="transition-colors hover:text-[#c7e36d]">Find us</a>
            <a href="https://www.facebook.com/profile.php?id=61594654537062" target="_blank" rel="noreferrer" className="flex items-center gap-2 transition-colors hover:text-[#c7e36d]"><Facebook size={16} /> Facebook</a>
            <button onClick={openBooking} className="rounded-full bg-[#c7e36d] px-5 py-3 text-sm font-bold text-[#1f2920] transition-transform hover:-translate-y-0.5">Book a court</button>
          </nav>
          <button className="rounded-lg p-2 md:hidden" aria-label="Open menu" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main id="top">
        <section className="relative flex min-h-[720px] items-end overflow-hidden bg-[#1f2920] pt-24 text-white lg:min-h-[820px]">
          <img src={courtPhoto} alt="Outdoor pickleball courts at sunset" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#162018] via-[#162018]/45 to-[#162018]/10" />
          <div className="absolute right-8 top-32 hidden h-28 w-28 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm lg:block" />
          <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 lg:px-8 lg:pb-24">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] backdrop-blur-md"><Leaf size={14} className="text-[#c7e36d]" /> Play outside. Stay awhile.</div>
              <h1 className="font-display text-5xl font-bold leading-[0.96] tracking-[-0.04em] sm:text-7xl lg:text-8xl">Your little <br />escape<br /><span className="text-[#c7e36d]">to play.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-white/80 sm:text-lg">Where every rally feels like a getaway. Pickleball, open skies, and the kind of place you'll want to stay awhile.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={openBooking} className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#c7e36d] px-6 py-4 font-bold text-[#1f2920] transition-all hover:gap-5 hover:bg-white">Reserve your court <ArrowRight size={18} /></button><a href="#rates" className="inline-flex items-center justify-center rounded-full border border-white/40 px-6 py-4 font-semibold text-white transition-colors hover:bg-white/10">See rates</a></div>
            </div>
            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/20 pt-5 text-sm text-white/75"><span className="flex items-center gap-2"><Clock3 size={17} className="text-[#c7e36d]" /> Open daily · 6 AM–2 AM</span><span className="flex items-center gap-2"><MapPin size={17} className="text-[#c7e36d]" /> Baranggay Silway 8, Polomolok&nbsp;<br />South Cotabato 9504</span></div>
          </div>
        </section>

        <section id="experience" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.22em] text-[#6f8530]">More than a game</p><h2 className="mt-4 max-w-lg font-display text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl">Pickle and stay <br />for the vibe.</h2></div><p className="max-w-xl text-lg leading-8 text-[#596257]">A fresh-air court experience for early birds, after-work rallies, friendly matches, and everyone looking for a new favorite place<br />&nbsp;to play, unwind, and stay awhile.</p></div>
          <div className="mt-14 grid gap-4 md:grid-cols-3"><Feature icon={<span className="text-5xl leading-none" role="img" aria-label="Partly cloudy">🌤️</span>} number="" title="Open sky" text="Play outside. Enjoy&nbsp;wide-open views and&nbsp;a little more room to breathe." /><Feature icon={<Leaf size={30} />} number="" title="Easy pace" text="Book your court,&nbsp;bring your crew,&nbsp;and let the good&nbsp;times unfold." /><Feature icon={<img src={paddlesImage} alt="Pickleball paddles" className="h-10 w-10 object-contain" />} number="" title="All day play" text="Play by daylight,&nbsp;rally by moonlight." /></div>
        </section>

        <section id="rates" className="bg-[#e5e8d7] px-5 py-20 lg:px-8 lg:py-28"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><div className="text-sm font-bold uppercase tracking-[0.22em] text-[#6f8530]"><div>Less pay. More play.</div><div>Made for everyone.</div></div><h2 className="mt-4 font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">Easy, Affordable Court Rates</h2><p className="mt-4 text-[#596257]">Monday to Sunday · Open Daily | 20&nbsp; hours a day</p></div><button onClick={openBooking} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1f2920] px-6 py-4 font-bold text-white transition-transform hover:-translate-y-0.5">Reserve your court <ArrowRight size={17} /></button></div>
          <div className="mt-12 grid gap-5 md:grid-cols-2"><RateCard label="Day rate" time="6:00 AM — 4:00 PM" rate="P150" detail="per court / hour · weekday" accent="light" /><RateCard label="Night rate" time="4:00 PM — 2:00 AM" rate="P200" detail="per court / hour · weekday" accent="dark" /></div>
          <div className="mt-5 overflow-hidden rounded-3xl bg-white"><div className="grid grid-cols-5 border-b border-[#e5e8d7] bg-[#e5e8d7] px-5 py-4 text-xs font-bold uppercase tracking-[0.16em] text-[#6f8530] sm:px-8"><span>Play type</span><span>Time</span><span>Weekday · 1 court</span><span>Weekend · 1 court</span><span>2 courts</span></div>{[['Day play', '6 AM – 4 PM', 'P150/hr', 'P180/hr', 'P300/hr weekday · P360/hr weekend'], ['Night play', '4 PM – 2 AM', 'P200/hr', 'P230/hr', 'P400/hr weekday · P460/hr weekend']].map(([play, time, weekday, weekend, twoCourts]) => <div key={play} className="grid grid-cols-5 border-b border-[#eef0e8] bg-[#e5e8d7] px-5 py-4 text-sm last:border-0 sm:px-8"><span className="font-semibold">{play}</span><span className="text-[#596257]">{time}</span><span className="text-[#596257]">{weekday}</span><span className="text-[#596257]">{weekend}</span><span className="text-[#596257]">{twoCourts}</span></div>)}</div>
        </div></section>

        <section id="location" className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8 lg:py-28"><div><div className="text-sm font-bold uppercase tracking-[0.22em] text-[#6f8530]"><div>Come find us.</div><div>Pickle with us.</div></div><h2 className="mt-4 max-w-xl font-display text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl"><div>Escape the ordinary.</div><div>Your next game await at 8th Point, Silway 8.</div></h2><div className="mt-8 flex items-start gap-3 text-sm font-semibold"><MapPin className="mt-0.5 shrink-0 text-[#6f8530]" size={20} /><span>Gomez Compound<br />Lualhati Phase II Entrance Road<br />Purok Maunlad, Barangay Silway 8<br />Polomolok, South Cotabato, 9504<br /></span></div><a href="https://www.facebook.com/profile.php?id=61594654537062" target="_blank" rel="noreferrer" className="mt-9 inline-flex items-center gap-2 font-bold text-[#466124] underline decoration-[#c7e36d] decoration-4 underline-offset-4">Visit us on Facebook <ArrowRight size={16} /></a></div><div className="relative overflow-hidden rounded-[2rem] bg-[#1f2920] p-3"><img src={courtPhoto} alt="The pickleball court grounds" className="h-[360px] w-full rounded-[1.5rem] object-cover" /><div className="absolute bottom-8 left-8 rounded-2xl bg-white/90 px-5 py-4 text-sm font-bold text-[#1f2920] shadow-xl backdrop-blur"><div className="text-xs uppercase tracking-[0.18em] text-[#6f8530]">OPEN DAILY</div><div className="text-sm text-[#1f2920]">6 AM — 2 AM&nbsp;</div></div></div></section>
      </main>

      <footer className="bg-[#1f2920] px-5 py-10 text-white lg:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><img src={logo} alt="8th Point Pickle Farm" className="h-14 w-14 rounded-full object-cover" /><div><p className="font-display text-xl font-bold">8th Point Pickle Farm</p><p className="mt-1 text-xs text-white/55">Play outside. Stay awhile.</p></div></div><div className="flex items-center gap-6"><p className="text-sm text-white/55">Open Daily<br />Monday–Sunday ·</p><a href="/admin" className="flex items-center gap-2 text-sm font-semibold text-white/40 transition-colors hover:text-[#c7e36d]"><ShieldCheck size={15} /> Admin</a></div></div></footer>

      {bookingOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#152017]/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"><div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#f8f7f1] shadow-2xl sm:rounded-[2rem]"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e5e8d7] bg-[#f8f7f1]/95 px-5 py-4 backdrop-blur sm:px-8"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f8530]">Reserve your escape</p><h2 className="font-display text-2xl font-bold">Book a court</h2></div><button onClick={() => setBookingOpen(false)} className="rounded-full p-2 transition-colors hover:bg-[#e5e8d7]" aria-label="Close booking"><X /></button></div>{submittedCode ? <Confirmation code={submittedCode} payment={form.payment} hasReceipt={!!receiptFile} onClose={() => setBookingOpen(false)} /> : <form onSubmit={submitBooking} className="space-y-6 px-5 py-6 sm:px-8 sm:py-8"><div className="grid gap-4 sm:grid-cols-2"><Field label="Your name"><input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Full name" /></Field><Field label="Mobile number"><input required value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="09XX XXX XXXX" /></Field></div><div className="grid gap-4 sm:grid-cols-3"><Field label="Date"><input required type="date" min={today} value={form.date} onChange={(event) => updateForm('date', event.target.value)} /></Field><Field label="Start time"><input required type="time" min="06:00" max="23:00" value={form.startTime} onChange={(event) => updateForm('startTime', event.target.value)} /></Field><Field label="Hours"><div className="flex h-12 items-center justify-between rounded-xl border border-[#dfe4d3] bg-white px-3"><button type="button" onClick={() => updateForm('duration', Math.max(1, form.duration - 1))} className="rounded-lg p-1 hover:bg-[#e5e8d7]" aria-label="Decrease hours"><Minus size={16} /></button><span className="font-bold">{form.duration}</span><button type="button" onClick={() => updateForm('duration', Math.min(10, form.duration + 1))} className="rounded-lg p-1 hover:bg-[#e5e8d7]" aria-label="Increase hours"><Plus size={16} /></button></div></Field></div><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">Number of courts</label><div className="grid grid-cols-2 gap-3">{[1, 2].map((courts) => <button type="button" key={courts} onClick={() => updateForm('courts', courts)} className={`rounded-xl border px-4 py-3 text-left transition-colors ${form.courts === courts ? 'border-[#6f8530] bg-[#e5e8d7] ring-2 ring-[#c7e36d]' : 'border-[#dfe4d3] bg-white'}`}><span className="block font-bold">{courts} court{courts > 1 ? 's' : ''}</span><span className="text-xs text-[#6c756a]">{courts === 1 ? 'For small groups' : 'Bring the whole crew'}</span></button>)}</div></div><div className="rounded-2xl bg-[#1f2920] p-5 text-white"><div className="flex items-center justify-between"><span className="text-sm text-white/70">Estimated total</span><span className="font-display text-3xl font-bold text-[#c7e36d]">P{total.toLocaleString()}</span></div><p className="mt-2 text-xs text-white/55">Final confirmation follows payment review.</p></div><div className="overflow-hidden rounded-2xl border border-[#dfe4d3] bg-white p-3"><p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#6f8530]">Booking duration &amp; total</p><div className="overflow-hidden rounded-xl border border-[#eef0e8]"><div className="grid grid-cols-3 border-b border-[#e5e8d7] bg-[#e5e8d7] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f8530]"><span>Hours</span><span>Rate type</span><span>Estimated total</span></div>{Array.from({ length: 10 }, (_, i) => i + 1).map((hours) => { const hourTotal = calculateTotal(form.date, form.startTime, hours, form.courts); const rateType = (() => { const startHour = Number(form.startTime.split(':')[0]); return startHour >= 6 && startHour < 16 ? 'Day' : 'Night'; })(); return <div key={hours} className={`grid grid-cols-3 px-3 py-2 text-xs ${hours === form.duration ? 'bg-[#e5e8d7] font-bold' : 'bg-white'}`}><span>{hours} {hours === 1 ? 'hour' : 'hours'}</span><span className="text-[#596257]">{rateType} · {isWeekend(form.date) ? 'weekend' : 'weekday'}</span><span className="text-[#1f2920]">P{hourTotal.toLocaleString()}</span></div>; })}</div></div><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">Pay through</label><div className="grid grid-cols-2 gap-3">{['GoTyme Bank', 'MariBank'].map((payment) => <button type="button" key={payment} onClick={() => updateForm('payment', payment)} className={`rounded-xl border px-4 py-3 text-left font-bold transition-colors ${form.payment === payment ? 'border-[#6f8530] bg-[#e5e8d7] ring-2 ring-[#c7e36d]' : 'border-[#dfe4d3] bg-white'}`}>{payment}</button>)}</div><div className="mt-4 grid grid-cols-2 gap-3"><div className="overflow-hidden rounded-2xl bg-white p-2"><img src={gotymeQr} alt="GoTyme Bank payment QR code" className="aspect-square w-full object-cover" /><p className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#596257]">GoTyme Bank</p></div><div className="overflow-hidden rounded-2xl bg-white p-2"><img src={maribankQr} alt="MariBank payment QR code" className="aspect-square w-full object-cover" /><p className="p-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#596257]">MariBank</p></div></div></div><Field label="Payment reference number"><input required value={form.reference} onChange={handleReferenceChange} placeholder="Transfer reference or name used" />{referenceError && <p className="mt-1.5 text-sm font-semibold text-[#9f3e2c]">{referenceError}</p>}</Field><div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">Attach payment receipt <span className="text-[#9f3e2c]">*</span></label><div className="rounded-xl border border-dashed border-[#cdd6b8] bg-white px-4 py-5"><div className="flex items-center gap-3"><label className="flex items-center gap-2 rounded-full bg-[#e5e8d7] px-4 py-2.5 text-sm font-bold text-[#1f2920] transition-colors hover:bg-[#d3dab9] cursor-pointer"><Upload size={15} /> Choose file<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={handleReceiptChange} className="hidden" /></label>{receiptFile ? <span className="flex items-center gap-2 text-sm font-semibold text-[#466124]"><Check size={15} /> {receiptFile.name} <button type="button" onClick={() => setReceiptFile(null)} className="text-[#9f3e2c] hover:underline">Remove</button></span> : <span className="text-sm text-[#6c756a]">JPG, PNG, or WebP · max 5 MB</span>}</div>{receiptError && <p className="mt-2 text-sm font-semibold text-[#9f3e2c]">{receiptError}</p>}</div></div>{formError && <p className="rounded-xl bg-[#fbe9e4] px-4 py-3 text-sm font-semibold text-[#9f3e2c]">{formError}</p>}<button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c7e36d] px-6 py-4 font-bold text-[#1f2920] transition-all hover:bg-[#b5d35b] disabled:cursor-wait disabled:opacity-60">{isSubmitting ? 'Sending request...' : 'Submit booking request'} <ArrowRight size={18} /></button><p className="text-center text-xs leading-5 text-[#6c756a]">By submitting, you are requesting the selected schedule. We will use your mobile number to confirm availability.</p></form>}</div></div>}
    </div>
  );
}

function Feature({ icon, number, title, text }: { icon: React.ReactNode; number: string; title: string; text: string }) { return <div className="rounded-3xl border border-[#dfe4d3] bg-white p-7 transition-transform hover:-translate-y-1"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5e8d7] text-[#6f8530]">{icon}</span><span className="font-display text-3xl font-bold text-[#d8ddc8]">{number}</span></div><h3 className="mt-8 font-display text-2xl font-bold">{title}</h3><p className="mt-3 leading-7 text-[#6c756a]">{text}</p></div> }
function RateCard({ label, time, rate, detail, accent }: { label: string; time: string; rate: string; detail: string; accent: 'light' | 'dark' }) { return <div className={`rounded-3xl p-7 ${accent === 'dark' ? 'bg-[#1f2920] text-white' : 'bg-white'}`}><div className="flex items-start justify-between"><div><p className={`text-sm font-bold uppercase tracking-[0.18em] ${accent === 'dark' ? 'text-[#c7e36d]' : 'text-[#6f8530]'}`}>{label}</p><p className={`mt-3 ${accent === 'dark' ? 'text-white/70' : 'text-[#596257]'}`}>{time}</p></div><div className="text-right"><p className="font-display text-4xl font-bold">{rate}</p><p className={`text-xs ${accent === 'dark' ? 'text-white/50' : 'text-[#6c756a]'}`}>{detail}</p></div></div><div className={`mt-7 border-t pt-5 text-sm ${accent === 'dark' ? 'border-white/15 text-white/65' : 'border-[#e5e8d7] text-[#6c756a]'}`}>2 courts · {accent === 'dark' ? 'P400' : 'P300'} / hour</div></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">{label}</span>{children}</label> }
function Confirmation({ code, payment, hasReceipt, onClose }: { code: string; payment: string; hasReceipt: boolean; onClose: () => void }) { return <div className="px-5 py-14 text-center sm:px-12"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dfeec0] text-[#466124]"><Check size={30} /></div><p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[#6f8530]">Request received</p><h2 className="mt-3 font-display text-4xl font-bold">We got your booking.</h2><p className="mx-auto mt-4 max-w-md leading-7 text-[#596257]">Your request and payment receipt have been submitted. We will verify your payment and contact you on your mobile number to confirm your schedule.</p><div className="mx-auto mt-8 max-w-sm rounded-2xl border border-dashed border-[#aebc8a] bg-[#e5e8d7] px-5 py-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6f8530]">Your tracking number</p><p className="mt-2 font-mono text-2xl font-bold tracking-wider text-[#1f2920]">{code}</p><p className="mt-3 text-xs leading-5 text-[#6c756a]">Keep this number for your reference. Your confirmation code will be sent once payment is verified.</p></div><div className="mx-auto mt-4 max-w-sm space-y-2"><p className="flex items-center justify-center gap-2 text-sm text-[#596257]"><QrCode size={16} /> Payment selected: {payment}</p>{hasReceipt && <p className="flex items-center justify-center gap-2 text-sm font-semibold text-[#466124]"><Check size={15} /> Receipt attached for review</p>}</div><button onClick={onClose} className="mt-9 rounded-full bg-[#1f2920] px-7 py-4 font-bold text-white">Done</button></div> }

export default App;
