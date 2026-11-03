import { useRef, useState } from "react";
import { Download, FileText, Sparkles, Upload } from "lucide-react";
import { supabase } from "./supabase.js";

const allowedResumeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const maximumFileSize = 5 * 1024 * 1024;
const resumeAiEnabled = import.meta.env.VITE_RESUME_AI_ENABLED === "true";
const resumeUploadsEnabled = import.meta.env.VITE_RESUME_UPLOADS_ENABLED !== "false";

function StudentResumeAssistant({ user, onRequestSignIn }) {
  const [targetRole, setTargetRole] = useState("");
  const [experience, setExperience] = useState("");
  const [skills, setSkills] = useState("");
  const [education, setEducation] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const fileInputRef = useRef(null);

  const isStudent = user?.user_metadata?.account_type === "student";

  async function handleGenerateResume(event) {
    event.preventDefault();
    if (!user || !isStudent) {
      setFeedback({ type: "error", text: "Sign in with a student account to use the resume assistant." });
      return;
    }
    if (!resumeAiEnabled) {
      setFeedback({ type: "error", text: "Resume AI isn’t configured yet. No draft was created." });
      return;
    }
    if (!aiConsent) {
      setFeedback({ type: "error", text: "Review and accept the AI data-use note before creating a draft." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.functions.invoke("resume-assistant", {
        body: {
          task: "create_resume_draft",
          target_role: targetRole.trim(),
          experience: experience.trim(),
          skills: skills.trim(),
          education: education.trim(),
        },
      });
      if (error) throw error;

      const generatedText = typeof data?.resume_text === "string" ? data.resume_text.trim() : "";
      if (!generatedText) throw new Error("The resume service returned no draft.");

      setResumeText(generatedText);
      setFeedback({ type: "success", text: "Your draft is ready. Review every detail before using it." });
    } catch {
      setFeedback({ type: "error", text: "Resume AI isn’t available right now. No draft was created." });
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadResume() {
    if (!user || !isStudent) {
      setFeedback({ type: "error", text: "Sign in with a student account before uploading a resume." });
      return;
    }
    if (!resumeUploadsEnabled) {
      setFeedback({ type: "error", text: "Secure resume uploads aren’t configured yet. No file was uploaded." });
      return;
    }
    if (!selectedFile) {
      setFeedback({ type: "error", text: "Choose a PDF or DOCX resume first." });
      return;
    }

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!allowedResumeTypes.has(selectedFile.type) && extension !== "pdf" && extension !== "docx") {
      setFeedback({ type: "error", text: "Use a PDF or DOCX file." });
      return;
    }
    if (selectedFile.size > maximumFileSize) {
      setFeedback({ type: "error", text: "Resume files must be 5 MB or smaller." });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const safeFileName = selectedFile.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${user.id}/${crypto.randomUUID()}-${safeFileName}`;
      const { error } = await supabase.storage
        .from("student-resumes")
        .upload(path, selectedFile, { contentType: selectedFile.type || undefined, upsert: false });
      if (error) throw error;

      const { error: metadataError } = await supabase.from("resumes").insert({
        student_id: user.id,
        object_path: path,
        file_name: safeFileName,
        content_type: selectedFile.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        file_size_bytes: selectedFile.size,
      });
      if (metadataError) {
        const { error: cleanupError } = await supabase.storage.from("student-resumes").remove([path]);
        if (cleanupError) {
          throw new Error("The private upload completed, but its resume record and automatic cleanup failed. Contact support before retrying.");
        }
        throw metadataError;
      }

      setFeedback({ type: "success", text: "Resume upload completed." });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setFeedback({ type: "error", text: error.message === "The private upload completed, but its resume record and automatic cleanup failed. Contact support before retrying."
        ? error.message
        : "No resume was uploaded. The private resume bucket, metadata table, or owner-only policy may not be ready yet." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDraft() {
    if (!resumeText) return;
    const draftFile = new Blob([resumeText], { type: "text/plain;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(draftFile);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = "teenflow-resume-draft.txt";
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
    setFeedback({ type: "success", text: "Resume draft downloaded." });
  }

  return (
    <section className="resume-assistant" aria-labelledby="resume-assistant-title">
      <div className="resume-assistant-header">
        <div>
          <div className="eyebrow"><Sparkles size={13} aria-hidden="true" /> STUDENT TOOL</div>
          <h2 id="resume-assistant-title">Resume Assistant</h2>
          <p>Build a first draft from your skills and experience, then upload a resume for your applications.</p>
        </div>
        <span className="resume-assistant-mark"><FileText size={22} aria-hidden="true" /></span>
      </div>

      {!isStudent && (
        <div className="resume-signin-notice" role="status">
          <span>{user ? "This tool is for student accounts." : "Sign in with a student account to create or upload a resume."}</span>
          {!user && <button type="button" onClick={onRequestSignIn}>Sign in</button>}
        </div>
      )}

      <div className="resume-assistant-grid">
        <form className="resume-builder-form" onSubmit={handleGenerateResume}>
          {isStudent && !resumeAiEnabled && <p className="resume-feature-status">Resume AI is not configured yet. No generated content will be shown until the service is available.</p>}
          <label>What kind of role are you interested in?
            <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} maxLength={100} placeholder="e.g. Retail or summer internship" disabled={!isStudent || busy} />
          </label>
          <label>Skills
            <textarea value={skills} onChange={(event) => setSkills(event.target.value)} maxLength={1200} rows={3} placeholder="List skills you want to highlight" disabled={!isStudent || busy} />
          </label>
          <label>Experience, projects, or volunteering
            <textarea value={experience} onChange={(event) => setExperience(event.target.value)} maxLength={3000} rows={4} placeholder="Include school projects, clubs, volunteering, or paid work" disabled={!isStudent || busy} />
          </label>
          <label>Education or relevant coursework <span className="resume-optional">Optional</span>
            <textarea value={education} onChange={(event) => setEducation(event.target.value)} maxLength={1000} rows={2} placeholder="Share only what you want included" disabled={!isStudent || busy} />
          </label>
          <p className="resume-privacy-note">Don’t include your home address, birth date, phone number, or other sensitive details.</p>
          {isStudent && resumeAiEnabled && <label className="resume-ai-consent"><input type="checkbox" checked={aiConsent} disabled={busy} onChange={(event) => setAiConsent(event.target.checked)} /> I agree to send these resume details to the configured AI provider to create a draft.</label>}
          <button className="primary-button resume-generate-button" type="submit" disabled={!isStudent || !resumeAiEnabled || !aiConsent || busy || (!targetRole.trim() && !skills.trim() && !experience.trim() && !education.trim())}>
            <Sparkles size={16} aria-hidden="true" /> {busy ? "Working…" : "Create resume draft"}
          </button>
        </form>

        <div className="resume-output-panel">
          <div className="resume-output-heading"><strong>Resume draft</strong>{resumeText && <button type="button" onClick={handleDownloadDraft} disabled={busy}><Download size={15} /> Download</button>}</div>
          {resumeText ? (
            <textarea className="resume-output" aria-label="Generated resume draft" readOnly value={resumeText} />
          ) : (
            <div className="resume-output-empty"><FileText size={25} aria-hidden="true" /><p>Your draft will appear here after the resume assistant is configured.</p></div>
          )}
          {isStudent && !resumeUploadsEnabled && <p className="resume-feature-status">Private resume storage is not configured yet. Upload is disabled.</p>}
          <label className={`resume-upload-zone ${!isStudent || !resumeUploadsEnabled || busy ? "disabled" : ""}`} htmlFor="resume-file">
            <Upload size={17} aria-hidden="true" />
            <span>{selectedFile ? selectedFile.name : "Choose a PDF or DOCX to upload"}</span>
            <small>Maximum file size: 5 MB</small>
            <input ref={fileInputRef} id="resume-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={!isStudent || !resumeUploadsEnabled || busy} onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setFeedback(null); }} />
          </label>
          <button className="resume-upload-button" type="button" disabled={!isStudent || !resumeUploadsEnabled || !selectedFile || busy} onClick={handleUploadResume}>
            {busy ? "Please wait…" : "Upload resume"}
          </button>
          {feedback && <p className={`resume-feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.text}</p>}
        </div>
      </div>
    </section>
  );
}

export default StudentResumeAssistant;
