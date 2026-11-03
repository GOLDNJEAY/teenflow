import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bookmark,
  BriefcaseBusiness,
  Building2,
  CircleHelp,
  DollarSign,
  Filter,
  GraduationCap,
  MapPin,
  Search,
  Send,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Trophy,
  Utensils,
  X,
} from "lucide-react";
import CommunityInsights from "./CommunityInsights.jsx";
import BusinessDashboard from "./BusinessDashboard.jsx";
import LiveJobListings from "./LiveJobListings.jsx";
import StudentResumeAssistant from "./StudentResumeAssistant.jsx";
import { filterJobs } from "./jobSearch.js";
import { supabase } from "./supabase.js";
import "./App.css";

const jobs = [
  { title: "Part-time Barista", company: "Neighborhood Cafe", pay: "$15–17/hr", type: "Part-time", category: "Food Service", location: "Brooklyn, NY", remote: false, color: "orange", icon: Utensils },
  { title: "Retail Team Member", company: "Northside Outfitters", pay: "$15–18/hr", type: "Part-time", category: "Retail", location: "Queens, NY", remote: false, color: "purple", icon: Store },
  { title: "Junior Marketing Assistant", company: "Creative Studio", pay: "$17–20/hr", type: "Flexible", category: "Tech", location: "Remote", remote: true, color: "blue", icon: Sparkles },
  { title: "IT Support Intern", company: "Technology Company", pay: "$18–22/hr", type: "Internship", category: "Tech", location: "Remote", remote: true, color: "blue", icon: BriefcaseBusiness },
  { title: "Math Tutor", company: "Bright Path Learning", pay: "$18–24/hr", type: "Flexible", category: "Tutoring", location: "Remote", remote: true, color: "green", icon: GraduationCap },
  { title: "Library Page", company: "Community Library", pay: "$15–16/hr", type: "Part-time", category: "Community", location: "Brooklyn, NY", remote: false, color: "pink", icon: Bookmark },
  { title: "Social Media Assistant", company: "Small Business Co.", pay: "$16–19/hr", type: "Flexible", category: "Tech", location: "Remote", remote: true, color: "pink", icon: Sparkles },
  { title: "Weekend Pet Helper", company: "Local Pet Care", pay: "$16–20/hr", type: "Weekend", category: "Community", location: "Queens, NY", remote: false, color: "green", icon: Star },
];

const quickFilters = ["All Jobs", "Remote Jobs", "Retail", "Food Service", "Tutoring", "Tech"];
const milestones = ["First Dollar", "$50 Club", "Century I", "Half Grand", "Grand Achiever", "First Gig"];

function getAuthErrorMessage(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (error?.code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "That email and password combination wasn’t recognized. Check them and try again.";
  }
  if (error?.code === "weak_password" || message.includes("password should be at least")) {
    return "Choose a stronger password that meets the password requirements.";
  }
  if (error?.status === 429) return "Too many attempts. Wait a little and try again.";
  return error?.message || "Authentication failed. Please try again.";
}

function App() {
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [scheduleFilter, setScheduleFilter] = useState("Any schedule");
  const [quickFilter, setQuickFilter] = useState("All Jobs");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [savedJobs, setSavedJobs] = useState([]);
  const [dashboardTab, setDashboardTab] = useState("overview");
  const [actionMessage, setActionMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState("sign-in");
  const [accountType, setAccountType] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authFeedback, setAuthFeedback] = useState(null);
  const [signInNotice, setSignInNotice] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash;
    if (hash === "#business") return "business";
    if (hash === "#student" || hash.startsWith("#student-")) return "student";
    return "home";
  });
  const authDialogRef = useRef(null);
  const signInNoticeTimerRef = useRef(null);

  const isBusinessAccount = authUser?.user_metadata?.account_type === "employer";

  function navigatePage(page) {
    setActivePage(page);
    const nextHash = page === "business" ? "#business" : page === "student" ? "#student" : "#home";
    if (window.location.hash !== nextHash) window.history.pushState({ page }, "", nextHash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      setAuthUser(nextUser);
      setAuthReady(true);
      if (event === "SIGNED_OUT") {
        setSignInNotice(false);
        navigatePage("home");
      }
      if (event === "SIGNED_IN") {
        setAuthDialogOpen(false);
        setPassword("");
        setAuthFeedback(null);
        setNeedsEmailConfirmation(false);
        setSignInNotice(true);
        window.clearTimeout(signInNoticeTimerRef.current);
        signInNoticeTimerRef.current = window.setTimeout(() => setSignInNotice(false), 4500);
        if (nextUser?.user_metadata?.account_type === "employer") navigatePage("business");
        if (nextUser?.user_metadata?.account_type === "student") navigatePage("student");
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setAuthUser(data.session?.user ?? null);
      setAuthReady(true);
      if (data.session?.user?.user_metadata?.account_type === "employer") navigatePage("business");
      if (data.session?.user?.user_metadata?.account_type === "student") navigatePage("student");
      if (error) setAuthFeedback({ type: "error", text: error.message });
    }).catch(() => {
      if (!active) return;
      setAuthReady(true);
      setAuthFeedback({ type: "error", text: "We couldn't check your sign-in status. Please try again." });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearTimeout(signInNoticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    function syncPageFromLocation() {
      const hash = window.location.hash;
      setActivePage(hash === "#business" ? "business" : hash === "#student" || hash.startsWith("#student-") ? "student" : "home");
    }
    window.addEventListener("hashchange", syncPageFromLocation);
    window.addEventListener("popstate", syncPageFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncPageFromLocation);
      window.removeEventListener("popstate", syncPageFromLocation);
    };
  }, []);

  useEffect(() => {
    const dialog = authDialogRef.current;
    if (authDialogOpen && !dialog.open) dialog.showModal();
    if (!authDialogOpen && dialog.open) dialog.close();
  }, [authDialogOpen]);

  function openAuthDialog(mode, selectedType = "student") {
    setAuthMode(mode);
    setAccountType(selectedType);
    setEmail("");
    setPassword("");
    setAuthFeedback(null);
    setNeedsEmailConfirmation(false);
    setAuthDialogOpen(true);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthFeedback(null);
    setNeedsEmailConfirmation(false);

    try {
      if (authMode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { account_type: accountType },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        setPassword("");
        setAuthFeedback({
          type: "success",
          text: data.session
            ? "Your account was created and you're signed in."
            : data.user?.identities?.length === 0
              ? "If this email is eligible for a new account, check your inbox for next steps."
              : "Account created. Check your email for a confirmation link. You aren't signed in until you confirm your address.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed")) {
            setNeedsEmailConfirmation(true);
            setAuthFeedback({ type: "error", text: "Please confirm your email address before signing in." });
            return;
          }
          throw error;
        }

        setPassword("");
        setAuthFeedback({ type: "success", text: "You're signed in." });
      }
    } catch (error) {
      setAuthFeedback({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResendConfirmation() {
    setAuthBusy(true);
    setAuthFeedback(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
      if (error) throw error;
      setAuthFeedback({ type: "success", text: "Confirmation email sent. Check your inbox." });
      setNeedsEmailConfirmation(false);
    } catch (error) {
      setAuthFeedback({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setActionMessage("You’re signed out.");
    } catch (error) {
      setAuthFeedback({ type: "error", text: getAuthErrorMessage(error) });
      setAuthMode("sign-in");
      setAuthDialogOpen(true);
    } finally {
      setAuthBusy(false);
    }
  }

  const accountTypeLabel = authUser?.user_metadata?.account_type === "employer"
    ? "Employer account"
    : authUser?.user_metadata?.account_type === "student"
      ? "Student account"
      : "Account type not selected";

  const filteredJobs = filterJobs(jobs, {
    search,
    locationSearch,
    categoryFilter,
    scheduleFilter,
    quickFilter,
  });

  const displayName = authUser?.user_metadata?.first_name
    || authUser?.user_metadata?.full_name?.trim().split(/\s+/)[0]
    || "there";

  function selectQuickFilter(filter) {
    setQuickFilter(filter);
    setCategoryFilter(filter === "All Jobs" || filter === "Remote Jobs" ? "All Categories" : filter);
    if (filter === "Remote Jobs") setLocationSearch("");
  }

  function toggleSavedJob(title) {
    setSavedJobs((current) => current.includes(title)
      ? current.filter((savedTitle) => savedTitle !== title)
      : [...current, title]);
  }

  function showPostHustleMessage() {
    setActionMessage("Hustle posting is not connected yet. No listing was submitted.");
  }

  return (
    <div className="app">
      <div className="announcement">
        Your future starts here. Find opportunities built for you.
      </div>

      <header className="navbar">
        <a className="brand" href="#home">
          <span className="brand-mark">
            <i /><i /><i /><i /><i /><i /><i />
          </span>
          <span>Teen<span className="brand-flow">Flow</span></span>
        </a>

        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>

        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"}>
          {activePage === "business" ? (
            <>
              <a href="#home" onClick={(event) => { event.preventDefault(); setMenuOpen(false); navigatePage("home"); }}>TeenFlow home</a>
              {isBusinessAccount && <a href="#business" aria-current="page">Business dashboard</a>}
            </>
          ) : activePage === "student" ? (
            <>
              <a href="#home" onClick={(event) => { event.preventDefault(); setMenuOpen(false); navigatePage("home"); }}>Home</a>
              <a href="#student-jobs">Find Jobs</a>
              <a href="#student-dashboard">Dashboard</a>
              <a href="#student-hustles">Hustles</a>
              <a href="#student-how">How It Works</a>
              {isBusinessAccount && <a href="#business" onClick={(event) => { event.preventDefault(); setMenuOpen(false); navigatePage("business"); }}>Business dashboard</a>}
            </>
          ) : (
            <>
              <a href="#home" onClick={() => setMenuOpen(false)}>About TeenFlow</a>
              <a href="#student" onClick={(event) => { event.preventDefault(); setMenuOpen(false); navigatePage("student"); }}>Student page</a>
              <a href="#employers" onClick={() => setMenuOpen(false)}>For Employers</a>
              {isBusinessAccount && <a href="#business" onClick={(event) => { event.preventDefault(); setMenuOpen(false); navigatePage("business"); }}>Business dashboard</a>}
            </>
          )}
          {authReady && !authUser && (
            <div className="mobile-auth-actions">
              <button type="button" className="mobile-auth-secondary" onClick={() => { setMenuOpen(false); openAuthDialog("sign-in"); }}>Sign in</button>
              <button type="button" className="primary-button" onClick={() => { setMenuOpen(false); openAuthDialog("sign-up"); }}>Create account</button>
            </div>
          )}
        </nav>

        <div className={authReady && authUser ? "nav-actions authenticated-actions" : "nav-actions"}>
          {!authReady ? <span className="auth-loading"><span className="auth-spinner" aria-hidden="true" /> Checking account</span> : authUser ? (
            <>
              <div className="auth-user" aria-label="Signed-in account">
                <span className="auth-user-email">{authUser.email}</span>
                <span className="auth-account-type">{accountTypeLabel}</span>
              </div>
              <button className="login-button sign-out-button" disabled={authBusy} onClick={handleSignOut}>{authBusy ? "Signing out…" : "Sign out"}</button>
            </>
          ) : (
            <>
              <button className="login-button" onClick={() => openAuthDialog("sign-in")}>Log in</button>
              <button className="primary-button small" onClick={() => openAuthDialog("sign-up")}>Get Started <span>↗</span></button>
            </>
          )}
        </div>
      </header>

      {signInNotice && (
        <div className="sign-in-notice" role="status" aria-live="polite">
          <span>You’re signed in.</span>
          <button type="button" aria-label="Dismiss sign-in notification" onClick={() => setSignInNotice(false)}><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      <main>
        {activePage === "business" ? (
          !authReady ? (
            <div className="business-loading"><span className="auth-spinner" aria-hidden="true" /> Loading workspace…</div>
          ) : isBusinessAccount ? (
            <BusinessDashboard user={authUser} onReturnHome={() => navigatePage("home")} />
          ) : (
            <section className="business-access-denied">
              <div className="business-panel-icon"><Building2 size={22} /></div>
              <h1>Business dashboard</h1>
              <p>Sign in with a business account to open this workspace.</p>
              <div><button className="primary-button" type="button" onClick={() => openAuthDialog("sign-up", "employer")}>Create a business account</button><button className="business-back-link" type="button" onClick={() => navigatePage("home")}>Return to TeenFlow</button></div>
            </section>
          )
        ) : (
          <>
        {activePage === "home" && (
          <>
        {actionMessage && (
          <div className="action-toast" role="status" aria-live="polite">
            <span>{actionMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setActionMessage("")}><X size={16} /></button>
          </div>
        )}

        <section className="hero" id="home">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> BUILT FOR THE NEXT GENERATION</div>
            <h1>Your future<br />is <span className="gradient-text">in motion.</span></h1>
            <p className="hero-description">
              Made for 16–19-year-olds looking for flexible work, real experience, and a first step on their own terms.
            </p>

            <div className="hero-actions">
              <a className="primary-button browse-jobs-button" href="#student">Browse Jobs <span>↗</span></a>
              <a className="secondary-button" href="#student">Explore Hustles <span>→</span></a>
            </div>

            <div className="hero-proof">
              <div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>+</span></div>
              <div><strong>Your potential has a place.</strong><small>Made for students. Built for opportunity.</small></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="orb orb-one" /><div className="orb orb-two" />
            <div className="floating-card card-top"><span className="card-icon green">✓</span><div><strong>Opportunity unlocked</strong><small>One step closer to your future</small></div></div>

            <div className="dashboard-card">
              <div className="dashboard-top"><div><small>YOUR NEXT CHAPTER</small><h3>Find your thing.</h3></div><span className="sparkle">✳</span></div>
              <div className="mini-search"><span>⌕</span> Discover your next opportunity <span className="search-arrow">↗</span></div>
              <div className="preview-heading"><strong>Opportunities to explore</strong><span>FOR YOU</span></div>
              {jobs.slice(0, 3).map((job) => (
                <div className="preview-job" key={job.title}>
                  <div className={`job-icon ${job.color}`}><job.icon size={16} aria-hidden="true" /></div>
                  <div className="preview-job-info"><strong>{job.title}</strong><small>{job.company}</small></div>
                  <span className="job-arrow">↗</span>
                </div>
              ))}
              <div className="dashboard-footer"><span className="live-dot" /> Your next opportunity is out there.</div>
            </div>

            <div className="floating-card card-bottom"><span className="card-icon purple-icon">✦</span><div><strong>Start where you are.</strong><small>Build skills. Gain experience.</small></div></div>
          </div>
          <div className="hero-decoration decoration-one" />
          <div className="hero-decoration decoration-two" />
        </section>

        <section className="stats-strip">
          <div><strong>01</strong><span>Your first opportunity</span></div>
          <div><strong>02</strong><span>Skills for your future</span></div>
          <div><strong>03</strong><span>Confidence that grows</span></div>
          <div><strong>04</strong><span>A path that's yours</span></div>
        </section>
        <CommunityInsights />
          </>
        )}

        {activePage === "student" && (
          <>
        {actionMessage && (
          <div className="action-toast" role="status" aria-live="polite">
            <span>{actionMessage}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setActionMessage("")}><X size={16} /></button>
          </div>
        )}
        <section className="student-page-intro">
          <div className="eyebrow"><span className="live-dot" /> YOUR TEENFLOW SPACE</div>
          <h1>Find your next move.</h1>
          <p>Explore opportunities, save the ones that fit, and keep your next steps together.</p>
          <div className="student-page-actions"><a className="primary-button browse-jobs-button" href="#student-jobs">Find a job <span>↘</span></a><a className="student-text-link" href="#student-dashboard">Open dashboard <span>→</span></a></div>
        </section>

        <StudentResumeAssistant user={authUser} onRequestSignIn={() => openAuthDialog("sign-in", "student")} />

        <section className="jobs-section" id="student-jobs">
          <div className="job-page-heading">
            <div>
              <div className="eyebrow">THE WORLD IS OPENING UP</div>
              <h2>Find Your Perfect <span className="job-title-accent">Teen Job</span></h2>
              <p className="job-result-count">{filteredJobs.length} of {jobs.length} sample jobs match your search.</p>
            </div>
          </div>

          <div className="filters-card">
            <div className="filter-fields">
              <label className="filter-input search-filter">
                <Search size={17} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs or companies..." aria-label="Search jobs or companies" />
              </label>
              <label className="filter-input location-filter">
                <MapPin size={17} aria-hidden="true" />
                <input value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} placeholder="City or 'Remote'" aria-label="City or Remote" />
              </label>
              <label className="category-filter">
                <span className="sr-only">Job category</span>
                <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setQuickFilter("All Jobs"); }}>
                  <option>All Categories</option>
                  <option>Retail</option>
                  <option>Food Service</option>
                  <option>Tutoring</option>
                  <option>Tech</option>
                  <option>Community</option>
                </select>
              </label>
              <button className={showMoreFilters ? "filter-toggle active" : "filter-toggle"} type="button" aria-expanded={showMoreFilters} onClick={() => setShowMoreFilters(!showMoreFilters)}>
                <Filter size={16} aria-hidden="true" /> <span>Filters</span>
              </button>
            </div>

            {showMoreFilters && (
              <div className="advanced-filters">
                <label className="category-filter">
                  <span>Schedule</span>
                  <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)}>
                    <option>Any schedule</option>
                    <option>Part-time</option>
                    <option>Flexible</option>
                    <option>Internship</option>
                    <option>Weekend</option>
                    <option>Remote only</option>
                  </select>
                </label>
                <button type="button" className="clear-filters" onClick={() => { setSearch(""); setLocationSearch(""); setCategoryFilter("All Categories"); setScheduleFilter("Any schedule"); setQuickFilter("All Jobs"); }}>Clear filters</button>
              </div>
            )}

            <div className="quick-filters" aria-label="Quick job filters">
              {quickFilters.map((filter) => (
                <button key={filter} type="button" className={quickFilter === filter ? "quick-filter active" : "quick-filter"} aria-pressed={quickFilter === filter} onClick={() => selectQuickFilter(filter)}>
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <LiveJobListings
            user={authUser}
            filters={{ search, locationSearch, categoryFilter, scheduleFilter, quickFilter }}
            onRequestSignIn={() => openAuthDialog("sign-in", "student")}
          />

          <div className="job-grid">
            {filteredJobs.length ? filteredJobs.map((job) => (
              <article className="job-card" key={job.title}>
                <div className="job-card-top">
                  <div className={`job-icon large ${job.color}`}><job.icon size={20} aria-hidden="true" /></div>
                  <span className="job-type">{job.type}</span>
                  <button className={savedJobs.includes(job.title) ? "save-job saved" : "save-job"} type="button" aria-label={savedJobs.includes(job.title) ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`} aria-pressed={savedJobs.includes(job.title)} onClick={() => toggleSavedJob(job.title)}>
                    <Bookmark size={16} fill={savedJobs.includes(job.title) ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                </div>
                <h3>{job.title}</h3><p>{job.company}</p>
                <div className="job-location"><MapPin size={13} aria-hidden="true" /> {job.location} <span>{job.category}</span></div>
                <div className="job-card-bottom"><strong>{job.pay}</strong><button aria-label={`View ${job.title}`} onClick={() => setActionMessage(`${job.title} is a sample listing. Applications are not connected.`)}>View role ↗</button></div>
              </article>
            )) : <p className="empty-jobs">No sample jobs match those filters. Try a different search.</p>}
          </div>
          <p className="sample-note">Demo listings for interface preview only. They are not verified or currently available jobs, and applications are not connected.</p>
        </section>

        <section className="dashboard-section" id="student-dashboard">
          <div className="dashboard-heading">
            <div>
              <div className="eyebrow">YOUR TEENFLOW SPACE</div>
              <h2>Hey, {displayName}! <span aria-hidden="true">👋</span></h2>
              <p>Keep your next steps in one place.</p>
            </div>
            <button className="primary-button post-hustle-button" type="button" onClick={showPostHustleMessage}><Sparkles size={16} /> + Post a Hustle</button>
          </div>
          {!authUser && <p className="dashboard-preview-note">Preview dashboard · activity and earnings aren’t connected to an account.</p>}

          <div className="dashboard-metrics">
            <button className="metric-card metric-purple" type="button" onClick={() => setDashboardTab("saved")}>
              <span className="metric-icon"><Bookmark size={19} /></span><span className="metric-label">Saved Jobs</span><strong>{savedJobs.length}</strong><span className="metric-foot">Your shortlist</span>
            </button>
            <button className="metric-card metric-pink" type="button" onClick={() => setDashboardTab("hustles")}>
              <span className="metric-icon"><Sparkles size={19} /></span><span className="metric-label">My Hustles</span><strong>0</strong><span className="metric-foot">Posted by you</span>
            </button>
            <button className="metric-card metric-orange" type="button" onClick={() => setDashboardTab("applications")}>
              <span className="metric-icon"><Send size={19} /></span><span className="metric-label">Applications</span><strong>0</strong><span className="metric-foot">In progress</span>
            </button>
            <div className="metric-card metric-green">
              <span className="metric-icon"><TrendingUp size={19} /></span><span className="metric-label">Total Earnings</span><strong>$0</strong><span className="metric-foot">Your journey starts here</span>
            </div>
          </div>

          {dashboardTab === "overview" ? (
            <>
              <section className="achievement-banner" aria-labelledby="achievement-title">
                <div className="achievement-copy">
                  <span className="achievement-icon"><Trophy size={20} /></span>
                  <div><p className="achievement-kicker">ACHIEVEMENTS & BADGES</p><h3 id="achievement-title">Every first counts.</h3></div>
                  <div className="achievement-progress-label"><strong>0 / 15</strong><span>unlocked</span></div>
                </div>
                <progress value="0" max="15" aria-label="0 of 15 achievements unlocked" />
                <p>Complete real milestones to unlock your badges. Progress will appear here when connected.</p>
              </section>

              <div className="milestone-heading"><div><div className="eyebrow">YOUR EARNINGS JOURNEY</div><h3>Milestones to celebrate</h3></div><span>0 of 6</span></div>
              <div className="milestone-grid">
                {milestones.map((milestone, index) => (
                  <article className="milestone-card" key={milestone}>
                    <span className={`milestone-icon milestone-tone-${index}`}>
                      {index === 0 ? <DollarSign size={18} /> : index === 5 ? <BriefcaseBusiness size={18} /> : index % 2 ? <Star size={18} /> : <BadgeCheck size={18} />}
                    </span>
                    <div><strong>{milestone}</strong><small>{index === 0 ? "Earn your first dollar" : "Milestone locked"}</small></div>
                    <span className="milestone-lock" aria-label="Locked"><CircleHelp size={15} /></span>
                  </article>
                ))}
              </div>

              <div className="dashboard-stats" aria-label="Your activity statistics">
                <div><strong>0</strong><span>Jobs Done</span></div>
                <div><strong>0</strong><span>Reviews</span></div>
                <div><strong>—</strong><span>Avg Rating</span></div>
              </div>
            </>
          ) : (
            <section className="dashboard-tab-panel" aria-live="polite">
              {dashboardTab === "saved" ? (
                <>
                  <h3>Saved Jobs <span>{savedJobs.length}</span></h3>
                  {savedJobs.length ? (
                    <div className="saved-job-list">
                      {jobs.filter((job) => savedJobs.includes(job.title)).map((job) => (
                        <article className="saved-job-row" key={job.title}>
                          <div className={`job-icon ${job.color}`}><job.icon size={17} /></div>
                          <div><strong>{job.title}</strong><small>{job.company} · {job.location}</small></div>
                          <button type="button" aria-label={`Remove ${job.title} from saved jobs`} onClick={() => toggleSavedJob(job.title)}><X size={16} /></button>
                        </article>
                      ))}
                    </div>
                  ) : <p>Save sample roles from Browse Jobs to collect them here for this visit.</p>}
                </>
              ) : dashboardTab === "hustles" ? (
                <><h3>My Hustles</h3><p>You haven’t posted any hustles. Posting is not connected yet.</p><button className="text-button" type="button" onClick={showPostHustleMessage}>See posting status <span>→</span></button></>
              ) : dashboardTab === "applications" ? (
                <><h3>Applications</h3><p>No applications are stored here. Job applications aren’t connected yet.</p></>
              ) : (
                <><h3>Inquiries</h3><p>No inquiries are available. Messaging isn’t connected yet.</p></>
              )}
            </section>
          )}

          <nav className="dashboard-bottom-nav" aria-label="Dashboard sections">
            <button type="button" aria-pressed={dashboardTab === "saved"} onClick={() => setDashboardTab("saved")}><Bookmark size={16} /><span>Saved Jobs</span></button>
            <button type="button" aria-pressed={dashboardTab === "hustles"} onClick={() => setDashboardTab("hustles")}><Sparkles size={16} /><span>My Hustles</span></button>
            <button type="button" aria-pressed={dashboardTab === "applications"} onClick={() => setDashboardTab("applications")}><Send size={16} /><span>Applications</span></button>
            <button type="button" aria-pressed={dashboardTab === "inquiries"} onClick={() => setDashboardTab("inquiries")}><CircleHelp size={16} /><span>Inquiries</span></button>
          </nav>
        </section>

        <section className="hustles-section" id="student-hustles">
          <div className="hustles-copy">
            <div className="eyebrow">MORE WAYS TO GET STARTED</div>
            <h2>Explore <span>Hustles</span></h2>
            <p>Small gigs can build real-world skills. Browse community listings when they’re available, or start with a job search.</p>
            <a className="secondary-button" href="#jobs">Browse sample jobs <span>↗</span></a>
          </div>
          <div className="hustles-empty-state">
            <div className="hustle-empty-icon"><Sparkles size={23} /></div>
            <h3>No hustle listings yet</h3>
            <p>Community hustle listings aren’t connected yet. Nothing has been posted or verified.</p>
            <button className="primary-button" type="button" onClick={showPostHustleMessage}><Sparkles size={15} /> + Post a Hustle</button>
          </div>
        </section>

        <section className="how-section student-how-section" id="student-how">
          <div className="eyebrow">YOUR JOURNEY STARTS HERE</div>
          <h2>Big goals. <span className="gradient-text">Small first steps.</span></h2>
          <div className="steps-grid">
            <article><span className="step-number">01</span><div className="step-symbol">⌕</div><h3>Discover</h3><p>Explore opportunities that fit your interests, skills, and schedule.</p></article>
            <article><span className="step-number">02</span><div className="step-symbol">↗</div><h3>Get ready</h3><p>Prepare your profile and learn how to present your strengths.</p></article>
            <article><span className="step-number">03</span><div className="step-symbol">✳</div><h3>Move forward</h3><p>Take your next step toward experience, independence, and growth.</p></article>
          </div>
        </section>
          </>
        )}

        {activePage === "home" && (
          <>
        <section className="employer-section" id="employers">
          <div><div className="eyebrow">FOR LOCAL EMPLOYERS</div><h2>Meet the talent<br />of <span className="gradient-text">tomorrow.</span></h2><p>Connect with motivated young people, support your community, and help build the next generation of talent.</p><button className="primary-button" onClick={() => openAuthDialog("sign-up", "employer")}>Partner with TeenFlow ↗</button></div>
          <div className="employer-art"><div className="art-circle"><span>TF</span></div><div className="art-label label-one">Local opportunity</div><div className="art-label label-two">Future talent ✳</div><div className="art-star">✳</div></div>
        </section>

        <section className="final-cta"><span className="cta-sparkle">✳</span><div className="eyebrow">YOUR STORY IS JUST BEGINNING</div><h2>There's more out there.<br /><span className="gradient-text">Let's find it.</span></h2><a href="#student" className="primary-button">Explore TeenFlow ↗</a></section>
          </>
        )}
          </>
        )}
      </main>

      {activePage !== "business" && <footer><a className="brand footer-brand" href="#home"><span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /></span><span>Teen<span className="brand-flow">Flow</span></span></a><p>Opening doors. Building futures.</p><span className="footer-copy">© 2026 TeenFlow. Built for what's next.</span></footer>}

      <dialog
        className="auth-dialog"
        ref={authDialogRef}
        aria-labelledby="auth-dialog-title"
        onClose={() => setAuthDialogOpen(false)}
        onClick={(event) => {
          if (event.target === authDialogRef.current) setAuthDialogOpen(false);
        }}
      >
        <div className="auth-dialog-content">
          <div className="auth-dialog-top">
            <div>
              <div className="eyebrow">YOUR NEXT STEP</div>
              <h2 id="auth-dialog-title">{authMode === "sign-up" ? "Join TeenFlow." : "Welcome back."}</h2>
            </div>
            <button className="auth-close" type="button" aria-label="Close sign-in dialog" disabled={authBusy} onClick={() => setAuthDialogOpen(false)}>×</button>
          </div>

          <div className="auth-mode-switch" role="group" aria-label="Account action">
            <button type="button" disabled={authBusy} aria-pressed={authMode === "sign-in"} onClick={() => { setAuthMode("sign-in"); setAuthFeedback(null); setNeedsEmailConfirmation(false); }}>Sign in</button>
            <button type="button" disabled={authBusy} aria-pressed={authMode === "sign-up"} onClick={() => { setAuthMode("sign-up"); setAuthFeedback(null); setNeedsEmailConfirmation(false); }}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {authMode === "sign-up" && (
              <fieldset className="account-type-fieldset" disabled={authBusy}>
                <legend>Choose your account type</legend>
                <div className="account-type-options">
                  <label className={accountType === "student" ? "account-type-option selected" : "account-type-option"}>
                    <input type="radio" name="account-type" value="student" checked={accountType === "student"} onChange={() => setAccountType("student")} />
                    <span><strong>Student</strong><small>Explore early-career opportunities</small></span>
                  </label>
                  <label className={accountType === "employer" ? "account-type-option selected" : "account-type-option"}>
                    <input type="radio" name="account-type" value="employer" checked={accountType === "employer"} onChange={() => setAccountType("employer")} />
                    <span><strong>Employer</strong><small>Connect with young talent</small></span>
                  </label>
                </div>
              </fieldset>
            )}

            <label className="auth-field">
              <span>Email address</span>
              <input type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required disabled={authBusy} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input type="password" name="password" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} minLength={authMode === "sign-up" ? 8 : undefined} aria-describedby={authMode === "sign-up" ? "password-hint" : undefined} required disabled={authBusy} value={password} onChange={(event) => setPassword(event.target.value)} />
              {authMode === "sign-up" && <small className="auth-field-hint" id="password-hint">Use at least 8 characters.</small>}
            </label>

            {authFeedback && (
              <p className={`auth-feedback ${authFeedback.type}`} role={authFeedback.type === "error" ? "alert" : "status"} aria-live="polite">
                {authFeedback.text}
              </p>
            )}
            {needsEmailConfirmation && (
              <button className="resend-confirmation" type="button" disabled={authBusy || !email.trim()} onClick={handleResendConfirmation}>
                Resend confirmation email
              </button>
            )}

            <button className="primary-button auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? <><span className="auth-spinner" aria-hidden="true" /> Please wait…</> : authMode === "sign-up" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </dialog>
    </div>
  );
}

export default App;