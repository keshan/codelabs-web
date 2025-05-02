# Codelab Environment - Design Document

## 1. Introduction

This document outlines the design for a Codelab Environment platform. The goal is to create a web application inspired by Google Codelabs, allowing users to follow tutorials and execute code within secure, isolated sandbox environments. The platform will be built using Next.js, TypeScript, and Tailwind CSS, designed for deployment on Google Cloud Run via Docker.

## 2. Goals

*   Provide a platform for hosting interactive codelabs.
*   Enable authenticated users to run code snippets or commands within dedicated, isolated environments.
*   Ensure security by restricting environment access to authenticated users only.
*   Support fetching codelab content potentially from external sources like GitHub.
*   Build a modern, maintainable, and scalable application using Next.js and Tailwind CSS.
*   Package the application using Docker for easy deployment on Google Cloud Run.

## 3. Architecture Overview

```mermaid
graph TD
    A[User Browser] --> B(Next.js Frontend - Codelab UI);
    B --> C{Next.js API Routes / Backend API};
    C --> D[Authentication Service (e.g., Supabase Auth, NextAuth.js)];
    C --> E[Database (e.g., Supabase Postgres)];
    C --> F(Environment Manager);
    F --> G[Docker / Cloud Run Service];
    G --> H(Isolated User Environment - Container);
    B <-.-> H;  // Direct interaction (e.g., WebSockets for terminal)
```

*   **Frontend:** Next.js application serving the UI (codelab content, instructions, editor, terminal). Uses React Server Components (RSC) where possible, client components for interactivity.
*   **Backend/API:** Next.js API Routes handle data fetching, authentication, and requests to manage environments.
*   **Authentication Service:** Manages user sign-up, login, and session management. JWTs will likely be used to secure API endpoints.
*   **Database:** Stores user information, codelab metadata, environment state, etc.
*   **Environment Manager:** A service (potentially part of the API routes or a separate microservice) responsible for provisioning, managing, and terminating user execution environments.
*   **Execution Environments:** Isolated environments (likely Docker containers) where user code runs. Each authenticated user gets a dedicated environment per active codelab session.

## 4. Technology Stack

*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **UI Components:** Shadcn UI / Radix UI (Recommended for rapid development)
*   **Authentication:** Supabase Auth (Recommended for integration with DB) or NextAuth.js
*   **Database:** PostgreSQL (via Supabase or Cloud SQL)
*   **Execution Environments:** Docker
*   **Orchestration/Hosting:** Google Cloud Run (potentially GKE if more complex orchestration is needed for environments)
*   **Real-time Communication (Terminal):** WebSockets (e.g., using `socket.io` or similar)
*   **State Management (Client):** Zustand or React Context/Reducer (if needed for complex client state)
*   **Schema Validation:** Zod

## 5. Data Models (Initial)

*   **User:**
    *   `id` (uuid, primary key)
    *   `email` (text, unique)
    *   `auth_provider_id` (text, unique)
    *   `name` (text, optional)
    *   `avatar_url` (text, optional)
    *   `created_at` (timestampz)
*   **Codelab:**
    *   `id` (uuid, primary key)
    *   `slug` (text, unique, index)
    *   `title` (text)
    *   `description` (text)
    *   `content_markdown` (text)
    *   `github_repo_url` (text, optional) // For fetching/linking
    *   `author_id` (uuid, foreign key -> User, optional)
    *   `created_at` (timestampz)
    *   `updated_at` (timestampz)
*   **Environment:** (Represents an active user sandbox)
    *   `id` (uuid, primary key)
    *   `user_id` (uuid, foreign key -> User, index)
    *   `codelab_id` (uuid, foreign key -> Codelab, index)
    *   `container_id` (text) // Or other identifier from Cloud Run/Docker
    *   `status` (enum: PENDING, RUNNING, STOPPED, ERROR)
    *   `connection_details` (jsonb, optional) // e.g., internal URL, ports
    *   `created_at` (timestampz)
    *   `last_accessed_at` (timestampz)

## 6. Core Features & Flow

1.  **Codelab Discovery:** Users browse available codelabs.
2.  **View Codelab:** Unauthenticated users can read codelab content.
3.  **Start Codelab:**
    *   User clicks "Start" or attempts an action requiring an environment.
    *   If not authenticated, redirected to login/signup (OAuth recommended: Google, GitHub).
    *   If authenticated, an API request is sent to `/api/environments/start` with `codelab_id`.
4.  **Environment Provisioning:**
    *   API checks if the user has a running environment for this codelab.
    *   If not, the Environment Manager triggers the creation of a new Docker container (e.g., using Cloud Run job or API call).
    *   Environment details are stored in the DB.
    *   Connection details/status are returned to the frontend.
5.  **Interactive Session:**
    *   Frontend establishes connection (e.g., WebSocket) to the user's environment for terminal interaction.
    *   Code execution commands are sent from the frontend to the environment via the backend API or directly (if secured appropriately).
6.  **Environment Termination:**
    *   Environments are terminated automatically after a period of inactivity (e.g., 30-60 minutes).
    *   Users might have an option to manually stop their environment.
    *   Scheduled cleanup jobs ensure no orphaned environments.

## 7. User Experience Enhancements (Ideas)

*   **Integrated Terminal:** Use `xterm.js` for a seamless terminal experience within the browser.
*   **Simple File Editor:** Integrate Monaco editor or similar for basic file viewing/editing within the environment.
*   **Progress Tracking:** Indicate completed steps within a codelab.
*   **Environment Persistence (Optional/Advanced):** Explore options for saving environment state (file changes) across sessions, though this adds significant complexity.
*   **Pre-configured Environments:** Define base Docker images tailored to specific languages/stacks (Python, Node, Go, etc.).
*   **Resource Limits & Monitoring:** Implement strict CPU/memory/network limits and timeouts for user environments.
*   **GitHub Integration:**
    *   Import codelabs directly from `codelab.md` files in public GitHub repos.
    *   Allow users to clone specific repos into their environment at the start.
*   **Themes:** Light/Dark mode.

## 8. Deployment Strategy (Cloud Run)

*   **Application Container:** Dockerfile for the Next.js application.
*   **Environment Containers:** Separate Dockerfile(s) for the execution environments.
*   **Provisioning:** Use Cloud Run Jobs or potentially trigger container creation via the Cloud Run Admin API or Docker SDK on a managed VM if more control is needed.
*   **Networking:** Configure VPC Access Connectors if environments need to communicate with internal services or databases securely.
*   **Secrets Management:** Use Google Secret Manager for API keys, database credentials, etc., injected as environment variables.

## 9. Security Considerations

*   **Authentication:** Robust authentication and authorization are paramount.
*   **Environment Isolation:** Strict network and filesystem isolation between user containers.
*   **Resource Limits:** Prevent denial-of-service or resource abuse.
*   **Input Sanitization:** Validate all user input, especially commands sent to environments.
*   **Secrets:** Secure handling of all credentials and API keys.
*   **Rate Limiting:** Protect API endpoints from abuse.

## 10. Next Steps

1.  Set up the initial Next.js project structure.
2.  Integrate Tailwind CSS and Shadcn UI.
3.  Implement Authentication (e.g., using Supabase).
4.  Define database schema and migrations.
5.  Build basic Codelab listing and display pages.
6.  Develop the core Environment Manager logic and API endpoints.
7.  Integrate a basic execution environment (e.g., a simple echo container).
8.  Implement the interactive terminal.
