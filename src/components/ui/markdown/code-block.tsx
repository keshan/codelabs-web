'use client';

import React from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

interface CodeBlockProps {
  code: string;
  language: string;
  filename?: string;
}

export function CodeBlock({ code, language, filename }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = React.useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <Card className="my-6 overflow-hidden border bg-secondary/20">
      {filename && (
        <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
          <span>{filename}</span>
        </div>
      )}
      <CardContent className="p-0">
        <Highlight 
          theme={themes.nightOwl} 
          code={code.trim()} 
          language={language || 'text'}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre 
              className={cn(
                "overflow-x-auto rounded-md py-4 text-sm leading-relaxed",
                className
              )} 
              style={style}
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
      </CardContent>
      <CardFooter className="flex justify-between bg-muted/50 px-4 py-2">
        <div className="text-xs text-muted-foreground">{language}</div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={copyToClipboard}
          className="h-8 px-2 text-xs"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </CardFooter>
    </Card>
  );
}
