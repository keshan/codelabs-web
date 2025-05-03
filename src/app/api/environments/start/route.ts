import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { ServicesClient } from '@google-cloud/run';
import { google } from '@google-cloud/run/build/protos/protos'; // Specific types like IService

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

    // --- GCP Configuration ---
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION;
    const gcrImagePath = process.env.GCR_IMAGE_PATH;

    if (!projectId || !location || !gcrImagePath) {
      console.error('[Start API] Missing required GCP environment variables (GCP_PROJECT_ID, GCP_REGION, GCR_IMAGE_PATH)');
      return NextResponse.json({ error: 'Server configuration error: Missing GCP settings.' }, { status: 500 });
    }

    const parent = `projects/${projectId}/locations/${location}`;
    const runClient = new ServicesClient();

    // --- Helper Function for Service Creation ---
    async function createCloudRunService(serviceName: string): Promise<string> {
      console.log(`[Start API] Creating new Cloud Run service: ${serviceName}`);
      // Let TypeScript infer the type, as the explicit IService type doesn't match the creation structure
      const serviceConfig = {
        metadata: {
          name: serviceName,
          namespace: projectId,
          annotations: { 'run.googleapis.com/launch-stage': 'BETA' },
        },
        template: {
          containers: [{
            image: gcrImagePath,
            ports: [{ containerPort: 8080 }],
            resources: {
              limits: { cpu: '1000m', memory: '512Mi' },
            },
          }],
        },
        traffic: [{
          type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST' as const,
          percent: 100,
        }],
      };

      try {
        const [operation] = await runClient.createService({
          parent: parent,
          service: serviceConfig,
          serviceId: serviceName,
        });
        console.log(`[Start API] Waiting for Cloud Run service ${serviceName} creation operation...`);
        const lroResponse = await operation.promise();
        const createdService = lroResponse[0];

        if (createdService?.uri) {
          console.log(`[Start API] Cloud Run service ${serviceName} created successfully at ${createdService.uri}`);
          return createdService.uri;
        } else {
          console.error('[Start API] Cloud Run service created but no URI found in LRO response:', lroResponse);
          throw new Error('Cloud Run service created, but failed to get its URL.');
        }
      } catch (creationError: any) {
        console.error(`[Start API] GCP Error during createService ${serviceName}:`, creationError);
        throw new Error(`Failed to create Cloud Run service: ${creationError.details || creationError.message}`);
      }
    }
    // --- End Helper Function ---

    // --- Trigger Actual Environment Creation (Cloud Run) --- 
    const serviceName = `codelab-env-${envToProcess.id}`.toLowerCase(); // Ensure lowercase for service name
    const servicePath = `${parent}/services/${serviceName}`;
    let serviceUrl: string;

    try {
      console.log(`[Start API] Checking for existing Cloud Run service: ${serviceName}`);
      // Check if service already exists (simple check, more robust logic might be needed)
      try {
        const [existingService] = await runClient.getService({ name: servicePath });
        console.log(`[Start API] Found existing Cloud Run service: ${serviceName}`);
        if (existingService.uri) {
          serviceUrl = existingService.uri;
          // Optionally: Check if it's healthy or needs update
        } else {
          // Service exists but lacks URI. Delete it first.
          console.warn(`[Start API] Existing service ${serviceName} found but has no URI. Deleting before recreating...`);
          try {
            const [deleteOperation] = await runClient.deleteService({ name: servicePath });
            console.log(`[Start API] Waiting for deletion of unusable service ${serviceName}...`);
            await deleteOperation.promise();
            console.log(`[Start API] Unusable service ${serviceName} deleted successfully.`);
            // Now create it
            serviceUrl = await createCloudRunService(serviceName);
          } catch (deleteError: any) {
            console.error(`[Start API] Failed to delete existing unusable service ${serviceName}:`, deleteError);
            throw new Error(`Failed to clean up unusable existing service: ${deleteError.details || deleteError.message}`);
          }
        }
      } catch (getErr: any) {
        if (getErr.code === 5) { // 5 = NOT_FOUND (or simulated NOT_FOUND)
          // Service not found, create it.
          console.log(`[Start API] No existing service found. Creating new Cloud Run service: ${serviceName}`);
          serviceUrl = await createCloudRunService(serviceName);
        } else {
          // Handle other errors during getService (permissions, etc.)
          console.error(`[Start API] GCP Error checking for service ${serviceName}:`, getErr);
          throw new Error(`Failed to check Cloud Run service status: ${getErr.details || getErr.message}`);
        }
      }
    } catch (gcpError: any) {
      console.error(`[Start API] GCP Error creating/getting service ${serviceName}:`, gcpError);
      // Update DB to ERROR state maybe?
      await supabase.from('environments').update({ status: 'ERROR', last_accessed_at: new Date().toISOString(), connection_details: { error: `GCP Error: ${gcpError.message}` } }).eq('id', envToProcess.id);
      return NextResponse.json({ error: 'Failed to create or access cloud environment' }, { status: 500 });
    }

    // Ensure we got a service URL before proceeding
    if (!serviceUrl) {
      console.error(`[Start API] Failed to obtain service URL for environment ${envToProcess.id}`);
      await supabase.from('environments').update({ status: 'ERROR', last_accessed_at: new Date().toISOString(), connection_details: { error: 'Failed to obtain Cloud Run service URL.' } }).eq('id', envToProcess.id);
      return NextResponse.json({ error: 'Failed to obtain cloud environment URL' }, { status: 500 });
    }

    // --- Update Environment Record Status to RUNNING --- 
    console.log(`[Start API] Updating environment ${envToProcess.id} status to RUNNING in DB...`);
    const { data: updatedEnv, error: updateError } = await supabase
      .from('environments')
      .update({
        status: 'RUNNING',
        connection_details: { serviceUrl: serviceUrl }, // Store the Cloud Run service URL
        container_id: null, // We are not using a specific container ID here
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', envToProcess.id)
      // RLS Check: user_id is checked during the initial select/insert
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
