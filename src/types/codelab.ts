export interface Codelab {
  id: string; // uuid is represented as string in JS/TS
  slug: string;
  title: string;
  description?: string | null;
  content_markdown?: string | null;
  github_repo_url?: string | null;
  author_id?: string | null;
  created_at: string; // timestampz is represented as string
  updated_at: string;
}
