# TeenFlow Feature-Parity and Security Audit

## Scope and verification

The requested Base44 URL returned HTTP 404 with `App not found` in both the page fetch and browser. No Base44 pages, navigation, dashboards, pricing, AI tools, backend entities, or permissions were inspectable. The feature list below is therefore a checklist of requirements supplied in the project brief, not a verified inventory of Base44 functionality. No feature parity is claimed.

The local Vite project was inspected. It contains the React app, hard-coded demo jobs, one resume Edge Function source file, an unapplied Storage migration, and proposed account/company and marketplace migrations. Lint, tests, and build pass; Supabase REST schema introspection returned HTTP 401 and the test suite covers only local job-filter logic. Read-only probes show email sign-up enabled, email auto-confirm disabled, and no `student-resumes` bucket. Required env names are present; values are not documented. Supabase CLI/Deno, `psql`, and local Supabase config are absent. None of the SQL migrations has been applied; no account, database row, or remote object was changed. See [the foundation proposal and security test plan](supabase-foundation-proposal.md).

| Feature | Current implementation | Verification evidence | Data/security requirement | Status |
|---|---|---|---|---|
| Supabase email sign-up/sign-in/sign-out | Modal and Supabase Auth calls | Modal navigation/close tested; remote Auth settings respond, but no credentials or real account transaction tested | Authenticated user identity; secure server-side authorization | IMPLEMENTED BUT UNTESTED — successful registration, login, and logout unverified |
| Session restore | `getSession` and `onAuthStateChange` | Startup path exists; no real session persistence cycle tested | Supabase session refresh and storage | IMPLEMENTED BUT UNTESTED — requires test account |
| Student/employer selection at sign-up | Writes editable `user_metadata.account_type` | Radio selection and signup UI tested | Trusted roles must not derive from editable metadata | PARTIAL — UI works; metadata is not authorization |
| Separate Student page | `#student` contains student tools | Home exclusion, route navigation, direct route, mobile layout tested | Student data must be owner-scoped | VERIFIED WORKING — frontend route only; records remain demo/local |
| Student profiles/onboarding/settings | No profile editor or onboarding persistence | Not present | `profiles`, preferences, owner-scoped RLS | MISSING |
| Parent/guardian accounts and links | No implementation found; Base44 support unknown | Not testable | Guardian relationships and consent controls | MISSING — original support unknown |
| Adult profiles and role onboarding | No implementation found | Not present | Trusted server-assigned roles and profiles | MISSING |
| Employer/company accounts and profiles | Account-type selector and business route only | Signed-out gate tested; no company data or verification | `companies`, memberships, trusted verification records | PARTIAL — frontend route only; role metadata is untrusted |
| Business dashboard and job form | Dashboard, listing form, applicant panel | Signed-out route tested; form is explicitly a no-op | `companies`, `jobs`, `applications`, RLS and verified membership | PARTIAL — UI only; no post or applicant counts |
| School accounts and dashboards | No implementation found; original support unknown | Not testable | `schools`, memberships, scoped policies | MISSING |
| Public jobs and short-term gigs | Eight hard-coded demo jobs; additive `jobs` table/RLS source drafted in `20261013000300_marketplace_core.sql` | Demo cards/filter tested; proposed live schema is unapplied and frontend does not query it | `jobs`, verified `companies`, public-published policy and age/work eligibility review | PARTIAL — live listings not connected |
| Job search and filters | Client-side search, location, category, schedule, quick filters | Browser verified Remote returns 4 sample roles and category filters work | Server-side eligibility and visibility rules for real data | VERIFIED WORKING — sample dataset only |
| Matching by interests, skills, age, location, availability | No matching service | Not present | Profile preferences and eligible-job rules | MISSING |
| Job details and application instructions | Sample cards and no-op role buttons | Cards render; no detail records or application flow | Published jobs and employer authorization | PARTIAL — preview only |
| Applications and status tracking | Dashboard placeholders; proposed `applications` table, duplicate key, withdrawal/review RPCs in marketplace migration | No submission or persisted status tested; SQL unapplied and frontend unconnected | Student-owned applications; verified company/job-scoped employer review | PARTIAL — schema proposed, flow absent |
| Saved jobs | In-memory React state; proposed owner-scoped `saved_jobs` table | Browser verified current-visit save; database persistence untested and unconnected | Student-only RLS, published-job constraint | PARTIAL — current UI works locally; persistence schema unapplied |
| Resumes and work history | PDF/DOCX upload UI; proposed owner-only resume metadata and private work-history tables | UI tested signed-out; live bucket absent and no work-history UI | Private bucket/object policies; owner-only metadata/history policies | PARTIAL — storage and marketplace migrations unapplied; persistence untested |
| Job alerts and hustle inquiries | No implementation found | Not present | Owner/participant-scoped alert and inquiry records | MISSING |
| Income logging and savings goals | Static dashboard placeholders | No financial writes or data | Private owner-scoped income and goals records | MISSING |
| Company profiles and listing management | Business form and listing placeholders | Form submit is verified no-op with honest feedback | Company membership, `jobs`, verified employer policy | PARTIAL — UI only |
| Employer application review and candidate communication | Applicant empty state only | No candidate access/data tested | Authorized `applications`, participant-scoped messaging | MISSING |
| Employer verification and trust status | No workflow | Not present | Trusted verification action and audit trail | MISSING |
| Employer subscription features | No plans, pricing, or billing code | Not present | Provider subscriptions and verified webhooks | MISSING — Base44 pricing unknown |
| School/community reporting | Home metrics call is disabled; no data source/function | Dashes/unavailable state verified | Privacy-safe aggregate-only server query with cohort protections | PARTIAL — UI only; no analytics backend |
| Messaging and conversations | No implementation found | Not present | Participant RLS and server authorization | MISSING |
| Reviews, Sensor Loop, trust workflows | No implementation found; original workflow unknown | Not present | Verified interactions, moderation, audit records | MISSING |
| Secure documents and location restrictions | Resume upload client and unapplied private-bucket SQL; no geofencing | Upload not tested against a real bucket/account | Private Storage and owner policies; server-side geofence if required | PARTIAL — storage setup unverified; location controls missing |
| Administrator dashboard and moderation | No implementation found | Not present | Trusted admin roles, privileged server actions, immutable audit trail | MISSING |
| Payments, pricing, and subscriptions | No provider integration found | No payment flow | Hosted/tokenized checkout and signature-verified webhook; never store card data | MISSING — original pricing/payment method unknown |
| AI resume drafting and community insights | Resume UI and local function source; community UI only | AI flag off; no AI output or analytics result tested | Server-only AI secret, trusted student authorization, rate limits, approved aggregate source | PARTIAL — resume function undeployed; community backend/schema missing |

## Phase 1 local behavior

- Home contains product-introduction content and account entry points. Student jobs, dashboard, hustles, and student journey are on `#student`; its direct links and browser navigation were tested. The local job search filters demo listings only.
- The auth dialog switches between sign-in and create-account modes; the close control returns to the underlying page. Both controls and the empty signed-out UI were browser-tested without console errors.
- Mobile navigation now includes sign-in and create-account entries; at 390px the sign-in entry opens the correct modal and close returns to Home.
- Registration calls Supabase Auth with email, password, and the selected `account_type` in user metadata. Login, logout, email-confirmation messaging/resend, and session restoration are wired to the existing Supabase client.
- Password creation has a client-side minimum of eight characters. Supabase remains the authority for configured password rules.
- Actual registration, login, email delivery, logout with a live session, and persisted-session behavior have not been tested with a real test account. Do not interpret a passing build or working modal as proof the remote Auth configuration is correct.
- The modal no longer explains authorization internals. The employer selector remains descriptive only; no employer verification or posting permission is inferred.
- A separate `#business` workspace is shown for a signed-in session whose account metadata says `employer`; employer sign-in/session routing is wired. The signed-out gate and employer sign-up preselection were browser-tested. A real employer session was not available for an end-to-end redirect test.
- The business job form is presentation only. Submitting it explicitly reports that nothing was saved or published. Listing totals and applicant counts show unavailable values because no schema or data source is connected.

## AI and community insights

Resume AI and community insights call Supabase Functions only when their local Vite flags are set to `true`. Resume upload UI is enabled for signed-in student sessions by default; set `VITE_RESUME_UPLOADS_ENABLED=false` to hide it. These flags are not credentials:

- `VITE_RESUME_AI_ENABLED=true` enables calls to the local `supabase/functions/resume-assistant/index.ts` source after it is deployed. It requires a valid Supabase session and `app_metadata.account_type=student`, and expects a JSON response with a non-empty `resume_text` string. Input is limited to a target role, skills, experience/projects, and optional education; the UI requires student opt-in before sending text to the configured AI provider. Never add contact details, birth dates, or home addresses. Set `OPENAI_API_KEY` as an Edge Function secret, never a `VITE_*` value. The function uses `OPENAI_MODEL` or defaults to `gpt-4o-mini`, and requires an `ALLOWED_ORIGINS` allowlist. Add durable per-user rate limiting before enabling it.
- Resume upload is enabled by default for signed-in student sessions; set `VITE_RESUME_UPLOADS_ENABLED=false` to disable the UI. The local migration `supabase/migrations/20261013000100_private_student_resumes.sql` creates the private bucket and owner-folder-scoped select/insert/delete policies; each authenticated user can access only objects under their own `auth.uid()` folder. It creates no application tables and has not been applied. Inspect the live bucket and existing `storage.objects` policies before applying it; do not apply it over an existing bucket/policy setup without review. The frontend limits the feature to student accounts; if server-enforced student-only uploads are required, add trusted role provisioning without sacrificing owner-only isolation.
- `VITE_COMMUNITY_INSIGHTS_ENABLED=true` enables calls to `community-insights`. It expects `{ metrics: { student_count, business_count, total_earnings_usd }, summary }`, with non-negative integer counts, non-negative numeric earnings, and a short AI-generated summary. The server must use approved aggregate sources, expose no identifiable user records, and validate access/data policy. No source schema for these totals exists in the repository, so do not enable this flag yet.

The current sign-up flow writes the user-editable `user_metadata.account_type`, which the frontend uses to show student controls. Storage policies do not trust that value: they restrict every authenticated user to their own `auth.uid()` folder, so one user cannot read or overwrite another user's resume. The resume AI function separately requires trusted `app_metadata.account_type=student`, which current sign-up does not provision; AI remains disabled. No community metrics function can be implemented against the current repo because no approved schema for users, businesses, or verified earnings exists.

The resume Edge Function source is not deployed and was not Deno-checked because Deno and Supabase CLI configuration are unavailable in this workspace. The private-bucket migration is unapplied and the live project currently lists no `student-resumes` bucket, so an upload will fail safely until it is provisioned. AI and insights flags are off, so those functions are not called. These UI controls are not evidence of live AI, Storage, or analytics. No browser-visible provider/service-role secret is used. Community metrics still require an approved schema/data source, a privacy-safe aggregate function, and end-to-end tests.

## Security boundaries and proposed data model

No migrations have been applied. A private resume-bucket migration is present locally, but the dashboard is unauthenticated and the project has no Supabase CLI configuration, so it could not be applied here. Before applying it or doing further schema work, review existing Storage policies, buckets, and functions. The following table architecture is an outline, not a claim about the existing database:

- Keep Supabase Auth identity in `auth.users`; place editable profile fields in `profiles`. Do not use `user_metadata` to decide authorization. A user can modify it.
- The `#business` route currently uses `user_metadata.account_type` only as a UI routing hint. It exposes no protected records and must not be used as backend authorization. Job publishing and applicant reads need trusted identity, verified company membership, and RLS/Edge Function enforcement before they are enabled.
- Add a trusted role assignment relation such as `user_roles`, writable only by a protected administrative function. Employer verification must be represented separately and changed only through a trusted verification workflow.
- Use `companies`, `company_members`, `schools`, and `school_memberships` for organization membership. Apply RLS to membership-scoped reads and writes.
- Use `jobs`, `applications`, `saved_jobs`, `work_history`, `job_alerts`, `hustle_inquiries`, `income_entries`, and `savings_goals` with owner- and participant-scoped policies. Employers may read candidate/application data only for jobs their authorized company controls.
- Use `resumes` metadata with a private Storage bucket. Authorize object paths and downloads using the authenticated owner or a narrowly authorized application relationship; do not expose public resume URLs.
- Use `conversations`, `conversation_participants`, `messages`, `reviews`, and `reports` with participant-scoped RLS and moderation workflows. Important verification/moderation actions should write an append-only audit record.
- Use privacy-filtered server-side aggregates for school/community reporting. Never expose identifiable student records through public analytics.
- Keep billing state in server-verified subscription/webhook records. Use a payment provider's hosted/tokenized checkout; never store card data or accept client claims that payment succeeded.
- Call any AI provider from trusted server-side/Edge Function code. Keep provider keys out of Vite `VITE_*` variables and the browser bundle.
- For minors, determine jurisdictions, consent, age eligibility, retention, and safeguarding requirements before deciding what personal data to collect. Prefer the least sensitive age-eligibility representation that can be lawfully and reliably enforced.

## Security issues before production users

- Supabase currently permits public email sign-up and does not auto-confirm email. Decide whether self-service registration is intended, configure email delivery/redirects, and test the confirmation flow before inviting users.
- The signup role is stored in editable `user_metadata`. It cannot authorize access, employer verification, administration, or real job posting. Add trusted role/company provisioning and RLS before storing protected app data.
- The REST schema endpoint returned HTTP 401 and no schema/migration export is available, so application-table RLS cannot be audited. Do not store profiles, applications, messages, earnings, or candidate data until policies are created and tested with separate user roles.
- The private resume bucket is absent and its migration is unapplied. The current migration scopes access by `auth.uid()` folder, but existing Storage policies must be reviewed before applying it. The frontend's student check alone is not a security boundary.
- The resume AI function is undeployed, has no durable rate limit, and requires trusted `app_metadata.account_type=student`, which signup does not provision. Keep its flag off until provisioning, rate limits, origin allowlist, provider retention/consent review, and deployment are complete.
- There are no guardian-consent or age/work-eligibility controls for the teen audience. Resolve jurisdiction-specific requirements and collect only necessary data before real minors register.
- No community metrics source exists; do not display student/business counts or earnings as facts until backed by audited aggregate queries that prevent identification.

## Information needed to complete parity discovery

1. A working public Base44 URL or confirmation that the deployment should be restored. The supplied URL currently returns `App not found`.
2. Read-only screenshots or a screen recording of each accessible route and role (signed out, student, parent/guardian if supported, adult, employer, school, administrator), including mobile layouts and key workflows.
3. Base44 project export/source and entity/data-model export, including access rules, automations, storage configuration, and any existing migrations. Redact credentials and personal data.
4. The exact existing subscription plans/prices, payment provider, checkout and webhook behavior, if any. Do not send secret keys.
5. The AI features users can access, expected inputs/outputs, provider/model, and configuration requirements. Do not send API keys.
6. Jurisdictions served and the approved age/guardian-consent and job-eligibility rules for users aged 16–19.

Until those materials and schema access are available, Base44-specific features, pricing, AI behavior, and data models remain unverified. No Base44 files or database objects have been changed.
