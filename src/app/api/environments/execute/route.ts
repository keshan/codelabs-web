import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Execute API - Auth Error:', userError);
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    console.error('Execute API - Invalid JSON:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { environmentId, language, code } = requestData;

  // --- Input Validation ---
  if (!environmentId || typeof environmentId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid environmentId' }, { status: 400 });
  }
  if (!language || typeof language !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid language' }, { status: 400 });
  }
  if (code === undefined || typeof code !== 'string') { // Allow empty code string
    return NextResponse.json({ error: 'Missing or invalid code' }, { status: 400 });
  }
  // --- End Validation ---

  try {
    // 1. Verify the environment exists, belongs to the user, and is RUNNING
    const { data: environment, error: fetchError } = await supabase
      .from('environments')
      .select('id, status, user_id')
      .eq('id', environmentId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      console.error('Execute API - DB Error fetching env:', fetchError);
      return NextResponse.json({ error: 'Failed to verify environment' }, { status: 500 });
    }

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found or access denied' }, { status: 404 });
    }

    if (environment.status !== 'RUNNING') {
      return NextResponse.json({ error: `Environment is not RUNNING (status: ${environment.status})` }, { status: 409 }); // 409 Conflict
    }

    // 2. *** SIMULATE CODE EXECUTION ***
    // In a real system, this is where you'd send the 'code' to the actual container 
    // associated with 'environmentId' and wait for stdout/stderr.
    // This simulation is very basic.
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000)); // Simulate network/exec time
    
    let simulatedOutput = '';
    let simulatedError = null;

    if (language.toLowerCase() === 'python') {
      if (code.trim() === 'print("Hello, Codelab World!")') {
        simulatedOutput = 'Hello, Codelab World!\n';
      } else if (code.includes('syntax error')) {
         simulatedOutput = '';
         simulatedError = 'SyntaxError: invalid syntax (simulated)';
      } else if (code.trim() === '') {
        simulatedOutput = ''; // No output for empty code
      } else if (code.trim().startsWith('print')) {
        // Try to simulate simple prints
        const match = code.match(/print\((.*)\)/);
        if (match && match[1]) {
          // VERY basic eval simulation - assumes a simple string or variable name
          const content = match[1].trim();
          if (content.startsWith('\"') && content.endsWith('\"')) {
            simulatedOutput = content.slice(1, -1) + '\n';
          } else {
            // Assume it might be a variable from previous step (not implemented here)
            simulatedOutput = `(Simulated value for ${content})\n`;
          } 
        } else {
           simulatedOutput = `(Simulated output for: ${code.trim()})\n`;
        }
      } else {
        // Generic success for other Python code (no specific output)
        simulatedOutput = `(Simulated execution ok for: ${code.trim()})\n`;
      }
    } else {
      simulatedError = `Execution for language '${language}' is not supported in this simulation.`;
    }
    // *** END SIMULATION ***

    if (simulatedError) {
       // Simulate sending error output
       // Return 200 OK but with an error in the body for frontend handling
       return NextResponse.json({ error: simulatedError }, { status: 200 }); 
    }

    // 3. Return the simulated output
    return NextResponse.json({ output: simulatedOutput });

  } catch (error: any) {
    console.error('Execute API - Unexpected Error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected server error occurred' }, { status: 500 });
  }
}
