// pages/admin/dashboard.js
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { getTokenFromRequest, verifyAdminToken } from "@/lib/auth";

const STATUS_COLORS = {
  pending:     { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  confirmed:   { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  cancelled:   { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  rescheduled: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
};

const STATUS_LABELS = {
  pending:     "⏳ Pending",
  confirmed:   "✅ Confirmed",
  cancelled:   "❌ Cancelled",
  rescheduled: "🔄 Rescheduled",
};

export default function AdminDashboard({ adminEmail: initialEmail }) {
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminEmail, setAdminEmail] = useState(initialEmail || "");

  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [adminNote, setAdminNote] = useState("");

  // Delete confirm modal
  const [deleteModal, setDeleteModal] = useState(null);

  // Confirm session on mount (lightweight re-validation; redirect if cookie gone)
  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authenticated) router.replace("/admin");
        else if (!adminEmail) setAdminEmail(data.email);
      })
      .catch(() => router.replace("/admin"));
  }, [router, adminEmail]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filter === "all"
          ? "/api/appointments"
          : `/api/appointments?status=${filter}`;
      const res = await fetch(url);
      if (res.status === 401) { router.replace("/admin"); return; }
      const data = await res.json();
      setAppointments(data.data || []);
    } catch {
      showToast("Failed to load appointments", "error");
    } finally {
      setLoading(false);
    }
  }, [filter, router]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleAction(id, status, extra = {}) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, "success");
      fetchAppointments();
    } catch (err) {
      showToast(err.message || "Action failed", "error");
    } finally {
      setActionLoading(null);
      setRescheduleModal(null);
    }
  }

  async function handleRescheduleSubmit() {
    if (!rescheduleDate || !rescheduleTime) {
      showToast("Please select both date and time", "error");
      return;
    }
    await handleAction(rescheduleModal.id, "rescheduled", {
      reschedule_date: rescheduleDate,
      reschedule_time: rescheduleTime,
      admin_note: adminNote,
    });
  }

  async function handleDelete(id) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(data.message, "success");
      fetchAppointments();
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    } finally {
      setActionLoading(null);
      setDeleteModal(null);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin");
  }

  // --- Sort + filter logic ---
  const today = new Date().toISOString().split("T")[0];
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  let filtered = filter === "all" ? [...appointments] : appointments.filter((a) => a.status === filter);

  if (sortOrder === "today") {
    filtered = filtered.filter((a) => a.preferred_date === today);
  } else if (sortOrder === "week") {
    filtered = filtered.filter((a) => a.preferred_date >= oneWeekAgo);
  } else if (sortOrder === "oldest") {
    filtered = filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else {
    filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard – Noah Animal Clinic</title>
        <meta name="robots" content="noindex,nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #1e293b; }
        .topbar { background: #0f766e; color: #fff; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
        .topbar-logo { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .topbar-right { display: flex; align-items: center; gap: 16px; font-size: 13px; }
        .logout-btn { background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3); color: #fff; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; transition: background .2s; }
        .logout-btn:hover { background: rgba(255,255,255,.25); }
        .container { max-width: 1200px; margin: 0 auto; padding: 28px 20px; }
        .page-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .page-sub { font-size: 14px; color: #64748b; margin-bottom: 24px; }
        .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
        .stat-num { font-size: 28px; font-weight: 700; color: #0f766e; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .filter-btn { padding: 7px 16px; border-radius: 20px; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .2s; }
        .filter-btn:hover { border-color: #0f766e; color: #0f766e; }
        .filter-btn.active { background: #0f766e; color: #fff; border-color: #0f766e; }
        .table-wrap { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: #64748b; border-bottom: 1px solid #e2e8f0; }
        td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; vertical-align: top; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f8fafc; }
        .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; border: 1px solid; white-space: nowrap; }
        .owner-name { font-weight: 600; color: #0f172a; }
        .owner-phone { font-size: 12px; color: #64748b; margin-top: 2px; }
        .pet-info { color: #334155; }
        .pet-type { font-size: 12px; color: #64748b; }
        .date-cell { font-size: 13px; }
        .time-cell { font-size: 12px; color: #64748b; }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        .action-btn { padding: 5px 12px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .2s; white-space: nowrap; }
        .btn-accept  { background: #dcfce7; color: #15803d; }
        .btn-accept:hover  { background: #bbf7d0; }
        .btn-reject  { background: #fee2e2; color: #b91c1c; }
        .btn-reject:hover  { background: #fecaca; }
        .btn-reschedule { background: #dbeafe; color: #1d4ed8; }
        .btn-reschedule:hover { background: #bfdbfe; }
        .btn-delete { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .btn-delete:hover { background: #fee2e2; }
        .btn-disabled { opacity: .45; cursor: not-allowed; }
        .empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
        .empty-icon { font-size: 48px; margin-bottom: 12px; }
        .loading-cell { text-align: center; padding: 60px; color: #94a3b8; }
        .sort-select { padding: 7px 14px; border-radius: 8px; border: 1.5px solid #e2e8f0; background: #fff; color: #475569; font-size: 13px; font-weight: 500; cursor: pointer; outline: none; transition: border .2s; }
        .sort-select:focus { border-color: #0f766e; }
        .filter-sort-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .btn-delete-confirm { padding: 9px 18px; background: #dc2626; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-delete-confirm:hover { background: #b91c1c; }

        /* Reschedule Modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal { background: #fff; border-radius: 16px; padding: 28px; width: 100%; max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
        .modal h3 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
        .modal p { font-size: 13px; color: #64748b; margin-bottom: 20px; }
        .form-group { margin-bottom: 14px; }
        .form-group label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 5px; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 9px 12px; border: 1.5px solid #d1d5db; border-radius: 8px; font-size: 14px; outline: none; transition: border .2s; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #0f766e; }
        .form-group textarea { height: 72px; resize: vertical; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
        .btn-cancel-modal { padding: 9px 18px; border: 1.5px solid #d1d5db; background: #fff; border-radius: 8px; font-size: 13px; cursor: pointer; }
        .btn-confirm-modal { padding: 9px 18px; background: #0f766e; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-confirm-modal:hover { background: #0d6561; }

        /* Toast */
        .toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 18px; border-radius: 10px; font-size: 13.5px; font-weight: 500; z-index: 9999; box-shadow: 0 4px 20px rgba(0,0,0,.15); animation: slideUp .3s ease; }
        .toast.success { background: #0f766e; color: #fff; }
        .toast.error { background: #dc2626; color: #fff; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (max-width: 768px) {
          .stats-row { grid-template-columns: repeat(2, 1fr); }
          .topbar-right .admin-email { display: none; }
          
          /* Card-based responsive table */
          table, thead, tbody, th, td, tr { display: block; }
          thead tr { display: none; }
          .table-wrap { background: transparent; border: none; box-shadow: none; }
          tr { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); background: #fff; }
          td { border-bottom: 1px solid #f1f5f9; padding: 10px 0 10px 110px; position: relative; min-height: 44px; font-size: 14px; }
          td::before { content: attr(data-label); position: absolute; left: 0; top: 10px; width: 100px; font-weight: 600; font-size: 11px; text-transform: uppercase; color: #64748b; }
          td:last-child { border-bottom: none; padding-bottom: 0; }
          .actions { justify-content: flex-start; margin-top: 4px; }
          .filter-sort-row { flex-direction: column; align-items: flex-start; }
          .filter-sort-row > div { width: 100%; display: flex; flex-wrap: wrap; justify-content: space-between; margin-top: 10px; }
        }
      `}</style>

      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar-logo">🐾 Noah Animal Clinic</div>
        <div className="topbar-right">
          <span className="admin-email" style={{ opacity: .8 }}>{adminEmail}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="container">
        <h1 className="page-title">Doctor Dashboard</h1>
        <p className="page-sub">Manage all appointment requests and send email notifications</p>

        {/* Stats Row */}
        <div className="stats-row">
          {[
            { key: "all", label: "Total" },
            { key: "pending", label: "Pending" },
            { key: "confirmed", label: "Confirmed" },
            { key: "cancelled", label: "Cancelled" },
            { key: "rescheduled", label: "Rescheduled" },
          ].map(({ key, label }) => (
            <div className="stat-card" key={key}>
              <div className="stat-num">{loading ? "–" : (key === "all" ? appointments.length : appointments.filter(a => a.status === key).length)}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Sort */}
        <div className="filter-sort-row">
          {["all", "pending", "confirmed", "cancelled", "rescheduled"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {STATUS_LABELS[f] || "All"} {f === "all" ? `(${appointments.length})` : `(${appointments.filter(a=>a.status===f).length})`}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <select
              className="sort-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">🕐 Newest First</option>
              <option value="oldest">🕐 Oldest First</option>
              <option value="today">📅 Today Only</option>
              <option value="week">📅 This Week</option>
            </select>
            <button className="filter-btn" onClick={fetchAppointments}>🔄 Refresh</button>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Contact</th>
                <th>Pet</th>
                <th>Service</th>
                <th>Requested Slot</th>
                <th>Requested At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="loading-cell">⏳ Loading appointments...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <div className="empty-icon">🐾</div>
                      <div>No {filter !== "all" ? filter : ""} appointments found</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((apt, index) => {
                  const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.pending;
                  const isLoading = actionLoading === apt.id;
                  // Only truly cancelled appointments are terminal; confirmed can still be cancelled or rescheduled
                  const isTerminal = apt.status === "cancelled";
                  return (
                    <tr key={apt.id}>
                      <td data-label="Patient">
                        <div className="owner-name">
                          <span style={{ color: "#334155", marginRight: "6px", fontWeight: 600 }}>#{apt.id.substring(0, 6).toUpperCase()}</span>
                          {apt.owner_name}
                        </div>
                        {apt.notes && (
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={apt.notes}>
                            💬 {apt.notes}
                          </div>
                        )}
                      </td>
                      <td data-label="Contact">
                        <div className="owner-phone">📞 {apt.phone}</div>
                        {apt.owner_email ? (
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>✉️ {apt.owner_email}</div>
                        ) : (
                          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3 }}>No email</div>
                        )}
                      </td>
                      <td data-label="Pet">
                        <div className="pet-info">{apt.pet_name || "—"}</div>
                        <div className="pet-type">{apt.pet_type}</div>
                      </td>
                      <td data-label="Service" style={{ maxWidth: 160 }}>{apt.service}</td>
                      <td data-label="Requested Slot">
                        <div className="date-cell">{apt.preferred_date}</div>
                        <div className="time-cell">{apt.preferred_time}</div>
                        {apt.status === "rescheduled" && apt.reschedule_date && (
                          <div style={{ fontSize: 11, color: "#1d4ed8", marginTop: 4 }}>
                            🔄 {apt.reschedule_date} {apt.reschedule_time}
                          </div>
                        )}
                      </td>
                      <td data-label="Requested At">
                        <div className="date-cell">{apt.created_at ? new Date(apt.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</div>
                        <div className="time-cell">{apt.created_at ? new Date(apt.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}</div>
                      </td>
                      <td data-label="Status">
                        <span
                          className="badge"
                          style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
                        >
                          {STATUS_LABELS[apt.status]}
                        </span>
                      </td>
                      <td data-label="Actions">
                        <div className="actions">
                          {isTerminal ? (
                            <span style={{ fontSize: 12, color: "#94a3b8" }}>No further action</span>
                          ) : (
                            <>
                              <button
                                className={`action-btn btn-accept ${isLoading || apt.status === "confirmed" ? "btn-disabled" : ""}`}
                                disabled={isLoading || apt.status === "confirmed"}
                                onClick={() => handleAction(apt.id, "confirmed")}
                              >
                                {isLoading ? "…" : "✅ Accept"}
                              </button>
                              <button
                                className={`action-btn btn-reject ${isLoading ? "btn-disabled" : ""}`}
                                disabled={isLoading}
                                onClick={() => handleAction(apt.id, "cancelled", { admin_note: "Doctor unavailable" })}
                              >
                                {isLoading ? "…" : "❌ Reject"}
                              </button>
                              <button
                                className={`action-btn btn-reschedule ${isLoading ? "btn-disabled" : ""}`}
                                disabled={isLoading}
                                onClick={() => {
                                  setRescheduleModal(apt);
                                  setRescheduleDate(apt.preferred_date);
                                  setRescheduleTime(apt.preferred_time);
                                  setAdminNote("");
                                }}
                              >
                                🔄 Reschedule
                              </button>
                            </>
                          )}
                          <button
                            className={`action-btn btn-delete ${isLoading ? "btn-disabled" : ""}`}
                            disabled={isLoading}
                            onClick={() => setDeleteModal(apt)}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="modal-overlay" onClick={() => setRescheduleModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🔄 Propose New Time</h3>
            <p>
              For <strong>{rescheduleModal.owner_name}</strong> ({rescheduleModal.pet_type})
              — current: {rescheduleModal.preferred_date} {rescheduleModal.preferred_time}
            </p>
            <div className="form-group">
              <label>New Date *</label>
              <input
                type="date"
                value={rescheduleDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>New Time *</label>
              <select value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)}>
                <option value="">Select time slot</option>
                {["9:00 AM – 11:00 AM","11:00 AM – 1:00 PM","2:00 PM – 4:00 PM","4:00 PM – 6:00 PM","6:00 PM – 9:00 PM"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Note for Patient (optional)</label>
              <textarea
                placeholder="e.g. Doctor available only after 3pm on this day..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel-modal" onClick={() => setRescheduleModal(null)}>
                Cancel
              </button>
              <button
                className="btn-confirm-modal"
                onClick={handleRescheduleSubmit}
                disabled={actionLoading === rescheduleModal.id}
              >
                {actionLoading === rescheduleModal.id ? "Sending…" : "Save & Notify"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>🗑️ Delete Record</h3>
            <p>
              Are you sure you want to permanently delete the appointment for{" "}
              <strong>{deleteModal.owner_name}</strong> ({deleteModal.pet_type})?<br />
              <span style={{ color: "#dc2626", fontWeight: 600 }}>This action cannot be undone.</span>
            </p>
            <div className="modal-actions">
              <button className="btn-cancel-modal" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button
                className="btn-delete-confirm"
                onClick={() => handleDelete(deleteModal.id)}
                disabled={actionLoading === deleteModal.id}
              >
                {actionLoading === deleteModal.id ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}
    </>
  );
}

// Server-side auth guard: redirect to login if session cookie is missing or invalid
export async function getServerSideProps(context) {
  const token = getTokenFromRequest(context.req);
  const payload = token ? await verifyAdminToken(token) : null;

  if (!payload) {
    return {
      redirect: {
        destination: "/admin",
        permanent: false,
      },
    };
  }

  return {
    props: {
      adminEmail: payload.email,
    },
  };
}
