import { FormEvent, useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const logo = '/images/825260840_1093383066614513_6902349529276500923_n.webp';

export default function AdminAuth() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) setError(signInError);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1f2920] px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <img src={logo} alt="8th Point Pickle Farm" className="h-16 w-16 rounded-full object-cover ring-4 ring-[#c7e36d]/30" />
          <h1 className="mt-5 font-display text-3xl font-bold">Admin access</h1>
          <p className="mt-2 text-sm text-white/60">Sign in to manage court reservations</p>
        </div>
        <div className="rounded-3xl bg-[#f8f7f1] p-7 shadow-2xl sm:p-9">
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">Email</span>
              <div className="flex items-center gap-3 rounded-xl border border-[#dfe4d3] bg-white px-4">
                <Mail size={17} className="text-[#9aa78a]" />
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-12 w-full bg-transparent outline-none" />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.13em] text-[#596257]">Password</span>
              <div className="flex items-center gap-3 rounded-xl border border-[#dfe4d3] bg-white px-4">
                <Lock size={17} className="text-[#9aa78a]" />
                <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="h-12 w-full bg-transparent outline-none" />
              </div>
            </label>
            {error && <p className="rounded-xl bg-[#fbe9e4] px-4 py-3 text-sm font-semibold text-[#9f3e2c]">{error}</p>}
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#c7e36d] px-6 py-4 font-bold text-[#1f2920] transition-all hover:bg-[#b5d35b] disabled:opacity-60">
              {submitting ? 'Please wait...' : 'Sign in'} <ArrowRight size={18} />
            </button>
          </form>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-[#6c756a]"><ShieldCheck size={14} className="text-[#6f8530]" /> Authorized admin access only. New accounts cannot be created.</p>
        </div>
      </div>
    </div>
  );
}
