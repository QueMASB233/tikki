"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/lib/admin-context";
import {
  getDocuments,
  getMetrics,
  uploadDocument,
  updateDocument,
  reprocessDocument,
  Document,
  Metrics,
} from "@/lib/admin-api-client";
import {
  HiOutlineDocumentText,
  HiOutlineChartBar,
  HiOutlineUpload,
  HiOutlineFolder,
  HiOutlineBookOpen,
  HiOutlineGlobeAlt,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineRefresh,
  HiOutlineExclamationCircle,
  HiOutlineMinus,
  HiOutlineTrash,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineLogout,
  HiCheckCircle,
  HiX,
} from "react-icons/hi";
import { FiFile, FiFileText, FiEdit } from "react-icons/fi";
import { MdSchool, MdInbox } from "react-icons/md";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 18) return "Buenas tardes";
  return "Buenas noches";
}

// Colores pastel para las métricas
const PASTEL_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-green-100 text-green-700",
  "bg-yellow-100 text-yellow-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

const PASTEL_BG_COLORS = [
  "bg-blue-50",
  "bg-purple-50",
  "bg-pink-50",
  "bg-green-50",
  "bg-yellow-50",
  "bg-indigo-50",
  "bg-teal-50",
  "bg-orange-50",
];

const PASTEL_BAR_COLORS = [
  "bg-blue-300",
  "bg-purple-300",
  "bg-pink-300",
  "bg-green-300",
  "bg-yellow-300",
  "bg-indigo-300",
  "bg-teal-300",
  "bg-orange-300",
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { admin, logout, loading: authLoading } = useAdmin();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"documents" | "metrics">("documents");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !admin) {
      router.push("/admin/login");
    }
  }, [admin, authLoading, router]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsData, metricsData] = await Promise.all([
        getDocuments(),
        getMetrics(),
      ]);
      setDocuments(docsData);
      setMetrics(metricsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin, loadData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    const allowedExtensions = [".pdf", ".docx", ".txt"];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    ) {
      setMessage({ type: "error", text: "Solo se permiten archivos PDF, DOCX o TXT" });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      await uploadDocument(file);
      await loadData();
      setMessage({ type: "success", text: "Documento subido correctamente" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error("Error uploading:", error);
      setMessage({ 
        type: "error", 
        text: error?.response?.data?.detail || "Error al subir el documento" 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setUploading(false);
      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const handleStatusChange = async (docId: string, status: "active" | "inactive" | "deleted") => {
    setMessage(null);
    const previousDocuments = [...documents];
    
    if (status === "deleted") {
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      setMessage({ type: "success", text: "Documento eliminado" });
    } else {
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === docId ? { ...doc, status } : doc))
      );
      setMessage({ 
        type: "success", 
        text: `Documento ${status === "active" ? "activado" : "desactivado"}` 
      });
    }
    
    setTimeout(() => {
      updateDocument(docId, status)
        .then(() => {
          if (status !== "deleted") {
            loadData().catch(console.error);
          }
        })
        .catch((error: any) => {
          console.error("Error updating document:", error);
          setDocuments(previousDocuments);
          const errorMsg = error?.response?.data?.detail || error?.message || "Error al actualizar. Cambios revertidos.";
          setMessage({ type: "error", text: errorMsg });
          setTimeout(() => setMessage(null), 5000);
        });
    }, 0);
    
    setTimeout(() => {
      setMessage((current) => {
        if (current?.type === "success") {
          return null;
        }
        return current;
      });
    }, 3000);
  };

  const handleReprocess = async (docId: string) => {
    setMessage(null);
    try {
      await reprocessDocument(docId);
      await loadData();
      setMessage({ type: "success", text: "Documento encolado para reprocesamiento" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error("Error reprocessing:", error);
      setMessage({ 
        type: "error", 
        text: error?.response?.data?.detail || "Error al reprocesar el documento" 
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const getDisplayStatus = (doc: Document) => {
    // Si el procesamiento está completado pero el status sigue siendo processing, mostrar como completado
    if (doc.processing_status === "completed" && doc.status === "processing") {
      return {
        displayStatus: "completed",
        label: "Completado",
        color: "bg-emerald-100 text-emerald-700 border-emerald-200",
        icon: <HiOutlineCheckCircle className="h-3 w-3" />,
      };
    }
    // Si hay error en el procesamiento
    if (doc.processing_status === "error" || doc.status === "error") {
      return {
        displayStatus: "error",
        label: "Error",
        color: "bg-rose-100 text-rose-700 border-rose-200",
        icon: <HiOutlineExclamationCircle className="h-3 w-3" />,
      };
    }
    // Estado normal
    switch (doc.status) {
      case "active":
        return {
          displayStatus: "active",
          label: "Activo",
          color: "bg-emerald-100 text-emerald-700 border-emerald-200",
          icon: <HiOutlineCheckCircle className="h-3 w-3" />,
        };
      case "inactive":
        return {
          displayStatus: "inactive",
          label: "Inactivo",
          color: "bg-slate-100 text-slate-600 border-slate-200",
          icon: <HiOutlineMinus className="h-3 w-3" />,
        };
      case "processing":
        return {
          displayStatus: "processing",
          label: doc.processing_status === "queued" ? "En cola" : "Procesando",
          color: "bg-blue-100 text-blue-700 border-blue-200",
          icon: <HiOutlineRefresh className="h-3 w-3 animate-spin" />,
        };
      default:
        return {
          displayStatus: doc.status,
          label: doc.status,
          color: "bg-slate-100 text-slate-600 border-slate-200",
          icon: null,
        };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "inactive":
        return "bg-slate-100 text-slate-600 border-slate-200";
      case "processing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "error":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <HiOutlineRefresh className="mb-4 inline-block h-8 w-8 animate-spin text-brand-primary" />
          <p className="text-slate-600">Duendecitos poniendo todo en orden...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-x-hidden relative">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } fixed md:relative left-0 top-0 z-50 h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200/60 shadow-lg transition-all duration-300 ease-in-out ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo y toggle */}
          <div className="flex h-16 items-center justify-between border-b border-slate-200/60 px-4">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-primary to-blue-600">
                  <span className="text-sm font-bold text-white">ES</span>
                </div>
                <span className="text-sm font-semibold text-slate-800">Admin Portal</span>
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // En móvil, cerrar completamente el sidebar
                if (window.innerWidth < 768) {
                  setIsMobileSidebarOpen(false);
                } else {
                  // En desktop, colapsar/expandir
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {sidebarOpen ? (
                <HiChevronLeft className="h-5 w-5" />
              ) : (
                <HiChevronRight className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            <button
              onClick={() => {
                setActiveTab("documents");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                activeTab === "documents"
                  ? "bg-gradient-to-r from-brand-primary to-blue-600 text-white shadow-lg shadow-blue-500/30"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <HiOutlineDocumentText className="h-5 w-5" />
              {sidebarOpen && <span>Documentos</span>}
            </button>
            <button
              onClick={() => {
                setActiveTab("metrics");
                setIsMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all min-h-[44px] ${
                activeTab === "metrics"
                  ? "bg-gradient-to-r from-brand-primary to-blue-600 text-white shadow-lg shadow-blue-500/30"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <HiOutlineChartBar className="h-5 w-5" />
              {sidebarOpen && <span>Métricas</span>}
            </button>
          </nav>

          {/* User section */}
          <div className="border-t border-slate-200/60 p-4">
            <div className={`flex items-center gap-3 ${!sidebarOpen && "justify-center"}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white font-semibold">
                {(admin.full_name || admin.email)[0].toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {admin.full_name || admin.email.split("@")[0]}
                  </p>
                  <p className="truncate text-xs text-slate-500">{admin.email}</p>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <button
                onClick={logout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <HiOutlineLogout className="h-4 w-4" />
                Cerrar sesión
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? "md:ml-64" : "md:ml-20"} w-full relative`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => setIsMobileSidebarOpen(prev => !prev)}
                className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Abrir menú"
              >
                <HiChevronRight className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-800 truncate">
                  {getGreeting()}, {admin.full_name?.split(" ")[0] || admin.email.split("@")[0]}
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">¡Eleva te desea un hermoso día!</p>
              </div>
            </div>
            {!sidebarOpen && (
              <button
                onClick={logout}
                className="rounded-lg border border-slate-200 bg-white px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px] whitespace-nowrap"
              >
                Salir
              </button>
            )}
          </div>
        </header>

        {/* Mobile Sidebar Overlay - Solo cubre el contenido, no el header */}
        <div
          className={`
            absolute inset-0 top-16 bg-black/50 z-40 md:hidden
            transition-opacity duration-300 ease-in-out
            ${isMobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          `}
          onClick={() => setIsMobileSidebarOpen(false)}
        />

        {/* Content */}
        <main className="p-4 sm:p-6 max-w-full overflow-x-hidden relative z-30">
          {/* Message Banner */}
          {message && (
              <div
                className={`mb-6 rounded-2xl border p-4 shadow-lg backdrop-blur-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50/90 text-emerald-800"
                    : "border-rose-200 bg-rose-50/90 text-rose-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {message.type === "success" ? (
                      <HiOutlineCheckCircle className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <HiOutlineXCircle className="h-5 w-5 text-rose-600" />
                    )}
                    <span className="font-medium">{message.text}</span>
                  </div>
                  <button
                    onClick={() => setMessage(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-white/50 hover:text-slate-600 transition-colors"
                  >
                    <HiX className="h-5 w-5" />
                  </button>
                </div>
              </div>
          )}

          {activeTab === "documents" && (
            <div className="space-y-6">
              {/* Upload Card */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/60 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-blue-600 text-white">
                    <HiOutlineUpload className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Subir documento</h2>
                    <p className="text-xs text-slate-500">PDF, DOCX o TXT (máx. 50MB)</p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 sm:px-6 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all min-h-[44px]">
                  {uploading ? (
                    <HiOutlineRefresh className="h-5 w-5 animate-spin" />
                  ) : (
                    <HiOutlineFolder className="h-5 w-5" />
                  )}
                  <span>{uploading ? "Subiendo..." : "Seleccionar archivo"}</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Documents Table */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200/60 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-center gap-3">
                    <HiOutlineBookOpen className="h-5 w-5 text-slate-600" />
                    <h2 className="text-lg font-semibold text-slate-800">
                      Documentos ({documents.filter((d) => d.status !== "deleted").length})
                    </h2>
                  </div>
                </div>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="min-w-full divide-y divide-slate-200/60">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Archivo
                        </th>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Estado
                        </th>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 hidden sm:table-cell">
                          Procesamiento
                        </th>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 hidden md:table-cell">
                          Fecha
                        </th>
                        <th className="px-3 sm:px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 bg-white">
                      {documents.filter((doc) => doc.status !== "deleted").length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <MdInbox className="h-12 w-12 text-slate-300" />
                              <p className="text-sm text-slate-500">No hay documentos</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        documents
                          .filter((doc) => doc.status !== "deleted")
                          .map((doc) => (
                            <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="whitespace-nowrap px-3 sm:px-6 py-4">
                                <div className="flex items-center gap-3">
                                  {doc.filename.endsWith(".pdf") ? (
                                    <FiFile className="h-5 w-5 text-red-500" />
                                  ) : doc.filename.endsWith(".docx") ? (
                                    <FiFileText className="h-5 w-5 text-blue-500" />
                                  ) : (
                                    <FiEdit className="h-5 w-5 text-slate-500" />
                                  )}
                                  <span className="text-sm font-medium text-slate-800">{doc.filename}</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 sm:px-6 py-4">
                                {(() => {
                                  const statusInfo = getDisplayStatus(doc);
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 sm:px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                                    >
                                      {statusInfo.icon}
                                      {statusInfo.label}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="whitespace-nowrap px-3 sm:px-6 py-4 text-sm text-slate-600 hidden sm:table-cell">
                                {doc.processing_status || "-"}
                                {doc.processing_error && (
                                  <div className="mt-1 text-xs text-rose-600">{doc.processing_error}</div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 sm:px-6 py-4 text-sm text-slate-600 hidden md:table-cell">
                                {new Date(doc.created_at).toLocaleDateString("es-ES", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </td>
                              <td className="whitespace-nowrap px-3 sm:px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {doc.status !== "active" && doc.processing_status !== "completed" && (
                                    <div className="group relative">
                                      <button
                                        onClick={() => handleStatusChange(doc.id, "active")}
                                        className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                        aria-label="Activar documento"
                                      >
                                        <HiCheckCircle className="h-4 w-4" />
                                      </button>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg opacity-0 transition-opacity group-hover:block group-hover:opacity-100 z-50">
                                        Activar documento
                                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                      </div>
                                    </div>
                                  )}
                                  {doc.status === "active" && (
                                    <div className="group relative">
                                      <button
                                        onClick={() => handleStatusChange(doc.id, "inactive")}
                                        className="rounded-lg bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                        aria-label="Desactivar documento"
                                      >
                                        <HiOutlineMinus className="h-4 w-4" />
                                      </button>
                                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg opacity-0 transition-opacity group-hover:block group-hover:opacity-100 z-50">
                                        Desactivar documento
                                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="group relative">
                                    <button
                                      onClick={() => handleReprocess(doc.id)}
                                      className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                      aria-label="Reprocesar documento"
                                    >
                                      <HiOutlineRefresh className="h-4 w-4" />
                                    </button>
                                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg opacity-0 transition-opacity group-hover:block group-hover:opacity-100 z-50">
                                      Reprocesar documento
                                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  </div>
                                  <div className="group relative">
                                    <button
                                      onClick={() => handleStatusChange(doc.id, "deleted")}
                                      className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                      aria-label="Eliminar documento"
                                    >
                                      <HiOutlineTrash className="h-4 w-4" />
                                    </button>
                                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg opacity-0 transition-opacity group-hover:block group-hover:opacity-100 z-50">
                                      Eliminar documento
                                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "metrics" && metrics && (
            <div className="space-y-6">
              {/* Career Interest */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/60 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 text-white">
                    <MdSchool className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Carreras de Interés</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(metrics.career_interest)
                    .sort(([, a], [, b]) => b - a)
                    .map(([career, count], index) => {
                      const maxCount = Math.max(...Object.values(metrics.career_interest));
                      const percentage = (count / maxCount) * 100;
                      const colorIndex = index % PASTEL_COLORS.length;
                      return (
                        <div
                          key={career}
                          className={`rounded-xl ${PASTEL_BG_COLORS[colorIndex]} p-4 border border-white/50`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {career}
                            </span>
                            <span className={`text-lg font-bold ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {count}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                            <div
                              className={`h-full ${PASTEL_BAR_COLORS[colorIndex]} rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Study Type */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/60 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-white">
                    <HiOutlineBookOpen className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Tipos de Estudio</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(metrics.study_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([studyType, count], index) => {
                      const maxCount = Math.max(...Object.values(metrics.study_type));
                      const percentage = (count / maxCount) * 100;
                      const colorIndex = index % PASTEL_COLORS.length;
                      return (
                        <div
                          key={studyType}
                          className={`rounded-xl ${PASTEL_BG_COLORS[colorIndex]} p-4 border border-white/50`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {studyType}
                            </span>
                            <span className={`text-lg font-bold ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {count}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                            <div
                              className={`h-full ${PASTEL_BAR_COLORS[colorIndex]} rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Nationality */}
              <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200/60 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white">
                    <HiOutlineGlobeAlt className="h-6 w-6" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Nacionalidades</h2>
                </div>
                <div className="space-y-3">
                  {Object.entries(metrics.nationality)
                    .sort(([, a], [, b]) => b - a)
                    .map(([nationality, count], index) => {
                      const maxCount = Math.max(...Object.values(metrics.nationality));
                      const percentage = (count / maxCount) * 100;
                      const colorIndex = index % PASTEL_COLORS.length;
                      return (
                        <div
                          key={nationality}
                          className={`rounded-xl ${PASTEL_BG_COLORS[colorIndex]} p-4 border border-white/50`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {nationality}
                            </span>
                            <span className={`text-lg font-bold ${PASTEL_COLORS[colorIndex].split(" ")[1]}`}>
                              {count}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/60 overflow-hidden">
                            <div
                              className={`h-full ${PASTEL_BAR_COLORS[colorIndex]} rounded-full transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
