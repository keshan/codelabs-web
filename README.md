This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

# Codelabs Web Platform

A secure, modern, and interactive Codelab Environment built with Next.js, Tailwind CSS, Supabase, and Shadcn UI. Authenticated users can browse, read, and (soon) run code samples in isolated sandboxes, following hands-on tutorials inspired by Google Codelabs.

---

## Features

- **Authentication:** Secure login (email/password only, sign-up disabled) via Supabase Auth.
- **Codelab Listing:** Browse available codelabs/tutorials on the home page.
- **Codelab Detail:** View rich markdown tutorials with syntax-highlighted code blocks (Python, JavaScript, etc.).
- **Modern UI:** Responsive design, dark mode, and accessible components using Tailwind CSS and Shadcn UI.
- **Secure Backend:** All secrets managed via `.env.local`. Row Level Security enabled for Supabase tables.
- **Extensible:** Ready for future features like interactive code execution and sandboxed environments.

---

## Tech Stack

- [Next.js 15 (App Router, RSC)](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/) with [@tailwindcss/typography](https://tailwindcss.com/docs/typography-plugin)
- [Supabase](https://supabase.com/) (Auth, Database, RLS)
- [Shadcn UI](https://ui.shadcn.com/) & [Radix UI](https://www.radix-ui.com/)
- [react-markdown](https://github.com/remarkjs/react-markdown) + [prism-react-renderer](https://github.com/FormidableLabs/prism-react-renderer) for markdown/code
- [TypeScript](https://www.typescriptlang.org/)

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/keshan/codelabs-web.git
cd codelabs-web
npm install
```

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Run Locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Database Setup

- Use the provided SQL in `docs/design.md` to create the `codelabs` table.
- Enable Row Level Security (RLS) and add a policy to allow public `SELECT` for codelabs.
- Add sample codelabs via the Supabase dashboard or SQL.

---

## Project Structure

```
src/
  app/              # Next.js app directory (routing, pages)
  components/       # UI and markdown components (Shadcn, custom)
  lib/              # Supabase client, utilities, data fetching
  types/            # TypeScript types
  styles/           # Tailwind and global CSS
```

---

## Security

- All environment variables are loaded from `.env.local` (never commit secrets).
- Supabase RLS restricts data access (see `docs/design.md` for policy guidance).
- Only sign-in is enabled; sign-up is disabled for security.

---

## Roadmap

- [ ] Interactive code execution (Python sandbox)
- [ ] User progress tracking
- [ ] Codelab authoring UI
- [ ] Deployment (Cloud Run, Vercel, etc.)

---

## License

MIT

---

## Credits

- Inspired by [Google Codelabs](https://codelabs.developers.google.com/).
- Built with [Next.js](https://nextjs.org/), [Supabase](https://supabase.com/), [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/).

---

