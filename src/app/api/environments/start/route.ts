import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Define the expected request body schema
const startEnvironmentSchema = z.object({
  codelab_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = createClient();

  // 1. Check Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('API Auth Error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Validate Request Body
  let validatedData;
  try {
    const body = await request.json();
    validatedData = startEnvironmentSchema.parse(body);
  } catch (error) {
    console.error('API Validation Error:', error);
    return NextResponse.json({ error: 'Invalid request body', details: (error as z.ZodError).errors }, { status: 400 });
  }

  const { codelab_id } = validatedData;
  const user_id = user.id;

  try {
    // 3. Check for Existing Environment
    const { data: existingEnv, error: existingError } = await supabase
      .from('environments')
      .select('*')
      .eq('user_id', user_id)
      .eq('codelab_id', codelab_id)
      .maybeSingle(); // Use maybeSingle to get one or null

    if (existingError) {
      console.error('API DB Error (Checking Existing):', existingError);
      return NextResponse.json({ error: 'Database error checking environment' }, { status: 500 });
    }

    let envToProcess: any = existingEnv; // Use 'any' for easier handling temporarily
    let httpStatus = 200; // Default status for returning existing/updated

    // If environment exists AND is already RUNNING, just update access time and return it.
    if (existingEnv && existingEnv.status === 'RUNNING') {
      console.log(`[Start API] Found existing environment with status 'RUNNING'. Returning.`);
      // Update last_accessed_at (best effort, don't block response)
      supabase
        .from('environments')
        .update({ last_accessed_at: new Date().toISOString() })
        .match({ id: existingEnv.id })
        .then(({ error: updateError }) => {
          if (updateError) {
            console.error('Failed to update last_accessed_at:', updateError);
          }
        });
      return NextResponse.json(existingEnv, { status: 200 });
    }

    // --- If environment does NOT exist, or it exists but is NOT RUNNING (i.e., PENDING, STOPPED, ERROR) --- 

    if (!existingEnv) {
      console.log('No existing environment found. Creating new one.');
      // 4. Create New Environment Record (Status: PENDING)
      const { data: newEnv, error: insertError } = await supabase
        .from('environments')
        .insert({
          user_id: user_id,
          codelab_id: codelab_id,
          status: 'PENDING', // Start as PENDING
          // container_id and connection_details will be updated after creation
        })
        .select()
        .single(); // Get the newly created record

      if (insertError) {
        // Handle potential unique constraint violation (user already has env for this codelab)
        if (insertError.code === '23505') { // PostgreSQL unique violation code
          console.warn('Unique constraint violation on environment insert, likely race condition.');
          // Re-fetch the existing environment as it was likely created between the check and insert
          const { data: raceEnv, error: raceError } = await supabase
            .from('environments')
            .select('*')
            .eq('user_id', user_id)
            .eq('codelab_id', codelab_id)
            .single(); 
          if (raceError) {
            console.error('API DB Error (Fetching after race condition):', raceError);
            return NextResponse.json({ error: 'Database error resolving race condition' }, { status: 500 });
          }
          if (raceEnv) {
             // If found during race condition check, treat it like an existing PENDING or other status
             envToProcess = raceEnv;
             if (raceEnv.status !== 'PENDING') { 
                console.log(`Race condition resolved: Found existing env with status ${raceEnv.status}. Returning.`);
                return NextResponse.json(raceEnv, { status: 200 }); 
             }
             console.log(`Race condition resolved: Found existing env with status PENDING (ID: ${raceEnv.id}). Proceeding to update.`);
          } else {
              // Should not happen if constraint failed, but safety check
              console.error('API DB Error: Unique constraint violation but failed to re-fetch');
              return NextResponse.json({ error: 'Database error resolving race condition' }, { status: 500 });
          }
        } else {
          // Other insert errors
          console.error('API DB Error (Inserting):', insertError);
          return NextResponse.json({ error: 'Database error creating environment' }, { status: 500 });
        }
      } else {
        // Successfully created new record
        envToProcess = newEnv;
        httpStatus = 201; // Set status to 201 Created
        console.log(`Created new environment record (PENDING) with ID: ${envToProcess!.id}`);
      }
    } else {
      // Environment exists and is NOT RUNNING (i.e., PENDING, STOPPED, ERROR)
      console.log(`Existing environment found with status ${existingEnv.status} (ID: ${existingEnv.id}). Proceeding to update.`);
      // envToProcess is already set to existingEnv
      // httpStatus remains 200 (OK, since we updated an existing resource)
    }

    // Ensure we have an environment to process before continuing
    if (!envToProcess) {
      console.error('API Logic Error: envToProcess is null after check/create logic.');
      return NextResponse.json({ error: 'Internal server error processing environment state' }, { status: 500 });
    }

    // --- At this point, envToProcess is either a newly created PENDING record,
    // --- or an existing record with status PENDING, STOPPED, or ERROR.
    // --- Proceed to simulation and update to RUNNING. ---

    // --- TODO: Trigger Actual Environment Creation (Simulation) --- 
    // This is where you would call Cloud Run, Docker API, etc.
    // For now, we simulate success and update the status immediately.
    // In a real scenario, this might involve polling or waiting for a callback.
    console.log(`Simulating creation/update for environment ${envToProcess.id}...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    const simulatedContainerId = `sim-${envToProcess.id.substring(0, 8)}`;
    const simulatedConnectionDetails = { internalUrl: `http://${simulatedContainerId}:8080` };
    // --- End Simulation ---

    // 5. Update Environment Record (Status: RUNNING, add details)
    console.log(`Attempting to update environment ${envToProcess.id} to RUNNING...`);
    const { data: updatedEnv, error: updateError } = await supabase
      .from('environments')
      .update({
        status: 'RUNNING',
        container_id: simulatedContainerId,
        connection_details: simulatedConnectionDetails,
        last_accessed_at: new Date().toISOString() // Update access time
      })
      .eq('id', envToProcess.id) // Update the record we're processing
      .select()
      .single();

    if (updateError) {
      console.error('API DB Error (Updating to RUNNING):', updateError);
      // Consider how to handle this - maybe set status to ERROR?
      // The record might remain PENDING if the update fails.
      return NextResponse.json({ error: 'Database error updating environment status after simulation' }, { status: 500 });
    }
    
    console.log(`Environment ${updatedEnv.id} status updated to RUNNING.`);

    // 6. Return Newly Created/Updated Environment
    // Use the determined httpStatus (201 for new, 200 for updated PENDING)
    return NextResponse.json(updatedEnv, { status: httpStatus }); 

  } catch (error) {
    console.error('API Unexpected Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
