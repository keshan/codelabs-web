import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define the expected URL parameters
const paramsSchema = z.object({
  environmentId: z.string().uuid(),
});

// Define context type for params
interface RouteContext {
  params: z.infer<typeof paramsSchema>;
}

export async function GET(request: Request, context: RouteContext) {
  const supabase = createClient();

  // 1. Validate URL parameters
  console.log('[Status API] Received context.params:', context.params);
  const resolvedParams = await context.params; // Await the params
  console.log('[Status API] Resolved params:', resolvedParams);
  const paramsValidation = paramsSchema.safeParse(resolvedParams); // Validate the resolved object
  console.log('[Status API] Zod validation result:', paramsValidation);
  if (!paramsValidation.success) {
    console.error('[Status API] Invalid environment ID format. Errors:', paramsValidation.error.errors);
    return NextResponse.json({ error: 'Invalid environment ID format' }, { status: 400 });
  }
  const { environmentId } = paramsValidation.data;

  // 2. Check Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('Status API - Auth Error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 3. Fetch Environment Data
    const { data: environment, error: fetchError } = await supabase
      .from('environments')
      .select('*') // Select all columns for the frontend
      .eq('id', environmentId)
      .eq('user_id', user.id) // Ensure user owns this environment
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // PostgREST code for 'Not found'
        console.warn(`Status API - Environment ${environmentId} not found for user ${user.id}`);
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
      }
      console.error('Status API - DB Error fetching env:', fetchError);
      return NextResponse.json({ error: 'Database error fetching environment status' }, { status: 500 });
    }

    if (!environment) {
       // Should be caught by PGRST116, but good fallback
       return NextResponse.json({ error: 'Environment not found or access denied' }, { status: 404 });
    }

    // 4. Return Environment Data
    return NextResponse.json(environment);

  } catch (error: any) {
    console.error('Status API - Unexpected Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected server error occurred' }, { status: 500 });
  }
}
