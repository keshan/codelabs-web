import { fetchCodelabBySlug } from '@/lib/data/codelabs';
import { notFound } from 'next/navigation'; // Use Next.js notFound
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/ui/markdown/markdown-renderer'; // Import GFM plugin
import { createClient } from '@/lib/supabase/server';
import { FloatingEnvironmentManager } from '@/components/codelab/floating-environment-manager';
import { EnvironmentProvider } from '@/contexts/environment-context'; // Import the provider

// Define props type including params
interface CodelabPageProps {
  params: {
    slug: string;
  };
}

export default async function CodelabPage({ params }: CodelabPageProps) {
  const slug = params.slug; // Assign first, potentially satisfies the await check
  const codelab = await fetchCodelabBySlug(slug);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If codelab is not found, trigger Next.js 404 page
  if (!codelab) {
    return notFound();
  }

  return (
    <EnvironmentProvider>
      <main className="container mx-auto px-4 py-8 md:px-6 lg:py-12"> 
        {/* Back Link */}
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 group">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Codelabs
        </Link>

        {/* Codelab Header */}
        <header className="mb-8 md:mb-12">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-2">
            {codelab.title}
          </h1>
          {codelab.description && (
            <p className="text-lg text-muted-foreground">
              {codelab.description}
            </p>
          )}
        </header>

        {/* Environment Manager - Only shown if user is logged in */}
        {user && (
          <FloatingEnvironmentManager codelabId={codelab.id} userId={user.id} />
        )}

        {/* Main Content Area - Full Width */}
        <article className="prose dark:prose-invert max-w-4xl mx-auto">
          {codelab.content_markdown ? (
            <MarkdownRenderer content={codelab.content_markdown} />
          ) : (
            <p className="text-muted-foreground italic">No content available for this codelab.</p>
          )}
        </article>

        {/* Message for logged-out users */}
        {!user && (
          <div className="fixed bottom-4 right-4 w-72 rounded-lg border bg-card text-card-foreground shadow-md p-4 text-center z-50">
            <h3 className="text-sm font-semibold mb-2">Interactive Python</h3>
            <p className="text-xs text-muted-foreground mb-3"> 
              <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:no-underline">
                Log in
              </Link>
              {' '}to run Python code in this codelab.
            </p>
            <Button asChild size="sm">
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        )}
      </main>
    </EnvironmentProvider>
  );
}

// Optional: Generate static paths if you know all slugs beforehand
// export async function generateStaticParams() {
//   const codelabs = await fetchCodelabs(); // Fetch only slugs if possible
//   return codelabs.map((codelab) => ({
//     slug: codelab.slug,
//   }));
// }
