import { useEffect, useState } from "react";
import { Building2, GraduationCap, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "./supabase.js";

const communityInsightsEnabled = import.meta.env.VITE_COMMUNITY_INSIGHTS_ENABLED === "true";
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function CommunityInsights() {
  const [requestNumber, setRequestNumber] = useState(0);
  const [insights, setInsights] = useState({ status: communityInsightsEnabled ? "loading" : "unavailable", data: null });

  useEffect(() => {
    if (!communityInsightsEnabled) return undefined;
    let active = true;

    supabase.functions.invoke("community-insights", { body: {} }).then(({ data, error }) => {
      if (error) throw error;
      const metrics = data?.metrics;
      const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
      const validCounts = Number.isInteger(metrics?.student_count)
        && metrics.student_count >= 0
        && Number.isInteger(metrics?.business_count)
        && metrics.business_count >= 0;
      const validEarnings = typeof metrics?.total_earnings_usd === "number"
        && Number.isFinite(metrics.total_earnings_usd)
        && metrics.total_earnings_usd >= 0;

      if (!validCounts || !validEarnings || !summary) {
        throw new Error("Community insights returned incomplete data.");
      }
      if (active) setInsights({ status: "ready", data: { ...metrics, summary: summary.slice(0, 500) } });
    }).catch(() => {
      if (active) setInsights({ status: "unavailable", data: null });
    });

    return () => {
      active = false;
    };
  }, [requestNumber]);

  const data = insights.data;

  return (
    <section className="community-insights" aria-labelledby="community-insights-title" aria-busy={insights.status === "loading"}>
      <div className="community-insights-heading">
        <div>
          <div className="eyebrow"><Sparkles size={13} aria-hidden="true" /> TEENFLOW COMMUNITY</div>
          <h2 id="community-insights-title">Community insights</h2>
          <p>Privacy-safe platform totals and an AI-generated community update.</p>
        </div>
        {communityInsightsEnabled && insights.status === "unavailable" && (
          <button className="insights-retry" type="button" onClick={() => { setInsights({ status: "loading", data: null }); setRequestNumber((current) => current + 1); }}>
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        )}
      </div>

      <div className="community-insight-metrics" aria-live="polite">
        <article className="community-insight-metric">
          <span className="community-insight-icon student-insight-icon"><GraduationCap size={18} aria-hidden="true" /></span>
          <div><strong>{data ? data.student_count.toLocaleString() : "—"}</strong><span>Students</span></div>
        </article>
        <article className="community-insight-metric">
          <span className="community-insight-icon business-insight-icon"><Building2 size={18} aria-hidden="true" /></span>
          <div><strong>{data ? data.business_count.toLocaleString() : "—"}</strong><span>Businesses</span></div>
        </article>
        <article className="community-insight-metric">
          <span className="community-insight-icon earnings-insight-icon"><TrendingUp size={18} aria-hidden="true" /></span>
          <div><strong>{data ? currencyFormatter.format(data.total_earnings_usd) : "—"}</strong><span>Earned through TeenFlow</span></div>
        </article>
      </div>

      <div className={`community-ai-update ${insights.status}`} role="status" aria-live="polite">
        <span className="community-ai-icon"><Sparkles size={16} aria-hidden="true" /></span>
        {insights.status === "loading" ? (
          <p><span className="auth-spinner" aria-hidden="true" /> Loading community insights…</p>
        ) : insights.status === "ready" ? (
          <p>{data.summary}</p>
        ) : (
          <p>Community insights are not available yet. No platform totals or earnings have been estimated.</p>
        )}
      </div>
    </section>
  );
}

export default CommunityInsights;
