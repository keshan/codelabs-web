'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './code-block';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // @ts-ignore - ReactMarkdown types don't match perfectly with the actual properties
          code({ node, inline, className, children, ...props }) {
            if (inline) {
              return (
                <code className="rounded bg-secondary/50 px-1 py-0.5 font-mono text-sm" {...props}>
                  {children}
                </code>
              );
            }
            
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            return (
              <CodeBlock 
                code={String(children).replace(/\n$/, '')} 
                language={language || 'text'}
              />
            );
          },
          h1: ({ children }) => (
            <h1 className="mb-6 mt-2 text-3xl font-bold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-4 mt-10 text-2xl font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-4 mt-8 text-xl font-semibold tracking-tight">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="my-6 ml-6 list-disc [&>li]:mt-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-6 ml-6 list-decimal [&>li]:mt-2">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          p: ({ children }) => <p className="leading-7 [&:not(:first-child)]:mt-6">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="mt-6 border-l-2 border-primary pl-6 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="font-medium text-primary underline underline-offset-4">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="rounded-md" />
          ),
          table: ({ children }) => (
            <div className="my-6 w-full overflow-y-auto">
              <table className="w-full">{children}</table>
            </div>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => (
            <th className="border px-4 py-2 text-left font-bold">{children}</th>
          ),
          td: ({ children }) => <td className="border px-4 py-2">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
