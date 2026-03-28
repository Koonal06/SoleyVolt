import {
  BadgeCheck,
  Clock3,
  FileSearch,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldX,
  UserRoundCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  approveAdminApplication,
  getAdminApplications,
  updateAdminApplicationStatus,
  type UserApplicationEvent,
  type UserApplicationRecord,
  type UserApplicationStatus,
} from "../../lib/server-api";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null) {
  return value ? dateFormatter.format(new Date(value)) : "Not reviewed yet";
}

function getStatusTone(status: UserApplicationStatus) {
  switch (status) {
    case "approved":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "rejected":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    case "under_review":
      return "border-amber-300/25 bg-amber-400/10 text-amber-100";
    default:
      return "border-white/15 bg-white/5 text-white/75";
  }
}

export function AdminApplicationsPage() {
  const [applications, setApplications] = useState<UserApplicationRecord[]>([]);
  const [events, setEvents] = useState<UserApplicationEvent[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserApplicationStatus>("all");
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadApplications = async (mode: "initial" | "refresh" = "refresh") => {
    try {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const snapshot = await getAdminApplications();
      setApplications(snapshot.applications);
      setEvents(snapshot.events);
      setSelectedApplicationId((current) =>
        current && snapshot.applications.some((application) => application.id === current)
          ? current
          : snapshot.applications[0]?.id ?? null,
      );
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load applications.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadApplications("initial");
  }, []);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesStatus = statusFilter === "all" || application.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        application.full_name.toLowerCase().includes(normalizedQuery) ||
        application.nic.toLowerCase().includes(normalizedQuery) ||
        application.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [applications, query, statusFilter]);

  const selectedApplication =
    applications.find((application) => application.id === selectedApplicationId) ??
    filteredApplications[0] ??
    null;

  const selectedEvents = useMemo(
    () =>
      selectedApplication
        ? events.filter((event) => event.application_id === selectedApplication.id)
        : [],
    [events, selectedApplication],
  );

  useEffect(() => {
    if (selectedApplication) {
      setRejectionReason(selectedApplication.rejection_reason ?? "");
    }
  }, [selectedApplication?.id]);

  const handleMarkUnderReview = async () => {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSaving(true);
      await updateAdminApplicationStatus(selectedApplication.id, {
        status: "under_review",
        notes: "Application moved into staff validation workflow.",
      });
      toast.success(`${selectedApplication.full_name} is now under review.`);
      await loadApplications("refresh");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to update application.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication) {
      return;
    }

    if (!rejectionReason.trim()) {
      toast.error("Add a rejection reason before rejecting this application.");
      return;
    }

    try {
      setIsSaving(true);
      await updateAdminApplicationStatus(selectedApplication.id, {
        status: "rejected",
        rejection_reason: rejectionReason.trim(),
      });
      toast.success(`${selectedApplication.full_name} was marked as rejected.`);
      await loadApplications("refresh");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to reject application.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApplication) {
      return;
    }

    try {
      setIsSaving(true);
      const result = await approveAdminApplication(selectedApplication.id, {
        preferred_language: selectedApplication.preferred_language,
        user_type: selectedApplication.requested_user_type,
        redirectTo: `${window.location.origin}/auth/reset`,
        sendPasswordSetupEmail: true,
      });

      toast.success(
        result.invitation.passwordSetupEmailSent
          ? `Approved ${selectedApplication.full_name} and sent the password setup email.`
          : `Approved ${selectedApplication.full_name}. Temporary password: ${result.invitation.temporaryPassword}`,
      );

      await loadApplications("refresh");
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Unable to approve application.");
    } finally {
      setIsSaving(false);
    }
  };

  const pendingCount = applications.filter((application) => application.status === "pending").length;
  const underReviewCount = applications.filter((application) => application.status === "under_review").length;
  const approvedCount = applications.filter((application) => application.status === "approved").length;
  const rejectedCount = applications.filter((application) => application.status === "rejected").length;

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Application review</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
          SoleyVolt now uses a controlled onboarding workflow. Visitors submit an application, staff validate the person,
          and only approved applicants are converted into active user accounts.
        </p>
      </section>

      {error ? <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Pending", value: pendingCount },
          { label: "Under review", value: underReviewCount },
          { label: "Approved", value: approvedCount },
          { label: "Rejected", value: rejectedCount },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">{item.label}</p>
            <p className="mt-4 text-4xl font-semibold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <label className="relative block w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, NIC, or email"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-11 py-3 text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | UserApplicationStatus)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
            >
              <option value="all" className="text-slate-950">All statuses</option>
              <option value="pending" className="text-slate-950">Pending</option>
              <option value="under_review" className="text-slate-950">Under review</option>
              <option value="approved" className="text-slate-950">Approved</option>
              <option value="rejected" className="text-slate-950">Rejected</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => void loadApplications("refresh")}
            disabled={isRefreshing}
            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "Refreshing..." : "Refresh applications"}
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-x-auto rounded-[1.7rem] border border-white/10 bg-black/10">
            <table className="w-full min-w-[940px]">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-white/42">
                  <th className="px-5 py-4">Applicant</th>
                  <th className="px-4 py-4">NIC</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4">Type</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length > 0 ? (
                  filteredApplications.map((application) => (
                    <tr
                      key={application.id}
                      onClick={() => setSelectedApplicationId(application.id)}
                      className={`cursor-pointer border-b border-white/6 text-sm last:border-b-0 ${
                        selectedApplication?.id === application.id ? "bg-white/8" : "hover:bg-white/5"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-white">{application.full_name}</p>
                          <p className="mt-1 text-xs text-white/38">{application.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/65">{application.nic}</td>
                      <td className="px-4 py-4 text-white/65">{application.email}</td>
                      <td className="px-4 py-4 capitalize text-white/65">{application.requested_user_type}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusTone(application.status)}`}>
                          {application.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/65">{formatDate(application.submitted_at)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-sm text-white/50">
                      {isLoading ? "Loading applications..." : "No applications match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-6">
            {selectedApplication ? (
              <>
                <div className="rounded-[1.7rem] border border-white/10 bg-black/10 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">Application details</p>
                      <h3 className="mt-3 text-xl font-semibold">{selectedApplication.full_name}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        Submitted {formatDate(selectedApplication.submitted_at)}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusTone(selectedApplication.status)}`}>
                      {selectedApplication.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-white/72">
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{selectedApplication.email}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{selectedApplication.phone}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <span>{selectedApplication.address}</span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">NIC</p>
                      <p className="mt-2 text-sm text-white">{selectedApplication.nic}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Requested role</p>
                      <p className="mt-2 text-sm capitalize text-white">{selectedApplication.requested_user_type}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Preferred language</p>
                      <p className="mt-2 text-sm uppercase text-white">{selectedApplication.preferred_language}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Linked profile</p>
                      <p className="mt-2 text-sm text-white">
                        {selectedApplication.linked_profile_email ?? "Not linked yet"}
                      </p>
                    </div>
                  </div>

                  {selectedApplication.notes ? (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">Applicant notes</p>
                      <p className="mt-3 text-sm leading-7 text-white/72">{selectedApplication.notes}</p>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/40">Rejection reason</p>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(event) => setRejectionReason(event.target.value)}
                      placeholder="Only required when rejecting an application"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isSaving || selectedApplication.status === "approved"}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserRoundCheck className="h-4 w-4" />
                      Approve and create account
                    </button>
                    <button
                      type="button"
                      onClick={handleMarkUnderReview}
                      disabled={isSaving || selectedApplication.status === "approved" || selectedApplication.status === "under_review"}
                      className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Clock3 className="h-4 w-4" />
                      Mark under review
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={isSaving || selectedApplication.status === "approved"}
                      className="inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldX className="h-4 w-4" />
                      Reject application
                    </button>
                  </div>
                </div>

                <div className="rounded-[1.7rem] border border-white/10 bg-black/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/45">Audit trail</p>
                      <h3 className="mt-3 text-lg font-semibold">Review and account events</h3>
                    </div>
                    <BadgeCheck className="h-5 w-5 text-emerald-300" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {selectedEvents.length > 0 ? (
                      selectedEvents.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium capitalize text-white">
                              {event.action.replace("_", " ")}
                            </p>
                            <p className="text-xs text-white/45">{formatDate(event.created_at)}</p>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/38">
                            {event.actor_name ?? event.actor_email ?? "System"}
                          </p>
                          <p className="mt-3 text-sm leading-7 text-white/72">
                            {event.notes ?? "No additional notes captured for this event."}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                        <FileSearch className="mx-auto mb-3 h-5 w-5 text-white/35" />
                        No audit events recorded for this application yet.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[1.7rem] border border-white/10 bg-black/10 px-5 py-12 text-center text-sm text-white/55">
                Select an application to review its details and audit history.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
