import { createClient } from '@/lib/supabase/server';
import LogoutButton from '@/components/auth/logout-button';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { fetchCodelabs } from '@/lib/data/codelabs';
import { Codelab } from '@/types/codelab';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let codelabs: Codelab[] = [];
  let fetchError = null;
  try {
    codelabs = await fetchCodelabs();
  } catch (error) {
    console.error(error);
    fetchError = error instanceof Error ? error.message : 'An unknown error occurred.';
  }

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

      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold mb-4">Explore Interactive Codelabs</h2>
          <p className="text-muted-foreground">
            Learn by doing with our hands-on tutorials.
          </p>
        </div>

        {fetchError && (
          <div className="text-red-500 text-center mb-8">
            <p>Error loading codelabs: {fetchError}</p>
          </div>
        )}

        {/* Codelab Listing */} 
        {!fetchError && codelabs.length === 0 && (
          <p className="text-center text-muted-foreground">No codelabs available yet.</p>
        )}
        
        {!fetchError && codelabs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {codelabs.map((codelab) => (
              <Card key={codelab.id}>
                <CardHeader>
                  <CardTitle>{codelab.title}</CardTitle>
                  <CardDescription>{codelab.description || 'No description available.'}</CardDescription>
                </CardHeader>
                <CardFooter>
                  {/* Link to the specific codelab page (we'll create this later) */}
                  <Button asChild variant="default" className="w-full">
                    {/* Update href later when codelab/[slug] page exists */}
                    <Link href={`/codelab/${codelab.slug}`}>Start Codelab</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

    </main>
  );
}
