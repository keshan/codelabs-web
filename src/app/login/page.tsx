'use client';

import { createClient } from '@/lib/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Prevent hydration errors
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/'); // Redirect to home if already logged in
      }
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          router.push('/'); // Redirect on successful login
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router, isMounted]);

  if (!isMounted) {
    // Optional: Render a loading state or null during server rendering / hydration
    return null;
  }

  // Make sure NEXT_PUBLIC_SITE_URL is set in your .env.local for production
  const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '/auth/callback';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
        <h2 className="mb-6 text-center text-2xl font-semibold">Log In</h2>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={[]} 
          redirectTo={redirectUrl}
          view="sign_in" 
          theme="dark" 
          socialLayout="horizontal"
          showLinks={false} 
        />
      </div>
    </div>
  );
}
