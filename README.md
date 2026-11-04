# TeenFlow

TeenFlow is a youth opportunity platform for teens to discover jobs, gigs, and early-career experiences.

## Local setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Update the Supabase values in `.env.local` with your project credentials.
3. Start the app:
   ```bash
   npm install
   npm run dev -- --host 0.0.0.0
   ```

The app includes a safe demo fallback if Supabase credentials are missing, so the site can still load for local preview and basic testing.

## Production checks

```bash
npm run build
npm run lint
```
