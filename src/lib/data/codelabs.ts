import { createClient } from '@/lib/supabase/server';
import { Codelab } from '@/types/codelab';

/**
 * Fetches a list of all codelabs.
 * Note: For production, implement pagination and proper RLS.
 * @returns Promise<Codelab[]>
 */
export async function fetchCodelabs(): Promise<Codelab[]> {
  const supabase = createClient();

  // Fetch basic codelab info, order by creation date
  // Note: In a real app, select only necessary columns and implement pagination
  const { data, error } = await supabase
    .from('codelabs')
    .select('id, slug, title, description, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching codelabs:', error);
    // Handle error appropriately - maybe throw or return empty array
    // depending on how you want the UI to react.
    throw new Error(`Failed to fetch codelabs: ${error.message}`);
  }

  // Ensure data conforms to the Codelab type, though Supabase client usually does
  return data as Codelab[];
}
