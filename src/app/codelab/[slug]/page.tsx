import { fetchCodelabBySlug } from '@/lib/data/codelabs';
import { notFound } from 'next/navigation'; // Use Next.js notFound
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/ui/markdown/markdown-renderer'; // Import GFM plugin

// Define props type including params
interface CodelabPageProps {
  params: {
    slug: string;
  };
}

export default async function CodelabPage({ params }: CodelabPageProps) {
  const { slug } = await params;
  const codelab = await fetchCodelabBySlug(slug);

  // If codelab is not found, trigger Next.js 404 page
  if (!codelab) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <nav className="mb-6">
        <Button asChild variant="outline">
          <Link href="/">← Back to Codelabs</Link>
        </Button>
      </nav>

      <article className="prose dark:prose-invert max-w-none">
        {/* Basic title display */}
        <h1>{codelab.title}</h1>

        {/* Render Markdown content */}
        <div className="mt-8">
          <MarkdownRenderer 
            content={codelab.content_markdown || '*No content available.*'} 
          />
        </div>

        {/* Placeholder for future interactive elements */}
        <div className="mt-8 border-t pt-4">
          <h2 className="text-xl font-semibold mb-2">Interactive Area</h2>
          <p className="text-muted-foreground">Interactive elements (terminal, execution buttons) will go here.</p>
          {/* TODO: Add authentication check here - only show interactive elements if logged in */}
        </div>
      </article>
    </div>
  );
}

// Optional: Generate static paths if you know all slugs beforehand
// export async function generateStaticParams() {
//   const codelabs = await fetchCodelabs(); // Fetch only slugs if possible
//   return codelabs.map((codelab) => ({
//     slug: codelab.slug,
//   }));
// }
