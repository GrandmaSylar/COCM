import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { getTheme } from './lib/api';
import { isConfigured, supabase } from './lib/supabase';
import { useTheme } from './theme/ThemeProvider';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string>();
  const { applySynced } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Match the colors saved in the Expo/web app. Best effort: the defaults are fine if this fails.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      applySynced(null, null);
      return;
    }
    let cancelled = false;
    getTheme()
      .then((theme) => !cancelled && applySynced(theme.colors, theme.mode))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, applySynced]);

  if (!isConfigured) {
    return <p className="t-body p-6 text-ink">Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in.</p>;
  }
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-subtle" size={24} />
      </div>
    );
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
