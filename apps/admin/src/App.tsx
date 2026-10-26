import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { isConfigured, supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return <p className="p-6 text-sm">Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.</p>;
  }
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (!session) return <Login notice={notice} />;

  return (
    <Dashboard
      email={session.user.email ?? ''}
      onSignOut={async (reason) => {
        setNotice(reason);
        // 'local' only ends this browser's session; the default would sign the
        // user out of every device, including the main app.
        await supabase.auth.signOut({ scope: 'local' });
      }}
    />
  );
}
