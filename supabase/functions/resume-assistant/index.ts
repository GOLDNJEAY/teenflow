import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function responseHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}

function field(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

async function readRequestBody(request: Request, maximumBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bodyBytes);
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") ?? "";
  const headers = responseHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: allowedOrigins.includes(origin) ? 204 : 403,
      headers,
    });
  }
  if (!allowedOrigins.includes(origin)) {
    return jsonResponse({ error: "Origin not allowed." }, 403, origin);
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  const projectUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const aiKey = Deno.env.get("OPENAI_API_KEY");

  if (!accessToken || !projectUrl || !anonKey) {
    return jsonResponse({ error: "Authentication is required." }, 401, origin);
  }
  if (!aiKey) {
    return jsonResponse({ error: "Resume AI is not configured." }, 503, origin);
  }

  const supabase = createClient(projectUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !user) {
    return jsonResponse({ error: "A valid sign-in is required." }, 401, origin);
  }
  if (user.app_metadata?.account_type !== "student") {
    return jsonResponse({ error: "A verified student account is required." }, 403, origin);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 12_000) {
    return jsonResponse({ error: "Resume details are too long." }, 413, origin);
  }

  const rawBody = await readRequestBody(request, 12_000);
  if (rawBody === null) {
    return jsonResponse({ error: "Resume details are too long." }, 413, origin);
  }

  let body: Record<string, unknown>;
  try {
    const parsedBody: unknown = JSON.parse(rawBody);
    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return jsonResponse({ error: "Invalid request." }, 400, origin);
    }
    body = parsedBody as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Invalid request." }, 400, origin);
  }

  if (body.task !== "create_resume_draft") {
    return jsonResponse({ error: "Unsupported resume task." }, 400, origin);
  }

  const targetRole = field(body.target_role, 100);
  const skills = field(body.skills, 1200);
  const experience = field(body.experience, 3000);
  const education = field(body.education, 1000);
  if (!targetRole && !skills && !experience && !education) {
    return jsonResponse({ error: "Add at least one resume detail." }, 400, origin);
  }

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${aiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Draft a concise, age-appropriate resume for a young job seeker using only the supplied facts. Never invent employers, dates, credentials, achievements, or skills. Do not ask for or add a home address, birth date, phone number, or other sensitive personal data. Use clear headings and mark missing details as [Add details]. Return only the resume draft.",
        },
        {
          role: "user",
          content: JSON.stringify({ target_role: targetRole, skills, experience, education }),
        },
      ],
    }),
  });

  if (!aiResponse.ok) {
    return jsonResponse({ error: "Resume AI could not create a draft." }, 502, origin);
  }

  const aiData = await aiResponse.json();
  const resumeText = aiData?.choices?.[0]?.message?.content;
  if (typeof resumeText !== "string" || !resumeText.trim()) {
    return jsonResponse({ error: "Resume AI returned no draft." }, 502, origin);
  }

  return jsonResponse({ resume_text: resumeText.trim() }, 200, origin);
});
