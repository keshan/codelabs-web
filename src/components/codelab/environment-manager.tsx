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
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

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
    setIsStarting(true);

    console.log(`[startEnvironment] Called. Current state: environmentId=${environment?.id}, status=${environment?.status}`);
    
    // Only proceed if not already running or starting
    if (environment?.status === 'RUNNING') {
      console.log('[startEnvironment] Already running. Skipping.');
      setIsLoading(false);
      setIsStarting(false);
      return;
    }

    try {
      console.log('[startEnvironment] Sending request to /api/environments/start');
      const response = await fetch('/api/environments/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codelabId }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || response.statusText;
        console.error('Error starting environment:', errorMessage, 'Status:', response.status);
        setError(errorMessage || `Failed to start environment (Status: ${response.status})`);
        setEnvironment(null);
        setIsLoading(false);
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
    } finally {
      setIsStarting(false);
    }
  }, [codelabId, environment, setEnvironment, setError, setIsLoading, startPolling]);

  const stopEnvironment = useCallback(async () => {
    if (!environment || environment.status !== 'RUNNING') {
      console.log('[stopEnvironment] Cannot stop, not in RUNNING state.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsStopping(true);
    stopPolling(); // Stop any active polling immediately

    try {
      console.log(`[stopEnvironment] Stopping environment: ${environment.id}`);
      const response = await fetch('/api/environments/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ environmentId: environment.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || response.statusText;
        console.error('Error stopping environment:', errorMessage, 'Status:', response.status);
        setError(errorMessage || `Failed to stop environment (Status: ${response.status})`);
      } else {
        console.log('[stopEnvironment] Successfully stopped. New state:', data);
        setEnvironment(data);
        setError(null);
      }
    } catch (err) {
      console.error('Error in stopEnvironment:', err);
      setError((err as Error).message || 'An unknown error occurred while stopping.');
    } finally {
      setIsLoading(false);
      setIsStopping(false);
    }
  }, [environment, setEnvironment, setError, setIsLoading, stopPolling]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchInitialEnvironment();

    // Cleanup polling on unmount
    return () => {
      stopPolling();
    };
  }, [fetchInitialEnvironment, stopPolling]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <span className="text-gradient bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Interactive Environment</span>
          {environment?.status === 'RUNNING' && (
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500"></span>
          )}
        </CardTitle>
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
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center justify-center rounded-full p-1.5",
                environment.status === 'RUNNING' && "bg-green-100 dark:bg-green-900/50",
                environment.status === 'PENDING' && "bg-yellow-100 dark:bg-yellow-900/50",
                environment.status === 'STOPPED' && "bg-gray-100 dark:bg-gray-800/50",
                environment.status === 'ERROR' && "bg-red-100 dark:bg-red-900/50"
              )}>
                {environment.status === 'RUNNING' && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
                {environment.status === 'PENDING' && <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />}
                {environment.status === 'STOPPED' && <Power className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
                {environment.status === 'ERROR' && <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />}
              </div>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-semibold",
                    environment.status === 'RUNNING' && "text-green-600 dark:text-green-400",
                    environment.status === 'PENDING' && "text-yellow-600 dark:text-yellow-400",
                    environment.status === 'STOPPED' && "text-gray-600 dark:text-gray-400",
                    environment.status === 'ERROR' && "text-red-600 dark:text-red-400"
                  )}>
                    {environment.status}
                  </span>
                  
                  {environment.status === 'RUNNING' && (
                    <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:border-green-900/30 dark:bg-green-900/20 dark:text-green-400">
                      Ready
                    </div>
                  )}
                </div>
                
                <span className="text-xs text-muted-foreground">
                  {environment.status === 'RUNNING' && "Your Python environment is up and running"}
                  {environment.status === 'PENDING' && "Initializing your environment..."}
                  {environment.status === 'STOPPED' && "Environment is currently inactive"}
                  {environment.status === 'ERROR' && "Failed to initialize the environment"}
                </span>
              </div>
            </div>
            
            {environment.status === 'RUNNING' && environment.container_id && (
              <div className="rounded-md bg-muted/50 p-2 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Session ID</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border/50">{environment.container_id.substring(0, 8)}</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!environment && !isLoading && (
          <div className="mb-4 p-3 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              Start your Python sandbox to execute code interactively
            </p>
          </div>
        )}

        <div className="flex space-x-3 mt-2">
          {(!environment || environment.status === 'STOPPED' || environment.status === 'ERROR') && (
            <Button 
              onClick={startEnvironment} 
              disabled={isStarting || isStopping}
              size="sm"
              className="relative overflow-hidden group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
              {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {isStarting ? 'Starting...' : 'Start Environment'}
            </Button>
          )}
          {environment && environment.status === 'RUNNING' && (
            <Button 
              variant="outline"
              onClick={stopEnvironment} 
              disabled={isStarting || isStopping} 
              size="sm"
              className="border-red-200 bg-red-50 hover:bg-red-100 text-red-700 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
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
