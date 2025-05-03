'use client';

import React, { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Check,
  Clipboard,
  FileTerminal,
  Play,
  Loader2,
  Terminal,
  AlertCircle,
} from 'lucide-react';
import { useEnvironment } from '@/contexts/environment-context';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [isCopied, setIsCopied] = useState(false);
  const { environment } = useEnvironment();

  // State for execution
  const [isExecuting, setIsExecuting] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  // Normalize language prop, default to 'plaintext'
  const normalizedLanguage = language?.toLowerCase() || 'plaintext';

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [code]);

  // --- Execution Logic ---
  const handleRunCode = async () => {
    if (!environment || environment.status !== 'RUNNING') {
      setExecError('Environment is not running. Start it first.');
      setOutput(null);
      return;
    }

    setIsExecuting(true);
    setOutput(null);
    setExecError(null);

    try {
      const response = await fetch('/api/environments/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          environmentId: environment.id,
          language: normalizedLanguage,
          code: code,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Execution failed with status: ${response.status}`);
      }

      setOutput(result.output);
      setExecError(null);
    } catch (error: any) {
      console.error('Execution error:', error);
      setExecError(error.message || 'An unexpected error occurred during execution.');
      setOutput(null);
    } finally {
      setIsExecuting(false);
    }
  };
  // --- End Execution Logic ---

  // Use nightOwl theme as per previous adjustment
  const theme = themes.nightOwl;

  const Icon = isCopied ? Check : Clipboard;

  return (
    <div className="code-block-container relative group rounded-lg bg-zinc-900 font-mono text-sm my-6 overflow-hidden border border-zinc-700/50">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700/50">
        {/* Language Indicator */}
        <span className="flex items-center text-zinc-300 text-xs font-semibold">
          {/* Optional: Add language icon here later */}
          {/* <FileTerminal className="w-3.5 h-3.5 mr-1.5 text-sky-300" /> */}
          {normalizedLanguage}
        </span>

        {/* Run Button - Only show for runnable languages & when env is running */}
        {normalizedLanguage === 'python' && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 mr-1 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleRunCode}
            disabled={isExecuting || environment?.status !== 'RUNNING'}
            aria-label="Run code"
            title={environment?.status === 'RUNNING' ? 'Run code' : 'Environment not running'}
          >
            {isExecuting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        {/* Copy Button */}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
          onClick={copyToClipboard}
          aria-label="Copy code"
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable Code Area */}
      <Highlight theme={theme} code={code.trimEnd()} language={normalizedLanguage}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={cn(className, 'overflow-x-auto p-4 text-xs sm:text-sm')}
            // Apply theme background only to the pre block
            style={{ ...style, backgroundColor: theme.plain.backgroundColor }}
          >
            {tokens.map((line, i) => (
              <div
                key={i}
                {...getLineProps({ line })}
                className="table-row"
              >
                <span className="table-cell select-none pr-4 text-right text-muted-foreground opacity-50">
                  {i + 1}
                </span>
                <span className="table-cell">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
          </pre>
        )}
      </Highlight>

      {/* --- Output Area --- */}
      {(output !== null || execError !== null) && (
        <div className="output-area border-t border-zinc-700/50 bg-zinc-800/50 px-4 py-3">
          <div className="flex items-center text-xs text-zinc-400 mb-2">
            <Terminal className="w-3.5 h-3.5 mr-1.5" />
            <span>Output</span>
          </div>
          {output !== null && (
            <pre className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap font-mono">
              {output}
            </pre>
          )}
          {execError !== null && (
            <div className="text-xs sm:text-sm text-red-400 flex items-start">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 mt-0.5 flex-shrink-0" />
              <span className="font-mono">{execError}</span>
            </div>
          )}
        </div>
      )}
      {/* --- End Output Area --- */}
    </div>
  );
}
