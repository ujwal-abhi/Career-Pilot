import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { KanbanColumn } from "../components/KanbanColumn";
import { ApplicationFormModal } from "../components/ApplicationFormModal";
import * as applicationService from "../services/applicationService";
import { APPLICATION_STATUSES } from "../types/application.types";
import type { Application, ApplicationInput } from "../types/application.types";

export function Applications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApplication, setEditingApplication] = useState<Application | undefined>(undefined);

  function loadApplications() {
    setIsLoading(true);
    applicationService
      .getApplications()
      .then((res) => setApplications(res.applications))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadApplications();
  }, []);

  function openAddModal() {
    setEditingApplication(undefined);
    setIsModalOpen(true);
  }

  function openEditModal(application: Application) {
    setEditingApplication(application);
    setIsModalOpen(true);
  }

  async function handleSubmit(input: ApplicationInput) {
    if (editingApplication) {
      await applicationService.updateApplication(editingApplication.id, input);
    } else {
      await applicationService.createApplication(input);
    }
    setIsModalOpen(false);
    loadApplications();
  }

  async function handleDelete() {
    if (!editingApplication) return;
    const confirmed = window.confirm(
      `Delete the application for ${editingApplication.position} at ${editingApplication.company}?`
    );
    if (!confirmed) return;
    await applicationService.deleteApplication(editingApplication.id);
    setIsModalOpen(false);
    loadApplications();
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navbar />
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Applications</h1>
          <button
            onClick={openAddModal}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium"
          >
            + Add Application
          </button>
        </div>

        {isLoading && <p className="text-slate-400">Loading applications...</p>}
        {error && (
          <div className="rounded bg-red-900/30 border border-red-700 p-4 text-red-300">
            {error}
          </div>
        )}

        {!isLoading && !error && applications.length === 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800 p-8 text-center">
            <p className="text-slate-300 mb-1">No applications yet.</p>
            <p className="text-slate-500 text-sm mb-4">Start tracking your first job application.</p>
            <button
              onClick={openAddModal}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium"
            >
              Add Application
            </button>
          </div>
        )}

        {!isLoading && !error && applications.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {APPLICATION_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                applications={applications.filter((app) => app.status === status)}
                onCardClick={openEditModal}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ApplicationFormModal
          initialData={editingApplication}
          onSubmit={handleSubmit}
          onClose={() => setIsModalOpen(false)}
          onDelete={editingApplication ? handleDelete : undefined}
        />
      )}
    </div>
  );
}