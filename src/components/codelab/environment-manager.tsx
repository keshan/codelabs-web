'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  PlayCircle, 
  XCircle, 
  Power 
} from 'lucide-react';
import { cn } from '@/lib/utils'; 
import { useEnvironment, Environment } from '@/contexts/environment-context'; 

interface EnvironmentManagerProps {
  codelabId: string;
  userId: string; 
}

export function EnvironmentManager({ codelabId, userId }: EnvironmentManagerProps) {
  const { 
    environment, 
    setEnvironment, 
    isLoading, 
    setIsLoading, 
    error, 
    setError, 
  } = useEnvironment();

  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalId) {
      console.log('[stopPolling] Clearing interval ID:', pollingIntervalId);
      clearInterval(pollingIntervalId);
      setPollingIntervalId(null);
      console.log('Polling stopped.');
    }
  }, [pollingIntervalId]);

  const pollStatus = useCallback(async (envId: string) => {
    console.log('Polling status for:', envId);
    let response: Response | null = null; // Define response outside try block
    try {
      response = await fetch(`/api/environments/status/${envId}`);

      // Try to parse JSON only if response is likely OK, otherwise handle error first
      if (!response.ok) {
        // Attempt to get error text, fallback to status text
        let errorMessage = response.statusText;
        try {
           // Try parsing as JSON, might contain an error object
           const errorData = await response.json();
           errorMessage = errorData?.error || errorData?.message || errorMessage;
        } catch (jsonError) {
           // If JSON parsing fails, stick with status text
           console.warn('[pollStatus] Could not parse error response body as JSON.');
        }
        
        console.error('[pollStatus] Polling error:', errorMessage, 'Status:', response.status);
        setError(errorMessage || `Polling failed (Status: ${response.status})`);
        stopPolling(); // Stop polling on error
        setEnvironment(prev => prev ? { ...prev, status: 'ERROR' } : null); 
        setIsLoading(false);
        return;
      }

      // If response.ok, proceed to parse JSON
      const data: Environment = await response.json();

      setEnvironment(data);

      console.log(`[pollStatus] Received status: '${data.status}' for env: ${envId}`);

      // Stop polling if the status is no longer PENDING
      if (data.status !== 'PENDING') {
        console.log(`[pollStatus] Status is not PENDING (${data.status}). Stopping polling.`);
        stopPolling();
        setIsLoading(false); // Finished loading/pending
      } else {
        console.log(`[pollStatus] Status is PENDING. Continuing polling.`);
      }
    } catch (err) {
      // Catch fetch errors or unexpected issues
      console.error('[pollStatus] Fetch/unexpected error during polling:', err);
      setError((err as Error).message || 'An unexpected network error occurred during polling.');
      stopPolling();
      setIsLoading(false);
    }
  }, [setEnvironment, setError, setIsLoading, stopPolling]); // Added dependencies

  const startPolling = useCallback((envId: string) => {
    stopPolling(); // Clear any existing interval
    console.log('[startPolling] Starting polling for:', envId);
    // Poll immediately first
    pollStatus(envId);
    // Then set interval
    const intervalId = setInterval(() => pollStatus(envId), 5000); // Poll every 5 seconds
    console.log('[startPolling] Set interval ID:', intervalId);
    setPollingIntervalId(intervalId);
  }, [pollStatus, stopPolling]);

  const fetchInitialEnvironment = useCallback(async () => {
    if (!userId || !codelabId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/environments/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codelab_id: codelabId }),
      });

      const data: Environment = await response.json(); 

      if (!response.ok) { 
        const errorPayload = data as any; 
        const message = errorPayload?.error || errorPayload?.message || response.statusText;
        console.error('Error starting environment:', message, 'Status:', response.status);
        setError(message || `Failed to start environment (Status: ${response.status})`);
        setEnvironment(null); 
      } else {
        setEnvironment(data); 
        setError(null);

        if (data.status === 'PENDING') {
          startPolling(data.id); 
        } else {
          setIsLoading(false); 
        }
      }
    } catch (err) {
      console.error('Fetch error in startEnvironment:', err);
      setError((err as Error).message || 'An unexpected network error occurred.');
      setEnvironment(null);
      setIsLoading(false); 
    } 
  }, [codelabId, userId, setEnvironment, setIsLoading, setError, startPolling]);

  const startEnvironment = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    console.log(`[startEnvironment] Called. Current state: environmentId=${environment?.id}, status=${environment?.status}`);
    
    // Only proceed if not already running or starting
    if (environment?.status === 'RUNNING') {
      console.log('[startEnvironment] Already running. Skipping.');
      setIsLoading(false);
      return;
    }

    try {
      console.log('[startEnvironment] Sending request to /api/environments/start');
      const response = await fetch('/api/environments/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codelab_id: codelabId }),
      });

      const data: Environment = await response.json(); 

      if (!response.ok) { 
        const errorPayload = data as any; 
        const message = errorPayload?.error || errorPayload?.message || response.statusText;
        console.error('Error starting environment:', message, 'Status:', response.status);
        setError(message || `Failed to start environment (Status: ${response.status})`);
        setEnvironment(null); 
      } else {
        setEnvironment(data); 
        setError(null);

        if (data.status === 'PENDING') {
          startPolling(data.id); 
        } else {
          setIsLoading(false); 
        }
      }
    } catch (err) {
      console.error('Fetch error in startEnvironment:', err);
      setError((err as Error).message || 'An unexpected network error occurred.');
      setEnvironment(null);
      setIsLoading(false); 
    } 
  }, [codelabId, userId, setEnvironment, setIsLoading, setError, startPolling, environment]);

  const stopEnvironment = useCallback(async () => {
    if (!environment || environment.status !== 'RUNNING') {
      console.log('[stopEnvironment] Cannot stop, not in RUNNING state.');
      return;
    }

    setIsLoading(true);
    setError(null);
    stopPolling(); // Stop any active polling immediately

    console.log(`[stopEnvironment] Stopping environment: ${environment.id}`);

    try {
      const response = await fetch('/api/environments/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environmentId: environment.id }),
      });

      const data: Environment = await response.json();

      if (!response.ok) {
        const errorPayload = data as any;
        const message = errorPayload?.error || errorPayload?.message || response.statusText;
        console.error('Error stopping environment:', message, 'Status:', response.status);
        setError(message || `Failed to stop environment (Status: ${response.status})`);
        // Update state partially to reflect failure if needed, or leave as RUNNING
        // setEnvironment(prev => prev ? { ...prev, status: 'ERROR' } : null);
      } else {
        console.log('[stopEnvironment] Successfully stopped. New state:', data);
        setEnvironment(data); // Update state to STOPPED
        setError(null);
      }
    } catch (err) {
      console.error('Error in stopEnvironment:', err);
      setError((err as Error).message || 'An unknown error occurred while stopping.');
    } finally {
      setIsLoading(false);
    }
  }, [environment, setEnvironment, setError, stopPolling]);

  useEffect(() => {
    fetchInitialEnvironment();
    return () => {
      stopPolling();
    };
  }, [fetchInitialEnvironment, stopPolling]);

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Interactive Environment</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4 border-red-500/50 text-red-500 dark:border-red-500 [&>svg]:text-red-500">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Starting Environment</AlertTitle>
            {error && <AlertDescription>{error}</AlertDescription>}
          </Alert>
        )}

        {environment && (
          <div className="space-y-3 text-sm">
            <div className={cn(
              "flex items-center p-3 rounded-md",
              environment.status === 'RUNNING' && "bg-green-100 dark:bg-green-900/30",
              environment.status === 'PENDING' && "bg-yellow-100 dark:bg-yellow-900/30",
              environment.status === 'STOPPED' && "bg-gray-100 dark:bg-gray-800/30",
              environment.status === 'ERROR' && "bg-red-100 dark:bg-red-900/30"
            )}>
              {environment.status === 'RUNNING' && <CheckCircle2 className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />}
              {environment.status === 'PENDING' && <Loader2 className="h-5 w-5 mr-2 text-yellow-600 dark:text-yellow-400 animate-spin" />}
              {environment.status === 'STOPPED' && <Power className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />}
              {environment.status === 'ERROR' && <XCircle className="h-5 w-5 mr-2 text-red-600 dark:text-red-400" />}
              <span className={cn(
                "font-medium",
                environment.status === 'RUNNING' && "text-green-700 dark:text-green-300",
                environment.status === 'PENDING' && "text-yellow-700 dark:text-yellow-300",
                environment.status === 'STOPPED' && "text-gray-700 dark:text-gray-300",
                environment.status === 'ERROR' && "text-red-700 dark:text-red-300"
              )}>Status: {environment.status}</span>
            </div>

            {environment.status === 'RUNNING' && environment.container_id && (
              <p className="text-muted-foreground">
                Active Session: <code className="text-xs bg-muted px-1 py-0.5 rounded">{environment.container_id}</code>
              </p>
            )}
            {environment.status === 'RUNNING' && (
              <p className="text-green-600 dark:text-green-400">Your interactive environment is ready.</p>
            )}
            {environment.status === 'PENDING' && (
              <p className="text-yellow-600 dark:text-yellow-400">Your environment is being created...</p>
            )}
            {environment.status === 'STOPPED' && (
              <p className="text-gray-600 dark:text-gray-400">Environment is stopped.</p>
            )}
            {environment.status === 'ERROR' && (
              <p className="text-red-600 dark:text-red-400">Failed to start environment. Please try again.</p>
            )}
          </div>
        )}

        {!environment && !isLoading && (
          <p className="text-sm text-muted-foreground mb-4">
            Ready to code? Start your personal sandbox for this codelab.
          </p>
        )}

        <div className="flex space-x-2">
          {(!environment || environment.status === 'STOPPED' || environment.status === 'ERROR') && (
            <Button 
              onClick={startEnvironment} 
              disabled={isStarting || isStopping} 
              size="sm"
            >
              {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {isStarting ? 'Starting...' : 'Start Environment'}
            </Button>
          )}
          {environment && environment.status === 'RUNNING' && (
            <Button 
              variant="destructive" 
              onClick={stopEnvironment} 
              disabled={isStarting || isStopping} 
              size="sm"
            >
              {isStopping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
              {isStopping ? 'Stopping...' : 'Stop Environment'}
            </Button>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
