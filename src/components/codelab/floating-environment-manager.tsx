'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  PlayCircle, 
  XCircle, 
  Power,
  Terminal,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils'; 
import { useEnvironment, Environment } from '@/contexts/environment-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FloatingEnvironmentManagerProps {
  codelabId: string;
  userId: string; 
}

export function FloatingEnvironmentManager({ codelabId, userId }: FloatingEnvironmentManagerProps) {
  const { 
    environment, 
    setEnvironment, 
    isLoading, 
    setIsLoading, 
    error, 
    setError, 
  } = useEnvironment();

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
    let response: Response | null = null;
    try {
      response = await fetch(`/api/environments/status/${envId}`);

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
           const errorData = await response.json();
           errorMessage = errorData?.error || errorData?.message || errorMessage;
        } catch (jsonError) {
           console.warn('[pollStatus] Could not parse error response body as JSON.');
        }
        
        console.error('[pollStatus] Polling error:', errorMessage, 'Status:', response.status);
        setError(errorMessage || `Polling failed (Status: ${response.status})`);
        stopPolling();
        setEnvironment(prev => prev ? { ...prev, status: 'ERROR' } : null); 
        setIsLoading(false);
        return;
      }

      const data: Environment = await response.json();
      setEnvironment(data);

      console.log(`[pollStatus] Received status: '${data.status}' for env: ${envId}`);

      if (data.status !== 'PENDING') {
        console.log(`[pollStatus] Status is not PENDING (${data.status}). Stopping polling.`);
        stopPolling();
        setIsLoading(false);
      } else {
        console.log(`[pollStatus] Status is PENDING. Continuing polling.`);
      }
    } catch (err) {
      console.error('[pollStatus] Fetch/unexpected error during polling:', err);
      setError((err as Error).message || 'An unexpected network error occurred during polling.');
      stopPolling();
      setIsLoading(false);
    }
  }, [setEnvironment, setError, setIsLoading, stopPolling]);

  const startPolling = useCallback((envId: string) => {
    stopPolling();
    console.log('[startPolling] Starting polling for:', envId);
    pollStatus(envId);
    const intervalId = setInterval(() => pollStatus(envId), 5000);
    console.log('[startPolling] Set interval ID:', intervalId);
    setPollingIntervalId(intervalId);
  }, [pollStatus, stopPolling]);

  const fetchInitialEnvironment = useCallback(async () => {
    if (!userId || !codelabId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/environments/retrieve?codelabId=${codelabId}`);
      
      if (!response.ok) {
        if (response.status !== 404) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          console.error('[fetchInitialEnvironment] Error retrieving environment:', errorData);
          setError(errorData?.error || 'Failed to retrieve environment status.');
        }
        setIsLoading(false);
        return;
      }

      const env: Environment = await response.json();
      console.log('[fetchInitialEnvironment] Retrieved environment:', env);
      setEnvironment(env);
      
      if (env.status === 'PENDING') {
        console.log('[fetchInitialEnvironment] Environment is PENDING, starting polling');
        startPolling(env.id);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[fetchInitialEnvironment] Unexpected error:', err);
      setError((err as Error).message || 'An unexpected error occurred getting environment');
      setIsLoading(false);
    }
  }, [codelabId, setEnvironment, setError, setIsLoading, startPolling, userId]);

  const startEnvironment = async () => {
    if (!userId || !codelabId) {
      setError('Missing user ID or codelab ID');
      return;
    }

    setError(null);
    setIsLoading(true);
    setIsStarting(true);
    setIsOpen(true); // Open the popover to show loading state

    try {
      const response = await fetch('/api/environments/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          codelabId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to start environment');
        setIsLoading(false);
        setIsStarting(false);
        return;
      }

      console.log('[startEnvironment] Environment started:', data);
      setEnvironment(data);
      
      if (data.status === 'PENDING') {
        startPolling(data.id);
      } else {
        setIsLoading(false);
      }

    } catch (err) {
      console.error('[startEnvironment] Error starting environment:', err);
      setError((err as Error).message || 'An unexpected error occurred');
      setIsLoading(false);
    } finally {
      setIsStarting(false);
    }
  };

  const stopEnvironment = async () => {
    if (!environment) return;
    
    setError(null);
    setIsStopping(true);

    try {
      const response = await fetch('/api/environments/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environmentId: environment.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[stopEnvironment] Failed to stop environment:', data);
        setError(data.error || 'Failed to stop environment');
        setIsStopping(false);
        return;
      }

      console.log('[stopEnvironment] Environment stopped:', data);
      setEnvironment(data);
    } catch (err) {
      console.error('[stopEnvironment] Error stopping environment:', err);
      setError((err as Error).message || 'An unexpected error occurred');
    } finally {
      setIsStopping(false);
    }
  };

  // Auto-open the popover when there's an error or environment is running/pending
  useEffect(() => {
    if (error || (environment && (environment.status === 'RUNNING' || environment.status === 'PENDING'))) {
      setIsOpen(true);
    }
  }, [error, environment]);

  // Initial fetch on component mount
  useEffect(() => {
    fetchInitialEnvironment();

    // Cleanup polling on unmount
    return () => {
      stopPolling();
    };
  }, [fetchInitialEnvironment, stopPolling]);

  const getStatusClasses = () => {
    if (!environment) return '';
    
    return cn(
      environment.status === 'RUNNING' && 'bg-green-500',
      environment.status === 'PENDING' && 'bg-yellow-500',
      environment.status === 'STOPPED' && 'bg-gray-400',
      environment.status === 'ERROR' && 'bg-red-500'
    );
  };

  const getButtonText = () => {
    if (!environment) return 'Run Python Code';
    
    const statusText: Record<string, string> = {
      'RUNNING': 'Environment Active',
      'PENDING': 'Starting...',
      'STOPPED': 'Run Python Code',
      'ERROR': 'Environment Error'
    };
    
    return statusText[environment.status] || 'Run Python Code';
  };

  const renderIcon = () => {
    if (isLoading || isStarting) {
      return <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
    }
    
    if (!environment) return <Terminal className="h-4 w-4 mr-2" />;
    
    switch (environment.status) {
      case 'RUNNING': return <CheckCircle2 className="h-4 w-4 mr-2" />;
      case 'PENDING': return <Loader2 className="h-4 w-4 mr-2 animate-spin" />;
      case 'STOPPED': return <Terminal className="h-4 w-4 mr-2" />;
      case 'ERROR': return <AlertCircle className="h-4 w-4 mr-2" />;
      default: return <Terminal className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 print:hidden">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    size="sm" 
                    variant={environment?.status === 'RUNNING' ? "default" : "outline"}
                    className={cn(
                      "gap-1.5 shadow-md hover:shadow-lg transition-all",
                      environment?.status === 'RUNNING' && "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-none"
                    )}
                  >
                    {renderIcon()}
                    <span>{getButtonText()}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    {environment?.status === 'RUNNING' && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-80 p-0 shadow-lg" 
                  sideOffset={5}
                  align="end"
                >
                  <div className="px-4 py-3 border-b bg-muted/40">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Python Environment</h3>
                      {environment && (
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            getStatusClasses(),
                          )}></span>
                          <span className="text-xs font-medium uppercase">
                            {environment.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    {error && (
                      <Alert variant="destructive" className="text-sm py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs">Error</AlertTitle>
                        <AlertDescription className="text-xs">{error}</AlertDescription>
                      </Alert>
                    )}

                    {environment && environment.status === 'RUNNING' && (
                      <div className="text-sm space-y-1">
                        <p className="text-green-600 dark:text-green-400 font-medium">
                          Your Python environment is running
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Execute Python code using the run buttons in the code blocks.
                        </p>
                        
                        {environment.container_id && (
                          <div className="mt-2 text-xs bg-muted/50 p-2 rounded border border-border/50">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Session ID</span>
                              <code className="font-mono bg-background px-1.5 py-0.5 rounded border border-border/50">
                                {environment.container_id.substring(0, 8)}
                              </code>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {environment && environment.status === 'PENDING' && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                        <span className="text-sm">Initializing your Python environment...</span>
                      </div>
                    )}

                    {environment && environment.status === 'ERROR' && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Environment failed to initialize. Please try again.
                      </p>
                    )}

                    {environment && environment.status === 'STOPPED' && (
                      <p className="text-sm text-muted-foreground">
                        Start your Python environment to run interactive code.
                      </p>
                    )}

                    {!environment && !isLoading && (
                      <p className="text-sm text-muted-foreground">
                        Start your Python environment to run interactive code.
                      </p>
                    )}

                    <div className="flex justify-end pt-2">
                      {(!environment || environment.status === 'STOPPED' || environment.status === 'ERROR') && (
                        <Button 
                          onClick={startEnvironment} 
                          disabled={isStarting || isStopping}
                          size="sm"
                          className="relative overflow-hidden group bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg transition-all duration-300"
                        >
                          {isStarting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Start Environment
                            </>
                          )}
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
                          {isStopping ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Stopping...
                            </>
                          ) : (
                            <>
                              <Power className="mr-2 h-4 w-4" />
                              Stop Environment
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Python Environment Controls</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
