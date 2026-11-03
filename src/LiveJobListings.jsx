import { useEffect, useState } from "react";
import { Bookmark, BriefcaseBusiness, MapPin, Send } from "lucide-react";
import { filterJobs } from "./jobSearch.js";
import { supabase } from "./supabase.js";

function formatPay(job) {
  if (job.compensation_min == null && job.compensation_max == null) return "Pay details from employer";
  const minimum = job.compensation_min == null ? "" : `$${job.compensation_min}`;
  const maximum = job.compensation_max == null ? "" : `$${job.compensation_max}`;
  const amount = minimum && maximum && minimum !== maximum ? `${minimum}–${maximum}` : minimum || maximum;
  return job.compensation_type === "hourly" ? `${amount}/hr` : amount;
}

function formatEmploymentType(value) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function LiveJobListings({ user, filters, onRequestSignIn }) {
  const [status, setStatus] = useState("loading");
  const [liveJobs, setLiveJobs] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [savedStatus, setSavedStatus] = useState("unavailable");
  const [busyJobId, setBusyJobId] = useState(null);
  const [message, setMessage] = useState(null);
  const userId = user?.id ?? null;
  const isStudent = user?.user_metadata?.account_type === "student";

  useEffect(() => {
    let active = true;

    async function loadListings() {
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, company_id, title, description, requirements, category, location, is_remote, schedule, employment_type, compensation_min, compensation_max, compensation_type, minimum_age, maximum_age, application_instructions, status, published_at, companies(name)")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(100)
          .abortSignal(AbortSignal.timeout(8000));
        if (error) throw error;
        if (active) {
          setLiveJobs(data ?? []);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("unavailable");
      }

      if (!userId || !isStudent) {
        if (active) setSavedStatus("signed-out");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("saved_jobs")
          .select("job_id")
          .eq("student_id", userId)
          .abortSignal(AbortSignal.timeout(8000));
        if (error) throw error;
        if (active) {
          setSavedIds((data ?? []).map((savedJob) => savedJob.job_id));
          setSavedStatus("ready");
        }
      } catch {
        if (active) setSavedStatus("unavailable");
      }
    }

    void loadListings();
    return () => {
      active = false;
    };
  }, [userId, isStudent]);

  const filteredLiveJobs = filterJobs(liveJobs.map((job) => ({
    ...job,
    company: Array.isArray(job.companies) ? job.companies[0]?.name ?? "Verified employer" : job.companies?.name ?? "Verified employer",
    location: job.location,
    remote: job.is_remote,
    type: formatEmploymentType(job.employment_type),
    pay: formatPay(job),
    color: "blue",
    icon: BriefcaseBusiness,
  })), filters);

  async function toggleSavedJob(jobId) {
    if (!user || !isStudent) {
      setMessage({ type: "error", text: "Sign in with an approved student account to save jobs." });
      if (!user) onRequestSignIn();
      return;
    }

    setBusyJobId(jobId);
    setMessage(null);
    const isSaved = savedIds.includes(jobId);
    const result = isSaved
      ? await supabase.from("saved_jobs").delete().eq("student_id", user.id).eq("job_id", jobId)
      : await supabase.from("saved_jobs").insert({ student_id: user.id, job_id: jobId });

    if (result.error) {
      setMessage({ type: "error", text: "We couldn’t update your saved jobs. Check your student access and try again." });
    } else {
      setSavedIds((current) => isSaved ? current.filter((id) => id !== jobId) : [...current, jobId]);
      setSavedStatus("ready");
      setMessage({ type: "success", text: isSaved ? "Job removed from saved jobs." : "Job saved to your list." });
    }
    setBusyJobId(null);
  }

  async function applyToJob(jobId) {
    if (!user || !isStudent) {
      setMessage({ type: "error", text: "Sign in with an approved student account to apply." });
      if (!user) onRequestSignIn();
      return;
    }

    setBusyJobId(jobId);
    setMessage(null);
    const { error } = await supabase.from("applications").insert({ job_id: jobId, student_id: user.id });
    if (error?.code === "23505") {
      setMessage({ type: "error", text: "You’ve already applied to this job." });
    } else if (error) {
      setMessage({ type: "error", text: "Your application wasn’t submitted. Check eligibility and try again." });
    } else {
      setMessage({ type: "success", text: "Application submitted." });
    }
    setBusyJobId(null);
  }

  return (
    <section className="live-jobs-section" aria-labelledby="live-jobs-title" aria-busy={status === "loading"}>
      <div className="live-jobs-heading">
        <div>
          <div className="eyebrow"><BriefcaseBusiness size={13} aria-hidden="true" /> VERIFIED EMPLOYER LISTINGS</div>
          <h2 id="live-jobs-title">Live opportunities</h2>
          <p>Only published jobs from verified companies appear here.</p>
        </div>
        {status === "ready" && <span className="live-jobs-count">{filteredLiveJobs.length} jobs</span>}
      </div>

      {message && <p className={`live-job-message ${message.type}`} role={message.type === "error" ? "alert" : "status"} aria-live="polite">{message.text}</p>}
      {status === "loading" && <p className="live-jobs-empty">Loading live opportunities…</p>}
      {status === "unavailable" && <p className="live-jobs-empty">Live listings aren’t available yet. Demo listings below are not real job openings.</p>}
      {status === "ready" && filteredLiveJobs.length === 0 && <p className="live-jobs-empty">No published verified jobs match these filters.</p>}

      {status === "ready" && filteredLiveJobs.length > 0 && (
        <div className="job-grid live-job-grid">
          {filteredLiveJobs.map((job) => (
            <article className="job-card live-job-card" key={job.id}>
              <div className="job-card-top">
                <span className="job-icon large blue"><BriefcaseBusiness size={20} aria-hidden="true" /></span>
                <span className="job-type">{job.type}</span>
                <button className={savedIds.includes(job.id) ? "save-job saved" : "save-job"} type="button" aria-label={savedIds.includes(job.id) ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`} aria-pressed={savedIds.includes(job.id)} disabled={busyJobId === job.id} onClick={() => toggleSavedJob(job.id)}>
                  <Bookmark size={16} fill={savedIds.includes(job.id) ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </div>
              <h3>{job.title}</h3>
              <p>{job.company}</p>
              <div className="job-location"><MapPin size={13} aria-hidden="true" /> {job.location} <span>{job.category}</span></div>
              {(job.minimum_age || job.maximum_age) && <p className="live-job-age">Age eligibility: {job.minimum_age ?? "Any"}–{job.maximum_age ?? "Any"}</p>}
              <p className="live-job-pay">{job.pay}</p>
              <button className="primary-button live-job-apply" type="button" disabled={busyJobId === job.id} onClick={() => applyToJob(job.id)}><Send size={14} /> {busyJobId === job.id ? "Please wait…" : "Apply"}</button>
            </article>
          ))}
        </div>
      )}
      {savedStatus === "unavailable" && isStudent && <p className="live-job-note">Saved-job sync isn’t available. Your live listings are still shown.</p>}
    </section>
  );
}

export default LiveJobListings;
