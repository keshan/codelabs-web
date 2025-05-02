import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/auth/logout-button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <nav className="flex w-full items-center justify-between p-4 shadow-md mb-8">
        <h1 className="text-xl font-bold">Codelabs Platform</h1>
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-sm">Welcome, {user.email}</span>
              <LogoutButton />
            </div>
          ) : (
            <Button asChild variant="outline">
              <Link href="/login">Login / Sign Up</Link>
            </Button>
          )}
        </div>
      </nav>

      <div className="text-center">
        <h2 className="text-3xl font-semibold mb-4">Explore Interactive Codelabs</h2>
        <p className="text-muted-foreground mb-8">
          Learn by doing with our hands-on tutorials.
        </p>
        {/* Placeholder for Codelab list or other content */} 
        {user ? (
          <p>You are logged in. Browse the available codelabs below.</p>
        ) : (
          <p>Please log in to start a codelab and run code.</p>
        )}
      </div>

      {/* Future Codelab Listing Component Goes Here */} 

    </main>
  );
}
