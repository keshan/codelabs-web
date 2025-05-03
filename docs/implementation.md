# Codelab Environment - Implementation Details

This document tracks key commands, configurations, database schemas, and the implementation status of the Codelab Environment project.

---

## 1. Setup & Development Commands

*   **Initial Setup:**
    ```bash
    # Clone the repository (replace with actual URL)
    git clone https://github.com/keshan/codelabs-web.git
    cd codelabs-web
    npm install
    ```
*   **Run Development Server:**
    ```bash
    npm run dev
    ```
*   **Dependency Installation:**
    ```bash
    # Core Supabase client
    npm install @supabase/supabase-js
    # Supabase Server-Side Rendering / Auth Helpers
    npm install @supabase/ssr @supabase/auth-helpers-nextjs
    # Markdown rendering
    npm install react-markdown remark-gfm
    # Enhanced Markdown styling & Syntax Highlighting
    npm install @tailwindcss/typography prism-react-renderer
    # Utility for classnames
    npm install clsx tailwind-merge
    ```
*   **Git Commits (Examples):**
    ```bash
    git add .
    git commit -m "feat: Implement initial Supabase auth setup"
    git commit -m "fix: Resolve layout hydration error"
    ```

---

## 2. Supabase Configuration & SQL

*   **Environment Variables (`.env.local`):**
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    ```

*   **`codelabs` Table Creation:**
    ```sql
    -- Codelabs table definition (as used)
    CREATE TABLE public.codelabs (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        title text NOT NULL,
        description text NULL,
        content_markdown text NULL,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        -- github_repo_url text NULL, -- Added in design, not yet implemented
        -- author_id uuid NULL REFERENCES auth.users(id), -- Added in design, not yet implemented
    );

    CREATE INDEX idx_codelabs_slug ON public.codelabs(slug);
    COMMENT ON TABLE public.codelabs IS 'Stores metadata and content for individual codelabs.';
    ALTER TABLE public.codelabs ENABLE ROW LEVEL SECURITY;
    ```

*   **`codelabs` RLS Policy (Public Read):**
    ```sql
    CREATE POLICY "Allow public read access" 
    ON public.codelabs
    FOR SELECT 
    USING (true);
    ```

*   **Sample Codelab Update:**
    ```sql
    -- Update statement for Python sample codelab
    UPDATE public.codelabs
    SET 
      title = 'Interactive Python Introduction',
      description = 'Learn basic Python concepts interactively.',
      content_markdown = E'# Interactive Python Basics\n\n... (full markdown content) ...',
      updated_at = now()
    WHERE 
      slug = 'hello-world-nextjs';
    ```

*   **`environments` Table Creation:**
    ```sql
    CREATE TABLE public.environments (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        codelab_id uuid NOT NULL REFERENCES public.codelabs(id) ON DELETE CASCADE,
        container_id text NULL,
        status text NOT NULL DEFAULT 'PENDING', -- Consider creating an enum: environment_status
        connection_details jsonb NULL,
        created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        last_accessed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
        CONSTRAINT environments_user_codelab_unique UNIQUE (user_id, codelab_id)
    );

    CREATE INDEX idx_environments_user_id ON public.environments(user_id);
    CREATE INDEX idx_environments_codelab_id ON public.environments(codelab_id);
    CREATE INDEX idx_environments_status ON public.environments(status);
    COMMENT ON TABLE public.environments IS 'Stores state and details of active user code execution environments.';
    ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
    ```

*   **`environments` RLS Policy (View Own):**
    ```sql
    CREATE POLICY "Allow user to view own environments"
    ON public.environments
    FOR SELECT USING (auth.uid() = user_id);
    ```

---

## 3. Key Code & Configuration Files

*   **Tailwind Config (`tailwind.config.js`):** Created and configured with `@tailwindcss/typography` plugin.
*   **Supabase Server Client (`src/lib/supabase/server.ts`):** Handles server-side Supabase client creation using cookies.
*   **Supabase Client (`src/lib/supabase/client.ts`):** Handles client-side Supabase instance.
*   **Classname Utility (`src/lib/utils.ts`):** Contains `cn()` function using `clsx` and `tailwind-merge`.
*   **Markdown Renderer (`src/components/ui/markdown/markdown-renderer.tsx`):** Custom component using `ReactMarkdown` and `CodeBlock`.
*   **Code Block (`src/components/ui/markdown/code-block.tsx`):** Custom component using `prism-react-renderer` for syntax highlighting.
*   **Login Page (`src/app/login/page.tsx`):** Customized Supabase Auth UI.
*   **Codelab Detail Page (`src/app/codelab/[slug]/page.tsx`):** Fetches data and uses `MarkdownRenderer`.
*   **Home Page (`src/app/page.tsx`):** Lists codelabs.
*   **Layout (`src/app/layout.tsx`):** Root layout.

---

## 4. Implementation Task List

*   [x] Setup Next.js Project with App Router
*   [x] Integrate Tailwind CSS
*   [x] Integrate Shadcn UI (basic components: Button, Card)
*   [x] Setup Supabase Project
*   [x] Configure Supabase Environment Variables
*   [x] Implement Supabase Server Client (`server.ts`)
*   [x] Implement Supabase Client Component (`client.ts`)
*   [x] Implement Login Page (Email/Password only, no signup)
*   [x] Define `codelabs` Table Schema
*   [x] Create `codelabs` Table in Supabase
*   [x] Add RLS Policy for Public Read on `codelabs`
*   [x] Implement Codelab Listing Page (`/`)
*   [x] Implement Dynamic Codelab Detail Page (`/codelab/[slug]`)
*   [x] Add Sample Codelab Data
*   [x] Implement Basic Markdown Rendering (`react-markdown`)
*   [x] Enhance Markdown Rendering (Typography Plugin)
*   [x] Implement Syntax Highlighting (`prism-react-renderer`, `CodeBlock` component)
*   [x] Create Custom `MarkdownRenderer` Component
*   [x] Define `environments` Table Schema
*   [x] Create `environments` Table in Supabase
*   [x] Add RLS Policy for User Read Own `environments`
*   [ ] Define `User` Table Schema (Implicit via `auth.users`)
*   [ ] Implement Environment Manager API (`/api/environments/...`)
*   [ ] Implement Docker Execution Environment Setup (e.g., Python image)
*   [ ] Integrate Frontend with Execution Environment (Run button, Output display)
*   [ ] Implement Real-time Communication (WebSockets for terminal/output)
*   [ ] Implement Environment Start/Stop Logic (API + Manager)
*   [ ] Implement Environment Termination Logic (Inactivity, Manual Stop)
*   [ ] Refine Authentication Flow (e.g., "Start Codelab" button redirects)
*   [ ] Add `github_repo_url`, `author_id` fields to `codelabs` table
*   [ ] Implement Deployment Setup (Dockerfile, Cloud Run config)
*   [ ] Add User Progress Tracking Feature
*   [ ] Add Codelab Authoring UI Feature

---
