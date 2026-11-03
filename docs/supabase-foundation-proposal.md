# Supabase Foundation Proposal

**Status: proposal only.** The migration below has not been applied. No remote schema, policy, bucket, or data was changed. Before applying it, inspect the target project's schema and policies in the Supabase dashboard; local REST schema introspection returned HTTP 401. Supabase CLI, Deno, `psql`, and `pg_format` are unavailable, so the SQL has been reviewed but not parsed/executed by a PostgreSQL engine.

## Proposed migration

File: `supabase/migrations/20261013000200_secure_account_company_foundation.sql`

This is additive and creates:

- `profiles`: one minimal profile row per `auth.users` identity; only `display_name` is owner-editable. A trigger creates new rows and the migration backfills existing Auth identities without copying metadata or collecting birth date, address, or contact details.
- `user_roles`: trusted `student`, `employer`, and `admin` assignments. New sign-ups receive **no role**. Signup `user_metadata.account_type` is deliberately ignored. Clients may read their own role rows but have no direct insert/update/delete privileges. Assignment and revocation go through `admin_set_user_role`, which checks the caller's existing admin role, prevents self-admin changes and removal of the last admin, and records an audit event.
- `companies`: public company fields, creator identity, and `pending`/`verified`/`rejected` employer-verification status. Only users with the trusted `employer` role may create a company; new companies start pending. Company owners can edit public details, but changing details on a verified company returns it to pending. Verification fields have no client update grant and are guarded by a trigger; an admin cannot review a company they created or own.
- `company_members`: company membership and `owner`/`recruiter`/`viewer` membership labels. Company creation adds its owner through a security-definer trigger. Clients can read only their own membership row; they cannot add members or change membership roles in this foundation.
- `admin_audit_log`: administrator role and employer-verification actions. Clients cannot write or modify audit entries; administrators can read them. Privileged RPCs write the log. Target UUIDs are retained without foreign keys so deleting an Auth user is not blocked; define retention/anonymization before production.

The migration enables RLS on all five tables. Policies provide owner/admin profile access; self/admin role reads; public reads of verified companies; member/admin reads of unverified companies; trusted-employer company creation; owner-only company detail edits; self/admin membership reads; and admin-only audit reads. Anon and ordinary company members receive only company ID, public name/site/description, verification status, and timestamps; creator/verifier UUIDs are not selectable. No delete policies are granted. Column grants further restrict profile/company updates. Helper functions inspect only the current caller's roles/membership, are not executable by `anon`, and use a fixed empty `search_path`.

Indexes cover role lookups, company creators/status, member user lookups, and audit time/actor. Foreign keys and checks constrain identifiers, roles, verification state, membership roles, bounded profile/company fields, and audit reasons. Timestamps are set by the database.

## Bootstrap and assumptions

- This project currently has no profile, role, company, school, job, or application tables. The migration does not assume any exist.
- No School page/dashboard exists in the current frontend, so a `schools` table is intentionally deferred until product requirements confirm it is needed.
- There is no `jobs` or `applications` table. The business form is a UI placeholder and sample jobs are hard-coded; those tables belong in a later, separately reviewed migration.
- Existing Auth users are backfilled with empty profile rows, but receive no trusted role. Review and assign roles through an approved operator workflow; do not infer them from `user_metadata`.
- The first administrator cannot be created by an unauthenticated client. After reviewing the target Auth users, a project owner must bootstrap one administrator in the Supabase SQL editor under their trusted database-owner session and record the bootstrap action. Never hard-code a user UUID or seed admin access automatically in this migration.
- Example one-time bootstrap, only after the migration is reviewed/applied and the intended test/admin Auth UUID is independently verified. Replace the placeholder privately; never commit a real UUID or execute this from frontend code:

	```sql
	begin;
	insert into public.user_roles (user_id, role, granted_by_user_id)
	values ('<reviewed-auth-user-uuid>', 'admin', null);
	insert into public.admin_audit_log
		(actor_user_id, action, target_entity, target_id, reason_code, details)
	values
		(null, 'user_role_granted', 'user', '<reviewed-auth-user-uuid>',
		 'admin_appointment', '{"bootstrap":true}');
	commit;
	```
- Employers require a trusted admin role grant before company creation. Company verification is a separate admin RPC action. This prevents signup choice or user-editable metadata from granting either capability.
- `company_members` is single-owner on creation; invitations/team membership need a later audited admin/owner RPC with its own RLS tests.
- `admin_set_user_role` and `admin_set_employer_verification` are security-definer RPCs that authorize the current JWT caller using `user_roles`. They are not usable until a trusted admin exists. They do not set Auth `app_metadata`; `user_roles` is the database authorization source of truth.
- Audit reasons are fixed codes, not free-form text, to avoid putting unnecessary personal information into the audit log.

## Security test plan

Run only against an isolated local or staging Supabase project with fake identities and data, after reviewing and applying the migration there. Create separate anon, student A, student B, employer A, employer B, and admin sessions. Do not run these write tests against production.

| Actor | Attempt | Expected result |
|---|---|---|
| Unauthenticated/anon | Select from `profiles`, `user_roles`, `company_members`, and `admin_audit_log` | Denied or zero rows; anon may select only companies whose status is `verified` |
| Anon/ordinary company member | Select `created_by_user_id` or `verified_by_user_id` from `companies` | Column privilege denied; those UUIDs are not in public/member projections |
| New fake Auth signup | Create Auth identity with `user_metadata.account_type=student` or `employer` | Profile trigger creates an empty profile; no trusted role is added from metadata |
| Student A | Select and update own profile `display_name` | Own row only; update succeeds and `updated_at` advances |
| Student B | Select/update Student A's profile | Select returns no row; update affects no row or is denied |
| Student A | Insert/update/delete own `user_roles`, or call admin role RPC | Table mutation denied; RPC returns insufficient privilege |
| Student A | Change `user_metadata.account_type` to employer/admin | Does not add a `user_roles` row or grant company/admin access |
| Employer A without trusted employer role | Insert a company or call company actions | Denied even if user metadata says employer |
| Authorized Employer A | Insert a company with own `created_by_user_id` and default pending status | Succeeds; owner membership is created; verification remains pending |
| Employer A | Insert company as verified, update verification fields, or insert a company member directly | Denied |
| Employer A / Employer B | Read or update another company's unverified company record or membership | No row visible/no update; their own company membership remains visible |
| Employer A | Change details on a verified company | Allowed only for editable columns; trigger resets verification to pending and clears verifier fields |
| Non-admin employer/student | Call `admin_set_employer_verification` or grant/revoke roles | RPC returns insufficient privilege; audit log unchanged |
| Admin | Grant/revoke a role for another user | Allowed only for valid role/reason; exactly one audit event is recorded |
| Admin | Promote self to admin or revoke the last admin role | Denied |
| Admin | Verify/reject a company through the RPC | Allowed for valid status/reason; verifier/time are set consistently; audit event recorded |
| Admin who created or owns a company | Verify/reject that company through the RPC | Denied; a different authorized admin must review it |
| Anon/student | Read draft or closed jobs, or jobs under pending/rejected companies | No rows; only published jobs for verified companies are public |
| Employer A/B | Read an application belonging to a job owned by the other employer | No row visible; application RLS scopes employer reads to a verified, managed company |
| Student A/B | Read another student's application, saved job, resume metadata, or work history | No row visible; student-owned records are isolated by `auth.uid()` and trusted student role |
| Student A | Apply twice to the same published job or apply to a draft/closed job | Duplicate rejected by unique constraint; non-published job denied by RLS |
| Employer without verified membership | Publish a job or change an application status | RPC returns insufficient privilege; job stays draft/application unchanged |
| Verified company owner/recruiter | Publish a draft, close a published job, review its own applicant | Allowed through RPC; published-job edits return to draft; cannot access another company's application |
| Student A | Save a draft job or remove Student B's saved job | Insert denied unless job is published; delete affects only own saved row |

The marketplace tests cover objects added by `20261013000300_marketplace_core.sql`; they require `20261013000200_secure_account_company_foundation.sql` first. Resume object access also requires the separate private-storage migration. For automated SQL tests, use pgTAP or equivalent on an isolated Supabase test database to assert policies/RPC results and audit records. The repository has a Node test runner for frontend filtering, but no pgTAP runner, local Supabase config, or deployed database, so database tests in this section are a plan and are not claimed as run.

## Frontend changes required after approval

- Replace routing/authorization decisions based on `user_metadata.account_type` with `user_roles` reads after the session is established. Keep user metadata only as a non-authoritative signup preference.
- Show a clear pending-access state for accounts with no trusted role. Employer signup must become a request/review flow; a selected “Employer” radio does not grant employer access.
- Load/update the signed-in user's own profile from `profiles`; do not add client role editing.
- Gate company creation/editing on the trusted employer role and show verification status read from `companies`. Wire the Student job search, applications, and Business dashboard to the proposed `jobs`, `saved_jobs`, and `applications` tables only after the migration is reviewed and applied.
- Update the resume Edge Function to query `user_roles` under the user's JWT instead of checking `app_metadata.account_type`; then add durable rate limiting before enabling AI.
- Keep school screens/tables, student application flows, and analytics for later phases; none are represented by this foundation migration.
