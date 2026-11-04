import { useEffect, useMemo, useRef, useState } from "react";
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
const teenQuotes = [
  { text: "The best way to predict your future is to start building it today.", author: "Abraham Lincoln" },
  { text: "Small steps every day create big opportunities.", author: "TeenFlow" },
  { text: "Your first job is not your final destination. It is your momentum.", author: "TeenFlow" },
  { text: "Confidence grows when you take action before you feel ready.", author: "TeenFlow" },
  { text: "Start before you feel fully prepared. Growth begins at the edge of your comfort zone.", author: "TeenFlow" },
];
function getCurrentRoute() {
  if (typeof window === "undefined") return "home";
  const pathname = window.location.pathname || "/";
  if (pathname.startsWith("/business")) return "business";
  if (pathname.startsWith("/teen")) return "teen";
  if (pathname.startsWith("/signin")) return "signin";
  if (pathname.startsWith("/signup")) return "signup";
  return "home";
}

function resolveAccountType(user) {
  if (!user) return "guest";
  if (user.user_metadata?.account_type) return user.user_metadata.account_type;
  if (user.app_metadata?.account_type) return user.app_metadata.account_type;
  if (user.user_metadata?.role) return user.user_metadata.role;
  return "guest";
}

function getRouteForUser(user) {
  const type = resolveAccountType(user);
  if (type === "employer") return "business";
  if (type === "student") return "teen";
  return "home";
}

function getDailyQuote(quotes, storageKey) {
  if (typeof window === "undefined") return quotes[0];
  const dateKey = new Date().toISOString().slice(0, 10);
  const savedKey = `${storageKey}-quote-date`;
  const savedQuoteKey = `${storageKey}-quote`;
  const todayDay = localStorage.getItem(savedKey);
  if (todayDay === dateKey) {
    const savedQuote = localStorage.getItem(savedQuoteKey);
    if (savedQuote) {
      try {
        return JSON.parse(savedQuote);
      } catch {
        // continue with selected quote below
      }
    }
  }
  const index = Math.abs(dateKey.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % quotes.length;
  const selected = quotes[index];
  localStorage.setItem(savedKey, dateKey);
  localStorage.setItem(savedQuoteKey, JSON.stringify(selected));
  return selected;
}

function getAuthErrorMessage(error) {
  const message = error?.message?.toLowerCase() ?? "";
  if (error?.code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "That email and password combination wasn’t recognized. Check them and try again.";
  }
  if (error?.code === "weak_password" || message.includes("password should be at least")) {
    return "Choose a stronger password that meets the password requirements.";
  }
  if (error?.status === 429) return "Too many attempts. Wait a little and try again.";
  if (error?.code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  return error?.message || "Authentication failed. Please try again.";
}

function ArcadeGame({ compact = false }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("teenflow-arcade-high-score");
    return saved ? Number(saved) || 0 : 0;
  });

  const gameRef = useRef({
    paddleX: 120,
    paddleWidth: 90,
    paddleHeight: 12,
    paddleSpeed: 8,
    ballX: 150,
    ballY: 120,
    ballRadius: 8,
    dx: 3,
    dy: 3,
    width: 340,
    height: 220,
    animationId: 0,
    pointerActive: false,
    pointerX: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const state = gameRef.current;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = compact ? 1 : 1;
      canvas.width = Math.max(300, Math.min(rect.width || 330, 380)) * scale;
      canvas.height = 220;
      state.width = canvas.width;
      state.height = canvas.height;
      state.paddleX = canvas.width / 2 - state.paddleWidth / 2;
      state.ballX = canvas.width / 2;
      state.ballY = canvas.height / 2;
    };

    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const update = () => {
      const canvasWidth = state.width;
      const canvasHeight = state.height;

      if (isRunning && !isPaused && !gameOver) {
        state.ballX += state.dx;
        state.ballY += state.dy;

        if (state.ballX - state.ballRadius <= 0 || state.ballX + state.ballRadius >= canvasWidth) {
          state.dx *= -1;
        }

        if (state.ballY - state.ballRadius <= 0) {
          state.dy *= -1;
        }

        const paddleBottom = canvasHeight - 18;
        const paddleTop = paddleBottom - state.paddleHeight;
        const ballHitsPaddle = state.ballY + state.ballRadius >= paddleTop && state.ballY - state.ballRadius <= paddleBottom && state.ballX >= state.paddleX && state.ballX <= state.paddleX + state.paddleWidth && state.ballY + state.ballRadius >= paddleTop;

        if (ballHitsPaddle) {
          const impact = (state.ballX - (state.paddleX + state.paddleWidth / 2)) / (state.paddleWidth / 2);
          state.dx = impact * 5.5;
          state.dy = -Math.abs(state.dy) - 0.2;
          setScore((current) => { const next = current + 1; if (next > highScore) { setHighScore(next); localStorage.setItem("teenflow-arcade-high-score", String(next)); } return next; });
        }

        if (state.ballY - state.ballRadius > canvasHeight) {
          const nextLives = lives - 1;
          setLives(nextLives);
          if (nextLives <= 0) {
            setGameOver(true);
            setIsRunning(false);
            state.ballY = canvasHeight + 30;
          } else {
            state.ballX = canvasWidth / 2;
            state.ballY = canvasHeight / 2;
            state.dx = Math.random() > 0.5 ? 3.3 : -3.3;
            state.dy = 3.3;
            state.paddleX = canvasWidth / 2 - state.paddleWidth / 2;
          }
        }
      }

      if (state.pointerActive) {
        state.paddleX = Math.min(Math.max(state.pointerX - state.paddleWidth / 2, 0), canvasWidth - state.paddleWidth);
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "#0d132a";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "#8a68ff";
      ctx.fillRect(state.paddleX, canvasHeight - 18, state.paddleWidth, state.paddleHeight);
      ctx.beginPath();
      ctx.arc(state.ballX, state.ballY, state.ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#58d9cf";
      ctx.fill();
      ctx.closePath();

      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? "#ac95ff" : "#57d8d0";
        ctx.fillRect(20 + i * 34, 16, 18, 8);
      }

      state.animationId = window.requestAnimationFrame(update);
    };

    state.animationId = window.requestAnimationFrame(update);
    return () => {
      window.cancelAnimationFrame(state.animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [compact, gameOver, highScore, isPaused, isRunning, lives]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        gameRef.current.paddleX = Math.max(0, gameRef.current.paddleX - gameRef.current.paddleSpeed);
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        gameRef.current.paddleX = Math.min(gameRef.current.width - gameRef.current.paddleWidth, gameRef.current.paddleX + gameRef.current.paddleSpeed);
      }
      if (event.key === " " && !gameOver) {
        setIsPaused((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameOver]);

  const startGame = () => {
    const state = gameRef.current;
    state.ballX = state.width / 2;
    state.ballY = state.height / 2;
    state.dx = 3.3;
    state.dy = 3.3;
    state.paddleX = state.width / 2 - state.paddleWidth / 2;
    setLives(3);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setIsRunning(true);
  };

  const restartGame = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    setIsPaused(false);
    setIsRunning(true);
  };

  const handlePointerMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    gameRef.current.pointerX = x;
    gameRef.current.pointerActive = true;
    gameRef.current.paddleX = Math.min(Math.max(x - gameRef.current.paddleWidth / 2, 0), canvas.width - gameRef.current.paddleWidth);
  };

  return (
    <div className={`arcade-game ${compact ? "compact" : ""}`}>
      <div className="arcade-header">
        <div>
          <div className="eyebrow"><Sparkles size={12} /> Arcade</div>
          <h3>TeenFlow Breakout</h3>
        </div>
        <div className="arcade-stats">
          <span>Score: {score}</span>
          <span>Lives: {lives}</span>
          <span>Best: {highScore}</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="arcade-canvas" onPointerMove={handlePointerMove} onPointerDown={handlePointerMove} />
      <div className="arcade-controls">
        <button type="button" className="primary-button small" onClick={startGame} disabled={isRunning && !gameOver}>{isRunning ? "Play again" : "Start"}</button>
        <button type="button" className="secondary-button small" onClick={() => setIsPaused((current) => !current)} disabled={!isRunning || gameOver}>Pause</button>
        <button type="button" className="login-button" onClick={restartGame}>Restart</button>
      </div>
      {gameOver && <div className="arcade-game-over">Game over — final score: {score}</div>}
      {!isRunning && !gameOver && <div className="arcade-status">Ready to play</div>}
      {isPaused && !gameOver && <div className="arcade-status">Paused</div>}
    </div>
  );
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
  const [route, setRoute] = useState(() => getCurrentRoute());
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authFeedback, setAuthFeedback] = useState(null);
  const [signInNotice, setSignInNotice] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [accountType, setAccountType] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("sign-in");

  const authMessageTimerRef = useRef(null);
  const signInNoticeTimerRef = useRef(null);

  const isTeenAccount = resolveAccountType(authUser) === "student";
  const isBusinessAccount = resolveAccountType(authUser) === "employer";

  const teenQuote = useMemo(() => getDailyQuote(teenQuotes, "teen"), []);
  const displayName = authUser?.user_metadata?.first_name || authUser?.user_metadata?.full_name?.trim().split(/\s+/)[0] || "there";

  function navigate(nextRoute, options = {}) {
    const normalized = nextRoute === "home" ? "/" : `/${nextRoute}`;
    if (typeof window !== "undefined") {
      if (options.replace) {
        window.history.replaceState({}, "", normalized);
      } else {
        window.history.pushState({}, "", normalized);
      }
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const syncRoute = () => setRoute(getCurrentRoute());
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      if (!active) return;
      setAuthUser(nextUser);
      setAuthReady(true);

      if (event === "SIGNED_OUT") {
        setSignInNotice(false);
        setAuthFeedback(null);
        navigate("home", { replace: true });
        return;
      }

      if (event === "SIGNED_IN") {
        setNeedsEmailConfirmation(false);
        const targetRoute = getRouteForUser(nextUser);
        setAuthFeedback({ type: "success", text: "Authentication succeeded. Redirecting to your dashboard…" });
        setSignInNotice(true);
        window.clearTimeout(signInNoticeTimerRef.current);
        signInNoticeTimerRef.current = window.setTimeout(() => setSignInNotice(false), 4500);
        window.clearTimeout(authMessageTimerRef.current);
        authMessageTimerRef.current = window.setTimeout(() => setAuthFeedback(null), 4000);
        navigate(targetRoute, { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      const nextUser = data?.session?.user ?? null;
      setAuthUser(nextUser);
      setAuthReady(true);
      if (error) {
        setAuthFeedback({ type: "error", text: error.message || "We couldn't check your session." });
      }
      if (nextUser) {
        const targetRoute = getRouteForUser(nextUser);
        if (route === "home" || route === "signin" || route === "signup") {
          navigate(targetRoute, { replace: true });
        }
      }
    }).catch(() => {
      if (!active) return;
      setAuthReady(true);
      setAuthFeedback({ type: "error", text: "We couldn't check your sign-in status. Please try again." });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearTimeout(signInNoticeTimerRef.current);
      window.clearTimeout(authMessageTimerRef.current);
    };
  }, [route]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    if (authBusy) return;

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

        if (data?.session) {
          setPassword("");
          setAuthFeedback({ type: "success", text: "Your account was created and you’re signed in." });
          window.setTimeout(() => setAuthFeedback(null), 4000);
          return;
        }

        if (data?.user?.identities?.length === 0) {
          setAuthFeedback({ type: "success", text: "This email is eligible for a new account. Check your inbox for the next step." });
        } else {
          setAuthFeedback({ type: "success", text: "Account created. Check your email for a confirmation link before signing in." });
        }
        setEmail("");
        setPassword("");
        navigate("signin", { replace: true });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.code === "email_not_confirmed" || error.message?.toLowerCase().includes("email not confirmed")) {
            setNeedsEmailConfirmation(true);
            setAuthFeedback({ type: "error", text: "Please confirm your email address before signing in." });
            return;
          }
          throw error;
        }

        const signedInUser = data?.user ?? null;
        setPassword("");
        setAuthFeedback({ type: "success", text: "Authentication succeeded. Redirecting…" });
        if (signedInUser) {
          const target = getRouteForUser(signedInUser);
          navigate(target, { replace: true });
        }
      }
    } catch (error) {
      setAuthFeedback({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      setAuthBusy(false);
      window.clearTimeout(authMessageTimerRef.current);
      authMessageTimerRef.current = window.setTimeout(() => setAuthFeedback(null), 5000);
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
      navigate("home", { replace: true });
    } catch (error) {
      setAuthFeedback({ type: "error", text: getAuthErrorMessage(error) });
    } finally {
      setAuthBusy(false);
      setSignInNotice(false);
    }
  }

  function toggleSavedJob(title) {
    setSavedJobs((current) => current.includes(title) ? current.filter((value) => value !== title) : [...current, title]);
  }

  function selectQuickFilter(filter) {
    setQuickFilter(filter);
    setCategoryFilter(filter === "All Jobs" || filter === "Remote Jobs" ? "All Categories" : filter);
    if (filter === "Remote Jobs") setLocationSearch("");
  }

  function showPostHustleMessage() {
    setActionMessage("Hustle posting is not connected yet. No listing was submitted.");
  }

  const filteredJobs = filterJobs(jobs, {
    search,
    locationSearch,
    categoryFilter,
    scheduleFilter,
    quickFilter,
  });

  const accountTypeLabel = resolveAccountType(authUser) === "employer"
    ? "Employer account"
    : resolveAccountType(authUser) === "student"
      ? "Student account"
      : "Account type not selected";

  const renderAuthPage = (mode) => (
    <section className="auth-page-shell">
      <div className="auth-page-card">
        <div className="auth-page-copy">
          <div className="eyebrow">YOUR NEXT STEP</div>
          <h1>{mode === "sign-up" ? "Create your TeenFlow account" : "Welcome back"}</h1>
          <p>{mode === "sign-up" ? "Join TeenFlow to discover opportunities, connect with employers, and grow your future." : "Sign in to continue your journey and access your dashboard."}</p>
          <ul className="auth-benefits">
            <li>Discover opportunities built for young people</li>
            <li>Track jobs, applications, and saved roles</li>
            <li>Connect with employers and local opportunities</li>
          </ul>
        </div>

        <form className="auth-form-panel" onSubmit={handleAuthSubmit}>
          <div className="auth-mode-switch" role="group" aria-label="Account action">
            <button type="button" aria-pressed={authMode === "sign-in"} onClick={() => { setAuthMode("sign-in"); setAuthFeedback(null); setNeedsEmailConfirmation(false); navigate("signin", { replace: true }); }}>Sign in</button>
            <button type="button" aria-pressed={authMode === "sign-up"} onClick={() => { setAuthMode("sign-up"); setAuthFeedback(null); setNeedsEmailConfirmation(false); navigate("signup", { replace: true }); }}>Create account</button>
          </div>

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
            <input type="password" name="password" autoComplete={authMode === "sign-up" ? "new-password" : "current-password"} minLength={authMode === "sign-up" ? 8 : undefined} required disabled={authBusy} value={password} onChange={(event) => setPassword(event.target.value)} />
            {authMode === "sign-up" && <small className="auth-field-hint">Use at least 8 characters.</small>}
          </label>

          {authFeedback && <div className={`auth-feedback ${authFeedback.type}`}>{authFeedback.text}</div>}

          {needsEmailConfirmation && (
            <button type="button" className="secondary-button wide" disabled={authBusy} onClick={handleResendConfirmation}>
              Resend confirmation email
            </button>
          )}

          <button type="submit" className="primary-button wide" disabled={authBusy}>
            {authBusy ? (authMode === "sign-up" ? "Creating account…" : "Signing in…") : (authMode === "sign-up" ? "Create account" : "Sign in")}
          </button>

          <div className="auth-subtext">
            <span>{authMode === "sign-up" ? "Already have an account?" : "Need an account?"}</span>
            <button type="button" className="text-button" onClick={() => { const nextMode = authMode === "sign-up" ? "sign-in" : "sign-up"; setAuthMode(nextMode); setAuthFeedback(null); navigate(nextMode === "sign-in" ? "signin" : "signup", { replace: true }); }}>
              {authMode === "sign-up" ? "Sign in" : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );

  const renderTeenDashboard = () => (
    <div className="route-page teen-page">
      <section className="student-page-intro">
        <div className="eyebrow"><span className="live-dot" /> YOUR TEENFLOW DASHBOARD</div>
        <h1>Welcome back, {displayName}.</h1>
        <p>Explore opportunities, save what fits, and keep your next steps moving.</p>
        <div className="student-page-actions">
          <a className="primary-button browse-jobs-button" href="#student-jobs">Find a job <span>↘</span></a>
          <a className="student-text-link" href="#student-dashboard">Open dashboard <span>→</span></a>
        </div>
      </section>

      <section className="daily-quote-card">
        <div className="eyebrow"><Sparkles size={12} /> DAILY INSPIRATION</div>
        <blockquote>“{teenQuote.text}”</blockquote>
        <small>— {teenQuote.author}</small>
      </section>

      <StudentResumeAssistant user={authUser} onRequestSignIn={() => navigate("signin", { replace: true })} />

      <section className="game-section">
        <div className="game-header">
          <div>
            <div className="eyebrow">GAME MODE</div>
            <h2>Breakout challenge</h2>
          </div>
        </div>
        <ArcadeGame />
      </section>

      <section className="jobs-section" id="student-jobs">
        <div className="job-page-heading">
          <div>
            <div className="eyebrow">THE WORLD IS OPENING UP</div>
            <h2>Find your next <span className="job-title-accent">TeenFlow opportunity</span></h2>
            <p className="job-result-count">{filteredJobs.length} of {jobs.length} demo matches match your search.</p>
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

        <LiveJobListings user={authUser} filters={{ search, locationSearch, categoryFilter, scheduleFilter, quickFilter }} onRequestSignIn={() => navigate("signin", { replace: true })} />

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

      <section className="how-section student-how-section" id="student-how">
        <div className="eyebrow">YOUR JOURNEY STARTS HERE</div>
        <h2>Big goals. <span className="gradient-text">Small first steps.</span></h2>
        <div className="steps-grid">
          <article><span className="step-number">01</span><div className="step-symbol">⌕</div><h3>Discover</h3><p>Explore opportunities that fit your interests, skills, and schedule.</p></article>
          <article><span className="step-number">02</span><div className="step-symbol">↗</div><h3>Get ready</h3><p>Prepare your profile and learn how to present your strengths.</p></article>
          <article><span className="step-number">03</span><div className="step-symbol">✳</div><h3>Move forward</h3><p>Take your next step toward experience, independence, and growth.</p></article>
        </div>
      </section>
    </div>
  );

  const renderBusinessDashboard = () => (
    <BusinessDashboard user={authUser} onReturnHome={() => navigate("home", { replace: true })} onRequestBusinessAccount={() => navigate("signup", { replace: true })} />
  );

  const renderHomePage = () => (
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
            TeenFlow helps students discover flexible work, internships, and real-world experience while helping local businesses connect with motivated young talent.
          </p>
          <div className="hero-actions">
            <button className="primary-button browse-jobs-button" type="button" onClick={() => navigate("signup")}>Get started <span>↗</span></button>
            <button className="secondary-button" type="button" onClick={() => navigate("signin")}>Sign in <span>→</span></button>
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
      </section>

      <section className="stats-strip">
        <div><strong>01</strong><span>Your first opportunity</span></div>
        <div><strong>02</strong><span>Skills for your future</span></div>
        <div><strong>03</strong><span>Confidence that grows</span></div>
        <div><strong>04</strong><span>A path that's yours</span></div>
      </section>

      <section className="public-section how-promo">
        <div className="eyebrow">HOW IT WORKS</div>
        <h2>Built for teens and businesses.</h2>
        <div className="public-grid">
          <article>
            <div className="feature-icon"><Sparkles size={18} /></div>
            <h3>For teens</h3>
            <p>Build experience, discover flexible roles, and save opportunities that match your goals.</p>
          </article>
          <article>
            <div className="feature-icon"><Building2 size={18} /></div>
            <h3>For employers</h3>
            <p>Connect with motivated young professionals and support your local community.</p>
          </article>
          <article>
            <div className="feature-icon"><TrendingUp size={18} /></div>
            <h3>For growth</h3>
            <p>Track momentum, build confidence, and take the next step with a clear path forward.</p>
          </article>
        </div>
      </section>

      <section className="public-section one-panel">
        <div className="two-column-copy">
          <div className="eyebrow">TEENS</div>
          <h2>Find your next opportunity.</h2>
          <p>TeenFlow helps students discover jobs, gigs, internships, and early-career experiences that fit their schedule and ambitions.</p>
          <button className="primary-button" type="button" onClick={() => navigate("signup")}>Create a teen account</button>
        </div>
        <div className="two-column-copy">
          <div className="eyebrow">BUSINESSES</div>
          <h2>Meet the talent of tomorrow.</h2>
          <p>Local employers can support youth, build future pipelines, and connect with ambitious young people ready to contribute.</p>
          <button className="secondary-button" type="button" onClick={() => navigate("signup")}>Create a business account</button>
        </div>
      </section>

      <section className="public-section game-section-home">
        <div className="game-header">
          <div>
            <div className="eyebrow">FUN + ENGAGEMENT</div>
            <h2>Quick arcade break</h2>
          </div>
        </div>
        <ArcadeGame compact />
      </section>

      <CommunityInsights />

      <section className="employer-section" id="employers">
        <div>
          <div className="eyebrow">FOR LOCAL EMPLOYERS</div>
          <h2>Meet the talent<br />of <span className="gradient-text">tomorrow.</span></h2>
          <p>Connect with motivated young people, support your community, and help build the next generation of talent.</p>
          <button className="primary-button" type="button" onClick={() => navigate("signup")}>Partner with TeenFlow ↗</button>
        </div>
        <div className="employer-art"><div className="art-circle"><span>TF</span></div><div className="art-label label-one">Local opportunity</div><div className="art-label label-two">Future talent ✳</div><div className="art-star">✳</div></div>
      </section>

      <section className="final-cta"><span className="cta-sparkle">✳</span><div className="eyebrow">YOUR STORY IS JUST BEGINNING</div><h2>There's more out there.<br /><span className="gradient-text">Let's find it.</span></h2><button type="button" className="primary-button" onClick={() => navigate("signup")}>Explore teenflow.org ↗</button></section>
    </>
  );

  return (
    <div className="app">
      <div className="announcement">teenflow.org: your future starts here. Find opportunities built for you.</div>

      <header className="navbar">
        <button type="button" className="brand brand-button" onClick={() => navigate("home", { replace: true })}>
          <span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /></span>
          <span>Teen<span className="brand-flow">Flow</span></span>
        </button>

        <button className="menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>

        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"}>
          {route === "home" ? (
            <>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("home", { replace: true }); }}>About TeenFlow</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("signin", { replace: true }); }}>Sign in</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("signup", { replace: true }); }}>Create account</button>
            </>
          ) : route === "teen" ? (
            <>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("teen", { replace: true }); }}>Dashboard</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("home", { replace: true }); }}>Public home</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); handleSignOut(); }}>Sign out</button>
            </>
          ) : route === "business" ? (
            <>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("business", { replace: true }); }}>Business dashboard</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("home", { replace: true }); }}>Public home</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); handleSignOut(); }}>Sign out</button>
            </>
          ) : (
            <>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("home", { replace: true }); }}>Home</button>
              <button type="button" className="nav-link-button" onClick={() => { setMenuOpen(false); navigate("signup", { replace: true }); }}>Create account</button>
            </>
          )}
        </nav>

        <div className={authUser ? "nav-actions authenticated-actions" : "nav-actions"}>
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
              <button className="login-button" onClick={() => navigate("signin", { replace: true })}>Log in</button>
              <button className="primary-button small" onClick={() => navigate("signup", { replace: true })}>Get Started <span>↗</span></button>
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
        {authFeedback && <div className={`page-feedback ${authFeedback.type}`}>{authFeedback.text}</div>}

        {route === "signin" && renderAuthPage("sign-in")}
        {route === "signup" && renderAuthPage("sign-up")}
        {route === "teen" && (!authReady ? <div className="business-loading"><span className="auth-spinner" aria-hidden="true" /> Loading teen dashboard…</div> : isTeenAccount ? renderTeenDashboard() : <section className="business-access-denied"><h1>Teen dashboard</h1><p>Your account isn’t authorized to view this page.</p><button className="primary-button" type="button" onClick={() => navigate("home", { replace: true })}>Return home</button></section>)}
        {route === "business" && (!authReady ? <div className="business-loading"><span className="auth-spinner" aria-hidden="true" /> Loading business workspace…</div> : isBusinessAccount ? renderBusinessDashboard() : <section className="business-access-denied"><h1>Business dashboard</h1><p>Sign in with a business account to open this workspace.</p><button className="primary-button" type="button" onClick={() => navigate("signup", { replace: true })}>Create a business account</button></section>)}
        {route === "home" && renderHomePage()}
      </main>

      {route !== "business" && route !== "teen" && (
        <footer>
          <button type="button" className="brand footer-brand brand-button" onClick={() => navigate("home", { replace: true })}>
            <span className="brand-mark"><i /><i /><i /><i /><i /><i /><i /></span>
            <span>Teen<span className="brand-flow">Flow</span></span>
          </button>
          <p>Opening doors. Building futures.</p>
          <span className="footer-copy">© 2026 teenflow.org. Built for what's next.</span>
        </footer>
      )}
    </div>
  );
}

export default App;
