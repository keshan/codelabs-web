import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServicesClient } from '@google-cloud/run';

// Zod schema for validating the request body
const stopEnvironmentSchema = z.object({
  environmentId: z.string().uuid('Invalid Environment ID format'),
});

export async function POST(request: Request) {
  const supabase = createClient();

  // 1. Check User Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('[Stop API] Auth Error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate Request Body
  let validatedData;
  try {
    const body = await request.json();
    const validation = stopEnvironmentSchema.safeParse(body);
    if (!validation.success) {
      console.error('[Stop API] Invalid request body:', validation.error.errors);
      return NextResponse.json({ error: 'Invalid request body', details: validation.error.errors }, { status: 400 });
    }
    validatedData = validation.data;
  } catch (e) {
    console.error('[Stop API] Error parsing request body:', e);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { environmentId } = validatedData;
  const user_id = user.id;

  try {
    // --- GCP Configuration ---
    const projectId = process.env.GCP_PROJECT_ID || 'gdeprojects';
    const location = process.env.GCP_REGION || 'asia-southeast1';
    const parent = `projects/${projectId}/locations/${location}`;
    const runClient = new ServicesClient();

    // --- Trigger Actual Environment Stop (Cloud Run) ---
    const serviceName = `codelab-env-${environmentId}`.toLowerCase();
    const servicePath = `${parent}/services/${serviceName}`;

    try {
      console.log(`[Stop API] Attempting to delete Cloud Run service: ${serviceName}`);
      // Check if service exists before attempting deletion to avoid unnecessary errors
      try {
        await runClient.getService({ name: servicePath }); // Check existence
        // Service exists, proceed with deletion
        const [operation] = await runClient.deleteService({ name: servicePath });
        console.log(`[Stop API] Waiting for Cloud Run service ${serviceName} deletion operation...`);
        await operation.promise(); // Wait for deletion to complete
        console.log(`[Stop API] Cloud Run service ${serviceName} deleted successfully.`);
      } catch (getErr: any) {
        if (getErr.code === 5) { // 5 = NOT_FOUND
          console.log(`[Stop API] Cloud Run service ${serviceName} not found. Assuming already deleted or never created.`);
          // No action needed if it doesn't exist
        } else {
          // Re-throw other errors encountered during getService
          throw getErr;
        }
      }
    } catch (gcpError: any) {
      // Log the error but proceed to update DB status anyway
      console.error(`[Stop API] GCP Error deleting service ${serviceName}:`, gcpError);
      // Depending on requirements, you might want to NOT update the DB status if deletion fails
      // return NextResponse.json({ error: 'Failed to delete cloud environment' }, { status: 500 });
    }

    // 3. Update Environment Record Status to STOPPED
    console.log(`[Stop API] Attempting to update environment ${environmentId} status to STOPPED...`);
    const { data: updatedEnv, error: updateError } = await supabase
      .from('environments')
      .update({
        status: 'STOPPED',
        connection_details: null, // Clear connection details on stop
        // Optionally clear container_id as well
        // container_id: null,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', environmentId)
      // RLS Policy Check: Ensure the user owns this environment
      .eq('user_id', user_id)
      .select()
      .single();

    if (updateError) {
       // This could be an RLS issue (shouldn't happen with correct policy) or DB error
       console.error(`[Stop API] DB Error updating ${environmentId} to STOPPED:`, updateError);
       // Check if it was just that the row didn't match (e.g., wrong user ID or env ID)
       if (updateError.code === 'PGRST116') { // Not found or RLS prevented update
           return NextResponse.json({ error: 'Environment not found or permission denied' }, { status: 404 });
       }
       return NextResponse.json({ error: 'Database error stopping environment' }, { status: 500 });
    }

    console.log(`[Stop API] Environment ${updatedEnv.id} status updated to STOPPED.`);
    return NextResponse.json(updatedEnv, { status: 200 });

  } catch (error) {
    console.error('[Stop API] Unexpected Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
