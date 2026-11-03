import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Building2, BriefcaseBusiness, ClipboardList, LoaderCircle, Plus, RefreshCw, Users } from "lucide-react";
import { supabase } from "./supabase.js";

const requestTimeout = () => AbortSignal.timeout(8000);

function BusinessDashboard({ user, onReturnHome, onRequestBusinessAccount }) {
  const [company, setCompany] = useState(null);
  const [membershipRole, setMembershipRole] = useState(null);
  const [listings, setListings] = useState([]);
  const [applicantCounts, setApplicantCounts] = useState(null);
  const [dashboardStatus, setDashboardStatus] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const jobFormRef = useRef(null);

  const loadBusinessData = useEffectEvent(async (isCurrent = () => true) => {
    await Promise.resolve();
    if (!user?.id) return;
    if (isCurrent()) setDashboardStatus("loading");

    try {
      const { data: member, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id, membership_role, company:companies(id, name, employer_verification_status)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
        .abortSignal(requestTimeout());
      if (membershipError) throw membershipError;
      if (!member) {
          if (isCurrent()) {
            setCompany(null);
            setMembershipRole(null);
            setListings([]);
            setApplicantCounts(null);
            setDashboardStatus("no-company");
          }
        return;
      }

      const companyRecord = Array.isArray(member.company) ? member.company[0] : member.company;
      if (!companyRecord) throw new Error("Company details unavailable.");
        if (isCurrent()) {
          setCompany(companyRecord);
          setMembershipRole(member.membership_role);
        }

      const { data: jobs, error: jobsError } = await supabase
        .from("jobs")
        .select("id, title, category, location, status, published_at, closed_at, created_at, updated_at")
        .eq("company_id", member.company_id)
        .order("created_at", { ascending: false })
        .limit(100)
        .abortSignal(requestTimeout());
      if (jobsError) throw jobsError;

      let counts = {};
      if (companyRecord.employer_verification_status === "verified" && jobs?.length) {
        const { data: applications, error: applicationsError } = await supabase
          .from("applications")
          .select("job_id, status")
          .in("job_id", jobs.map((job) => job.id))
          .abortSignal(requestTimeout());
        if (applicationsError) throw applicationsError;
        counts = (applications ?? []).reduce((result, application) => {
          result[application.job_id] ??= { total: 0, needsReview: 0 };
          result[application.job_id].total += 1;
          if (["submitted", "reviewing"].includes(application.status)) result[application.job_id].needsReview += 1;
          return result;
        }, {});
      }

      if (isCurrent()) {
        setListings(jobs ?? []);
        setApplicantCounts(counts);
        setDashboardStatus("ready");
      }
    } catch {
      if (isCurrent()) setDashboardStatus("unavailable");
    }
  });

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadBusinessData(() => active);
    });
    return () => {
      active = false;
    };
  }, [user?.id, refreshSequence]);

  async function handleCreateCompany(event) {
    event.preventDefault();
    if (!user?.id) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("company-name") ?? "").trim();
    const website = String(formData.get("company-website") ?? "").trim();
    const description = String(formData.get("company-description") ?? "").trim();

    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.from("companies").insert({
        created_by_user_id: user.id,
        name,
        website: website || null,
        description: description || null,
      }).select("id, name, employer_verification_status").single();
      if (error) throw error;
      setCompany(data);
      setMembershipRole("owner");
      setListings([]);
      setApplicantCounts({});
      setDashboardStatus("ready");
      setMessage({ type: "success", text: "Company created with pending verification. It cannot publish jobs until an administrator verifies it." });
      form.reset();
    } catch {
      setMessage({ type: "error", text: "Company was not created. Your account needs trusted employer access and the foundation migration must be active." });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft(event) {
    event.preventDefault();
    if (!company || !["owner", "recruiter"].includes(membershipRole)) {
      setMessage({ type: "error", text: "A company owner or recruiter membership is required to manage jobs." });
      return;
    }
    if (company.employer_verification_status !== "verified") {
      setMessage({ type: "error", text: "This company must be verified before creating or publishing jobs." });
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const minimumPay = String(data.get("compensation-min") ?? "").trim();
    const maximumPay = String(data.get("compensation-max") ?? "").trim();
    const minimumAge = String(data.get("minimum-age") ?? "").trim();
    const maximumAge = String(data.get("maximum-age") ?? "").trim();
    const location = String(data.get("location") ?? "").trim();
    const values = {
      title: String(data.get("job-title") ?? "").trim(),
      category: String(data.get("category") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      requirements: String(data.get("requirements") ?? "").trim() || null,
      location,
      is_remote: location.toLowerCase() === "remote",
      schedule: String(data.get("schedule") ?? ""),
      employment_type: String(data.get("employment-type") ?? ""),
      compensation_min: minimumPay ? Number(minimumPay) : null,
      compensation_max: maximumPay ? Number(maximumPay) : null,
      compensation_type: minimumPay && maximumPay ? "range" : minimumPay || maximumPay ? String(data.get("compensation-type") ?? "hourly") : "unspecified",
      minimum_age: minimumAge ? Number(minimumAge) : null,
      maximum_age: maximumAge ? Number(maximumAge) : null,
      application_instructions: String(data.get("application-instructions") ?? "").trim() || null,
    };

    setBusy(true);
    setMessage(null);
    try {
      let job;
      if (editingJob) {
        const { data: updatedJob, error } = await supabase.from("jobs").update(values)
          .eq("id", editingJob.id).eq("company_id", company.id)
          .select("id, title, category, location, status, published_at, closed_at, created_at, updated_at").single();
        if (error) throw error;
        job = updatedJob;
        setListings((current) => current.map((item) => item.id === job.id ? job : item));
      } else {
        const { data: insertedJob, error } = await supabase.from("jobs").insert({
          ...values,
          company_id: company.id,
          created_by_user_id: user.id,
          status: "draft",
        }).select("id, title, category, location, status, published_at, closed_at, created_at, updated_at").single();
        if (error) throw error;
        job = insertedJob;
        setListings((current) => [job, ...current]);
        setApplicantCounts((current) => ({ ...(current ?? {}), [job.id]: { total: 0, needsReview: 0 } }));
      }
      setEditingJob(null);
      form.reset();
      setMessage({ type: "success", text: "Draft saved. It is not public until you publish it." });
    } catch {
      setMessage({ type: "error", text: "Job draft was not saved. Check employer membership and database setup." });
    } finally {
      setBusy(false);
    }
  }

  async function changeJobStatus(job, status) {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("employer_set_job_status", { p_job_id: job.id, p_status: status });
      if (error) throw error;
      const now = new Date().toISOString();
      const updatedJob = {
        ...job,
        status,
        published_at: status === "published" ? now : null,
        closed_at: status === "closed" ? now : null,
        updated_at: now,
      };
      setListings((current) => current.map((item) => item.id === job.id ? updatedJob : item));
      setMessage({ type: "success", text: status === "published" ? "Job published." : status === "closed" ? "Job closed." : "Job returned to draft." });
    } catch {
      setMessage({ type: "error", text: "Job status was not changed. Confirm company verification and authorized membership." });
    } finally {
      setBusy(false);
    }
  }

  const activeJobs = listings.filter((job) => job.status === "published").length;
  const totalApplicants = applicantCounts && Object.values(applicantCounts).reduce((total, counts) => total + counts.total, 0);
  const needsReview = applicantCounts && Object.values(applicantCounts).reduce((total, counts) => total + counts.needsReview, 0);

  return (
    <section className="business-dashboard" aria-labelledby="business-dashboard-title">
      <div className="business-dashboard-inner">
        <header className="business-dashboard-header">
          <div>
            <button className="business-back-link" type="button" onClick={onReturnHome}>← TeenFlow home</button>
            <div className="eyebrow">BUSINESS WORKSPACE</div>
            <p>{company?.name ? `Manage listings for ${company.name}.` : "Create your company profile and manage opportunities."}</p>
            <p>{company?.name ? `Manage listings for ${company.name}.` : "Create your company profile and manage opportunities."}</p>
          </div>
          {user ? (
            <div className="business-account-chip"><Building2 size={17} /><span>{company?.name ?? user.email}</span></div>
          ) : (
            <button className="primary-button" type="button" onClick={onRequestBusinessAccount}>Create a business account</button>
          )}
        </header>

        {company && <div className={`company-verification-notice ${company.employer_verification_status}`} role="status">
          <Building2 size={18} /><span>Company verification: <strong>{company.employer_verification_status}</strong></span>
          {membershipRole && <span className="company-member-role">Your access: {membershipRole}</span>}
        </div>}
        {dashboardStatus === "loading" && <p className="business-loading"><LoaderCircle size={16} className="business-loading-icon" /> Loading company data…</p>}
        {dashboardStatus === "unavailable" && <div className="business-data-notice" role="status"><p>Business data is unavailable. Confirm migrations and your approved company membership.</p><button type="button" className="insights-retry" onClick={() => setRefreshSequence((current) => current + 1)}><RefreshCw size={14} /> Retry</button></div>}

        <div className="business-summary-grid">
          <article className="business-summary-card"><span className="business-summary-icon purple"><BriefcaseBusiness size={19} /></span><div><span>Active jobs</span><strong>{dashboardStatus === "ready" ? activeJobs : "—"}</strong><small>{dashboardStatus === "ready" ? "Published listings" : "Listing data unavailable"}</small></div></article>
          <article className="business-summary-card"><span className="business-summary-icon orange"><Users size={19} /></span><div><span>Applicants</span><strong>{totalApplicants ?? "—"}</strong><small>{applicantCounts ? "Applications to your jobs" : "Application data unavailable"}</small></div></article>
          <article className="business-summary-card"><span className="business-summary-icon green"><ClipboardList size={19} /></span><div><span>Needs review</span><strong>{needsReview ?? "—"}</strong><small>{applicantCounts ? "Submitted or reviewing" : "Application data unavailable"}</small></div></article>
        </div>

        {user && dashboardStatus === "no-company" && (
          <section className="business-panel company-setup-panel" aria-labelledby="company-setup-title">
            <div className="business-panel-heading"><div><span className="eyebrow">BUSINESS PROFILE</span><h2 id="company-setup-title">Set up your company</h2></div><span className="business-panel-icon"><Building2 size={19} /></span></div>
            <p className="business-form-note">Company access is controlled by approved database roles. Submitting this form does not verify your business or enable job posting.</p>
            <form className="business-job-form" onSubmit={handleCreateCompany}>
              <label>Company name<input name="company-name" required maxLength={120} placeholder="Company or organization" disabled={busy} /></label>
              <label>Website <span className="resume-optional">Optional</span><input name="company-website" type="url" maxLength={300} placeholder="https://example.com" disabled={busy} /></label>
              <label>About the company <span className="resume-optional">Optional</span><textarea name="company-description" rows={3} maxLength={2000} placeholder="A short company description" disabled={busy} /></label>
              {message && <p className={`business-form-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}
              <button className="primary-button business-publish-button" type="submit" disabled={busy}><Plus size={16} /> {busy ? "Submitting…" : "Create company profile"}</button>
            </form>
          </section>
        )}

        {user && company && dashboardStatus === "ready" && (
          <div className="business-dashboard-grid">
            <section className="business-panel" aria-labelledby="post-job-title">
              <div className="business-panel-heading"><div><span className="eyebrow">NEW OPPORTUNITY</span><h2 id="post-job-title">{editingJob ? "Edit job draft" : "Create job draft"}</h2></div><span className="business-panel-icon"><Plus size={19} /></span></div>
              <form ref={jobFormRef} className="business-job-form" onSubmit={handleSaveDraft}>
                <label>Job title<input name="job-title" required maxLength={120} defaultValue={editingJob?.title ?? ""} placeholder="e.g. Weekend store assistant" disabled={busy} /></label>
                <div className="business-form-row">
                  <label>Category<select name="category" required defaultValue={editingJob?.category ?? ""} disabled={busy}><option value="" disabled>Select a category</option><option>Retail</option><option>Food Service</option><option>Tutoring</option><option>Technology</option><option>Community</option><option>Other</option></select></label>
                  <label>Schedule<select name="schedule" required defaultValue={editingJob?.schedule ?? "part_time"} disabled={busy}><option value="part_time">Part-time</option><option value="full_time">Full-time</option><option value="flexible">Flexible</option><option value="seasonal">Seasonal</option><option value="one_time">One-time</option></select></label>
                </div>
                <div className="business-form-row">
                  <label>Employment type<select name="employment-type" required defaultValue={editingJob?.employment_type ?? "employee"} disabled={busy}><option value="employee">Employee</option><option value="internship">Internship</option><option value="contract">Contract</option><option value="gig">Gig</option></select></label>
                  <label>Location<input name="location" required maxLength={160} defaultValue={editingJob?.location ?? ""} placeholder="City or Remote" disabled={busy} /></label>
                </div>
                <div className="business-form-row">
                  <label>Minimum pay<input name="compensation-min" type="number" min="0" step="0.01" defaultValue={editingJob?.compensation_min ?? ""} placeholder="Optional" disabled={busy} /></label>
                  <label>Maximum pay<input name="compensation-max" type="number" min="0" step="0.01" defaultValue={editingJob?.compensation_max ?? ""} placeholder="Optional" disabled={busy} /></label>
                </div>
                <div className="business-form-row">
                  <label>Pay basis<select name="compensation-type" defaultValue={editingJob?.compensation_type === "fixed" ? "fixed" : "hourly"} disabled={busy}><option value="hourly">Per hour</option><option value="fixed">Fixed amount</option></select></label>
                  <label>Minimum age<input name="minimum-age" type="number" min="13" max="99" defaultValue={editingJob?.minimum_age ?? ""} placeholder="Set applicable minimum" disabled={busy} /></label>
                </div>
                <label>Maximum age eligibility <span className="resume-optional">Optional</span><input name="maximum-age" type="number" min="13" max="99" defaultValue={editingJob?.maximum_age ?? ""} placeholder="Leave blank if no limit" disabled={busy} /></label>
                <label>Role details<textarea name="description" required maxLength={12000} rows={4} defaultValue={editingJob?.description ?? ""} placeholder="Describe the work and schedule. Include applicable eligibility requirements." disabled={busy} /></label>
                <label>Requirements <span className="resume-optional">Optional</span><textarea name="requirements" maxLength={8000} rows={3} defaultValue={editingJob?.requirements ?? ""} placeholder="Skills or qualifications" disabled={busy} /></label>
                <label>Application instructions <span className="resume-optional">Optional</span><textarea name="application-instructions" maxLength={4000} rows={2} defaultValue={editingJob?.application_instructions ?? ""} placeholder="How should applicants apply?" disabled={busy} /></label>
                {message && <p className={`business-form-message ${message.type}`} role={message.type === "error" ? "alert" : "status"} aria-live="polite">{message.text}</p>}
                <div className="business-form-actions"><button className="primary-button business-publish-button" type="submit" disabled={busy}><Plus size={16} /> {busy ? "Saving…" : editingJob ? "Save draft changes" : "Save as draft"}</button>{editingJob && <button className="business-cancel-edit" type="button" disabled={busy} onClick={() => { setEditingJob(null); jobFormRef.current?.reset(); }}>Cancel edit</button>}</div>
                <p className="business-form-note">Drafts are private to your company. A verified company can publish through the review workflow.</p>
              </form>
            </section>

            <section className="business-panel applicants-panel" aria-labelledby="applicants-title">
              <div className="business-panel-heading"><div><span className="eyebrow">CANDIDATE ACTIVITY</span><h2 id="applicants-title">Applicants</h2></div><span className="business-panel-icon applicants-icon"><Users size={19} /></span></div>
              <div className="applicants-empty-state">
                <span><Users size={23} /></span>
                {totalApplicants === null ? <><strong>Applicant data unavailable</strong><p>Application records could not be loaded securely.</p></> : totalApplicants === 0 ? <><strong>No applicants yet</strong><p>Applications to your verified-company jobs will appear here.</p></> : <><strong>{totalApplicants} applicants · {needsReview} need review</strong><p>Counts include applications only for jobs in this company.</p></>}
              </div>
            </section>
          </div>
        )}

        {user && company?.employer_verification_status === "pending" && <p className="business-form-note">Company verification is pending. You can prepare private drafts, but publishing remains blocked until an administrator approves the company.</p>}
        {user && company?.employer_verification_status === "rejected" && <p className="business-form-message error" role="status">Company verification was rejected. Contact TeenFlow support before posting jobs.</p>}

        <section className="business-listings-panel" aria-labelledby="business-listings-title">
          <div className="business-panel-heading"><div><span className="eyebrow">YOUR POSTS</span><h2 id="business-listings-title">Job listings</h2></div><span className="listing-count">{dashboardStatus === "ready" ? `${listings.length} listings` : "— listings"}</span></div>
          <div className="business-listings-header"><span>Job title</span><span>Status</span><span>Applicants</span><span>Updated</span></div>
          {dashboardStatus === "ready" && listings.map((job) => (
            <article className="business-listing-row" key={job.id}>
              <div><strong>{job.title}</strong><small>{job.category} · {job.location}</small></div>
              <span className={`business-job-status ${job.status}`}>{job.status}</span>
              <span>{applicantCounts?.[job.id]?.total ?? "—"}</span>
              <span>{job.updated_at ? new Date(job.updated_at).toLocaleDateString() : "—"}</span>
              <div className="business-listing-actions">
                <button type="button" disabled={busy || !["owner", "recruiter"].includes(membershipRole)} onClick={() => { setEditingJob(job); jobFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Edit</button>
                {job.status === "draft" && <button type="button" disabled={busy || company?.employer_verification_status !== "verified"} onClick={() => changeJobStatus(job, "published")}>Publish</button>}
                {job.status === "published" && <button type="button" disabled={busy} onClick={() => changeJobStatus(job, "closed")}>Close</button>}
                {job.status === "closed" && <button type="button" disabled={busy || company?.employer_verification_status !== "verified"} onClick={() => changeJobStatus(job, "draft")}>Reopen draft</button>}
              </div>
            </article>
          ))}
          {dashboardStatus === "no-company" && <div className="business-listings-empty">Create your company profile to start a private job draft.</div>}
          {dashboardStatus === "unavailable" && <div className="business-listings-empty">Job listings could not be loaded. No listings are being fabricated.</div>}
          {dashboardStatus === "ready" && listings.length === 0 && <div className="business-listings-empty">No job drafts or published listings yet.</div>}
        </section>
      </div>
    </section>
  );
}

export default BusinessDashboard;