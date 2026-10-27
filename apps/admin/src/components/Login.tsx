import { useState, type FormEvent } from 'react';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button, IconWell, TextField } from '../ui';

export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-5">
        <div className="flex flex-col gap-3">
          <IconWell icon={ShieldCheck} size={56} />
          <div className="flex flex-col gap-1">
            <h1 className="t-display text-ink">CoC.M Admin</h1>
            <p className="t-body text-muted">Sign in with your CoC.M account. Only developer accounts can use this app.</p>
          </div>
        </div>

        {notice ? <p className="t-caption rounded-md bg-warning-soft px-3 py-2.5 text-warning-text">{notice}</p> : null}

        <div className="flex flex-col gap-4">
          <TextField label="Email" type="email" icon={Mail} required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" icon={Lock} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        </div>

        <Button type="submit" label="Sign in" loading={busy} fullWidth />
      </form>
    </main>
  );
}
