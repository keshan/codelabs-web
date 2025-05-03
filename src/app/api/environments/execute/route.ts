import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';

// Zod schema for validating the request body
const executeCodeSchema = z.object({
    environmentId: z.string().uuid('Invalid Environment ID format'),
    code: z.string().min(1, 'Code cannot be empty'),
});

// Helper to get Auth client for GCP
const getAuth = () => {
    // GOOGLE_APPLICATION_CREDENTIALS should be set in .env.local
    // Remove scopes to avoid conflict when requesting ID tokens
    return new GoogleAuth();
};

// Interface for the expected response from the Python execution service
interface ExecutionResult {
    stdout: string;
    stderr: string;
    exit_code: number;
}

export async function POST(request: Request) {
    const supabase = createClient();
    const auth = getAuth();

    // 1. Check User Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('[Execute API] Auth Error:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user_id = user.id;

    // 2. Validate Request Body
    let validatedData;
    try {
        const body = await request.json();
        const validation = executeCodeSchema.safeParse(body);
        if (!validation.success) {
            console.error('[Execute API] Invalid request body:', validation.error.errors);
            return NextResponse.json({ error: 'Invalid request body', details: validation.error.errors }, { status: 400 });
        }
        validatedData = validation.data;
    } catch (e) {
        console.error('[Execute API] Error parsing request body:', e);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { environmentId, code } = validatedData;

    try {
        // 3. Fetch Environment Details & Verify Ownership/Status
        console.log(`[Execute API] Fetching environment details for ID: ${environmentId}`);
        const { data: environment, error: fetchError } = await supabase
            .from('environments')
            .select('id, user_id, status, connection_details')
            .eq('id', environmentId)
            .eq('user_id', user_id) // Ensure ownership
            .single();

        if (fetchError) {
            console.error(`[Execute API] DB Error fetching environment ${environmentId}:`, fetchError);
            return NextResponse.json({ error: 'Environment not found or database error' }, { status: 404 });
        }

        if (!environment) {
            return NextResponse.json({ error: 'Environment not found or permission denied' }, { status: 404 });
        }

        if (environment.status !== 'RUNNING') {
            console.warn(`[Execute API] Attempt to execute on non-running environment ${environmentId} (Status: ${environment.status})`);
            return NextResponse.json({ error: `Environment is not running (status: ${environment.status})` }, { status: 409 }); // 409 Conflict
        }

        const serviceUrl = environment.connection_details?.serviceUrl;
        if (!serviceUrl) {
            console.error(`[Execute API] Missing serviceUrl in connection_details for environment ${environmentId}`);
            return NextResponse.json({ error: 'Environment configuration error: Missing service URL' }, { status: 500 });
        }

        // 4. Get Authentication Token for Cloud Run
        console.log(`[Execute API] Attempting to get ID token for target audience: ${serviceUrl}`);
        const client = await auth.getIdTokenClient(serviceUrl);
        // Note: getIdTokenClient automatically handles token acquisition and refresh

        // 5. Call the Cloud Run Execution Service
        const executeEndpoint = `${serviceUrl}/execute`; // The endpoint defined in our python server
        console.log(`[Execute API] Sending execution request to: ${executeEndpoint}`);
        
        const response = await client.request({
            url: executeEndpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code }), // Send only the code
            timeout: 45000, // Timeout for the request itself (e.g., 45 seconds)
        });

        console.log(`[Execute API] Received response status: ${response.status}`);

        if (response.status !== 200) {
             console.error(`[Execute API] Error from execution service (${response.status}):`, response.data);
             // Try to parse error detail if available
             const errorDetail = response.data ? JSON.stringify(response.data) : 'No details available';
             return NextResponse.json({ error: `Execution service failed with status ${response.status}`, details: errorDetail }, { status: 502 }); // 502 Bad Gateway
        }

        // 6. Return the Result from the Execution Service
        // Assuming the execution service returns JSON like { stdout: ..., stderr: ..., exit_code: ... }
        const result = response.data as ExecutionResult; 
        // Use the cast type - optional chaining might still be good practice if the cast could fail silently
        console.log(`[Execute API] Execution successful. Exit code: ${result?.exit_code ?? 'N/A'}`); 
        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error('[Execute API] Unexpected Error:', error);
        // Differentiate between auth errors and fetch errors
        if (error.response) {
            // Error from the client.request call
             console.error(`[Execute API] Error during request to execution service (${error.response.status}):`, error.response.data);
              return NextResponse.json({ error: 'Failed to communicate with execution service', details: error.response.data }, { status: 502 });
        } else if (error.message.includes('compute identity')) {
            // Likely an issue getting the ID token
            console.error('[Execute API] Failed to get ID token:', error.message);
            return NextResponse.json({ error: 'Authentication error communicating with cloud environment' }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal server error during execution' }, { status: 500 });
    }
}
