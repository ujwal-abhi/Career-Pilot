import { useEffect, useRef, useState } from "react";
import { Navbar } from "../components/Navbar";
import * as resumeService from "../services/resumeService";
import type { Resume } from "../types/resume.types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadResumes() {
    setIsLoading(true);
    resumeService
      .getResumes()
      .then((res) => setResumes(res.resumes))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadResumes();
  }, []);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      await resumeService.uploadResume(file);
      loadResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(resume: Resume) {
    const confirmed = window.confirm(`Delete "${resume.fileName}"?`);
    if (!confirmed) return;
    try {
      await resumeService.deleteResume(resume.id);
      loadResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function handleSetDefault(resume: Resume) {
    try {
      await resumeService.setDefaultResume(resume.id);
      loadResumes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update default resume.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Resumes</h1>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileSelected}
              className="hidden"
              id="resume-upload"
            />
            <label
              htmlFor="resume-upload"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium cursor-pointer inline-block"
            >
              {isUploading ? "Uploading..." : "+ Upload Resume"}
            </label>
          </div>
        </div>

        {error && (
          <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300 mb-4">
            {error}
          </div>
        )}

        {isLoading && <p className="text-slate-400">Loading resumes...</p>}

        {!isLoading && resumes.length === 0 && !error && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-slate-300 mb-1">No resumes yet.</p>
            <p className="text-slate-500 text-sm">Upload a PDF resume to get started.</p>
          </div>
        )}

        {!isLoading && resumes.length > 0 && (
          <ul className="space-y-2">
            {resumes.map((resume) => (
              <li key={resume.id} className="flex justify-between items-center bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{resume.fileName}</p>
                    {resume.isDefault && <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-slate-400">
                    {formatFileSize(resume.fileSize)} • Uploaded {new Date(resume.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!resume.isDefault && (
                    <button onClick={() => handleSetDefault(resume)} className="text-sm text-slate-400 hover:text-white">
                      Set as default
                    </button>
                  )}
                  <a href={resumeService.getDownloadUrl(resume.id)} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:text-blue-300">
                    Download
                  </a>
                  <button onClick={() => handleDelete(resume)} className="text-sm text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}