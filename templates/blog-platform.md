# PRD: Blog Platform with CMS

## Overview
A blog platform called "Inkwell" with a markdown-based content management system, category organization, RSS feed, and a reading-friendly frontend. Authors write in markdown with a live preview editor; readers get a fast, clean experience.

## Target Users
- Independent bloggers who prefer writing in markdown
- Technical writers publishing tutorials and guides
- Small teams running a company blog

## Features

### MVP Features
1. **Markdown Editor** - Admin CMS with live preview, frontmatter support, image uploads
2. **Blog Frontend** - Clean reading experience with typography-focused design
3. **Categories and Tags** - Organize posts by category and tag, filter/browse by each
4. **RSS Feed** - Auto-generated RSS/Atom feed for subscribers
5. **Search** - Full-text search across all published posts
6. **SEO** - Open Graph tags, meta descriptions, sitemap.xml, canonical URLs
7. **Admin Dashboard** - Post management, draft/publish workflow, basic analytics (view counts)
8. **Author Profiles** - Multi-author support with bio and avatar

### User Flow (Author)
1. Author logs into admin at /admin
2. Clicks "New Post" -> markdown editor opens with live preview
3. Writes post in markdown, adds frontmatter (title, category, tags, excerpt)
4. Uploads images via drag-and-drop -> inserted as markdown image syntax
5. Saves as draft -> previews on site -> publishes
6. Views dashboard: post list, view counts, draft vs published status

### User Flow (Reader)
1. Visits blog homepage -> sees latest posts with excerpts
2. Clicks a post -> full article with table of contents
3. Browses by category or tag -> filtered post list
4. Uses search to find posts by keyword
5. Subscribes via RSS feed reader

## Tech Stack

### Frontend / SSG
- Framework: Next.js 14 (App Router) with static generation
- Styling: TailwindCSS + @tailwindcss/typography for prose
- Markdown: unified/remark/rehype pipeline (remark-gfm, rehype-highlight, rehype-slug)
- Search: Fuse.js (client-side fuzzy search) or Pagefind (static search index)

### Admin CMS
- Editor: CodeMirror 6 with markdown mode + live preview pane
- Auth: Simple email/password with iron-session (no OAuth needed for admin)
- Image upload: Local filesystem with /public/uploads/ path

### Backend
- Next.js API Routes
- Database: SQLite via better-sqlite3
- RSS: hand-built XML generation from post data

### Structure
```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Homepage - latest posts
│   │   ├── posts/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Individual post page
│   │   ├── category/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Posts by category
│   │   ├── tag/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Posts by tag
│   │   ├── authors/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Author profile + posts
│   │   ├── search/
│   │   │   └── page.tsx               # Search results page
│   │   ├── feed.xml/
│   │   │   └── route.ts               # RSS feed endpoint
│   │   ├── sitemap.xml/
│   │   │   └── route.ts               # Sitemap generation
│   │   ├── admin/
│   │   │   ├── page.tsx               # Admin dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # Admin login
│   │   │   ├── posts/
│   │   │   │   ├── page.tsx           # Post list management
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx       # New post editor
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx   # Edit post
│   │   │   ├── categories/
│   │   │   │   └── page.tsx           # Category management
│   │   │   └── authors/
│   │   │       └── page.tsx           # Author management
│   │   ├── api/
│   │   │   ├── posts/
│   │   │   │   └── route.ts           # CRUD for posts
│   │   │   ├── upload/
│   │   │   │   └── route.ts           # Image upload
│   │   │   ├── categories/
│   │   │   │   └── route.ts           # CRUD for categories
│   │   │   └── auth/
│   │   │       └── route.ts           # Login/logout
│   │   └── layout.tsx
│   ├── components/
│   │   ├── PostCard.tsx               # Post preview card
│   │   ├── PostContent.tsx            # Rendered markdown content
│   │   ├── TableOfContents.tsx        # Auto-generated from headings
│   │   ├── CategoryList.tsx           # Category sidebar/nav
│   │   ├── TagCloud.tsx               # Tag display
│   │   ├── SearchBar.tsx              # Search input
│   │   ├── Pagination.tsx             # Post list pagination
│   │   ├── AuthorCard.tsx             # Author bio card
│   │   └── admin/
│   │       ├── MarkdownEditor.tsx     # CodeMirror editor
│   │       ├── LivePreview.tsx        # Real-time preview
│   │       ├── ImageUploader.tsx      # Drag-and-drop upload
│   │       └── PostTable.tsx          # Admin post list table
│   └── lib/
│       ├── markdown.ts                # Markdown processing pipeline
│       ├── db.ts                      # Database connection
│       ├── auth.ts                    # Session management
│       ├── rss.ts                     # RSS XML generation
│       └── seo.ts                     # Meta tag generation helpers
├── public/
│   └── uploads/                       # Uploaded images
├── tests/
│   ├── markdown.test.ts
│   ├── rss.test.ts
│   ├── api/
│   │   ├── posts.test.ts
│   │   └── auth.test.ts
│   └── components/
│       └── PostCard.test.tsx
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema

```sql
CREATE TABLE authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,              -- Raw markdown
  excerpt TEXT,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  category_id INTEGER REFERENCES categories(id),
  status TEXT DEFAULT 'draft',        -- draft, published
  featured_image TEXT,
  meta_description TEXT,
  view_count INTEGER DEFAULT 0,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published ON posts(published_at);
CREATE INDEX idx_posts_slug ON posts(slug);
```

## API Endpoints

### Posts
- `GET /api/posts` - List posts (query: `?status=`, `?category=`, `?tag=`, `?search=`, `?page=`)
- `GET /api/posts/:id` - Get single post
- `POST /api/posts` - Create post (admin only)
- `PUT /api/posts/:id` - Update post (admin only)
- `DELETE /api/posts/:id` - Delete post (admin only)
- `POST /api/posts/:id/publish` - Publish a draft (admin only)

### Categories
- `GET /api/categories` - List all categories with post counts
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Upload
- `POST /api/upload` - Upload image, returns URL (admin only)

### Auth
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/me` - Get current session

### Feeds
- `GET /feed.xml` - RSS 2.0 feed (latest 20 published posts)
- `GET /sitemap.xml` - XML sitemap for all published posts

## Requirements
- TypeScript throughout
- Static generation for published posts (ISR with revalidation)
- Markdown supports: GFM tables, code blocks with syntax highlighting, footnotes, task lists
- Image upload: max 5MB, accepts jpg/png/gif/webp, stored in public/uploads/
- Auto-generated slug from title (with collision handling)
- Table of contents auto-generated from h2/h3 headings
- Reading time estimate displayed on each post
- Pagination: 10 posts per page
- RSS feed validates against W3C Feed Validation Service
- Sitemap follows sitemaps.org protocol
- Admin routes protected by session middleware
- Responsive design (mobile reading experience is a priority)

## Testing
- Unit tests: Markdown processing, slug generation, RSS XML output, reading time calculation (Vitest)
- API tests: Post CRUD, auth flow, image upload (Vitest + supertest)
- Component tests: PostCard rendering, search functionality
- Manual testing: Write a complete blog post, verify rendering, check RSS in a feed reader

## Out of Scope
- Comments system
- Newsletter / email subscriptions
- Social sharing buttons
- Analytics beyond view counts
- Multi-language / i18n support
- Content versioning / revision history
- WYSIWYG editor (markdown only)
- Cloud image hosting (CDN)
- Deployment

## Success Criteria
- Author can create, edit, preview, and publish posts via admin CMS
- Markdown renders correctly with syntax highlighting and GFM extensions
- Categories and tags filter posts correctly
- Search returns relevant results
- RSS feed is valid XML with correct post content
- Sitemap includes all published posts
- SEO meta tags render correctly (check with Open Graph debugger)
- View count increments on post visit
- Admin auth works (login, session persistence, logout)
- All tests pass

---

**Purpose:** Tests Loki Mode's ability to build a content-heavy application with markdown processing, admin CMS, SEO optimization, and feed generation. Expect ~45-60 minutes for full execution.
