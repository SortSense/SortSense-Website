"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  Layers,
  Loader2,
  MapPin,
  MoveRight,
  Plus,
  RefreshCw,
  Trash2,
  X,
  AlertCircle,
} from "lucide-react";

interface WasteCategory {
  category_id: string;
  category_name: string;
  color_hex: string;
}

interface AdminBin {
  bin_id: string | null;
  area_id?: string | null;
  category_id: string;
  category_name?: string;
  capacity_liters: number;
  is_active: boolean;
  fill_percentage?: number | null;
  operational_status?: string | null;
}

interface AdminDisposalArea {
  area_id: string | null;
  area_name: string;
  description: string | null;
  is_active: boolean;
  bins: AdminBin[];
}

interface AdminFloor {
  floor_id: string | null;
  floor_name: string;
  floor_order: number;
  is_active: boolean;
  disposal_areas: AdminDisposalArea[];
}

interface AdminStation {
  station_uuid: string;
  station_code: string;
  station_name: string;
  is_active: boolean;
  location_id: string | null;
  location_name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  floors: AdminFloor[];
  bins: AdminBin[];
}

interface FormBin {
  clientKey: string;
  bin_id: string | null;
  category_id: string;
  capacity_liters: string;
  is_active: boolean;
  fill_percentage?: number | null;
  operational_status?: string | null;
}

interface FormArea {
  clientKey: string;
  area_id: string | null;
  area_name: string;
  description: string;
  is_active: boolean;
  bins: FormBin[];
}

interface FormFloor {
  clientKey: string;
  floor_id: string | null;
  floor_name: string;
  floor_order: string;
  is_active: boolean;
  disposal_areas: FormArea[];
}

interface StationFormState {
  station_code: string;
  station_name: string;
  location_name: string;
  description: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
  floors: FormFloor[];
}

let keyCounter = 0;
function nextKey(prefix: string): string {
  keyCounter += 1;
  return `${prefix}-${Date.now()}-${keyCounter}`;
}

function makeDefaultForm(categories: WasteCategory[]): StationFormState {
  const defaultCat = categories[0]?.category_id ?? "";
  return {
    station_code: "",
    station_name: "",
    location_name: "",
    description: "",
    latitude: "",
    longitude: "",
    is_active: true,
    floors: [
      {
        clientKey: nextKey("floor"),
        floor_id: null,
        floor_name: "1F",
        floor_order: "1",
        is_active: true,
        disposal_areas: [
          {
            clientKey: nextKey("area"),
            area_id: null,
            area_name: "Main Entrance",
            description: "",
            is_active: true,
            bins: defaultCat
              ? [
                {
                  clientKey: nextKey("bin"),
                  bin_id: null,
                  category_id: defaultCat,
                  capacity_liters: "60",
                  is_active: true,
                },
              ]
              : [],
          },
        ],
      },
    ],
  };
}

function stationToForm(station: AdminStation): StationFormState {
  return {
    station_code: station.station_code,
    station_name: station.station_name,
    location_name: station.location_name || "",
    description: station.description || "",
    latitude: station.latitude !== null && station.latitude !== undefined ? String(station.latitude) : "",
    longitude: station.longitude !== null && station.longitude !== undefined ? String(station.longitude) : "",
    is_active: station.is_active,
    floors: (station.floors || []).map((f, fIdx) => ({
      clientKey: f.floor_id || nextKey(`floor-${fIdx}`),
      floor_id: f.floor_id,
      floor_name: f.floor_name,
      floor_order: String(f.floor_order ?? fIdx),
      is_active: f.is_active,
      disposal_areas: (f.disposal_areas || []).map((a, aIdx) => ({
        clientKey: a.area_id || nextKey(`area-${aIdx}`),
        area_id: a.area_id,
        area_name: a.area_name,
        description: a.description || "",
        is_active: a.is_active,
        bins: (a.bins || []).map((b, bIdx) => ({
          clientKey: b.bin_id || nextKey(`bin-${bIdx}`),
          bin_id: b.bin_id,
          category_id: b.category_id,
          capacity_liters: String(b.capacity_liters ?? 60),
          is_active: b.is_active,
          fill_percentage: b.fill_percentage,
          operational_status: b.operational_status,
        })),
      })),
    })),
  };
}

interface StationManagementProps {
  onDashboardRefresh?: () => Promise<void> | void;
}

export function StationManagement({ onDashboardRefresh }: StationManagementProps = {}) {
  const [stations, setStations] = useState<AdminStation[]>([]);
  const [categories, setCategories] = useState<WasteCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<StationFormState>(() => makeDefaultForm([]));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [collapsedFloors, setCollapsedFloors] = useState<Record<string, boolean>>({});

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  }, []);

  const loadData = useCallback(async () => {
    const authHeaders = await getAuthHeaders();
    const [stationsRes, catsRes] = await Promise.all([
      fetch("/api/admin/stations", {
        cache: "no-store",
        headers: authHeaders,
      }),
      fetch("/api/waste-categories", {
        cache: "no-store",
        headers: authHeaders,
      }),
    ]);

    if (!stationsRes.ok) {
      const body = await stationsRes.json().catch(() => ({}));
      throw new Error(body.detail || `Failed to load stations (${stationsRes.status})`);
    }
    const stationsData = await stationsRes.json();
    const catsData = catsRes.ok ? await catsRes.json() : { categories: [] };

    setStations(stationsData.stations || []);
    setCategories(catsData.categories || []);
  }, [getAuthHeaders]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadData();
        if (active) setError(null);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load station registry");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadData]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh stations");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditingCode(null);
    setForm(makeDefaultForm(categories));
    setFormError(null);
    setCollapsedFloors({});
  };

  const openEditModal = (station: AdminStation) => {
    setModalMode("edit");
    setEditingCode(station.station_code);
    setForm(stationToForm(station));
    setFormError(null);
    setCollapsedFloors({});
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setEditingCode(null);
    setFormError(null);
  };

  const areaOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string }> = [];
    for (const fl of form.floors) {
      for (const ar of fl.disposal_areas) {
        opts.push({
          key: ar.clientKey,
          label: `${fl.floor_name || "Unnamed Floor"} → ${ar.area_name || "Unnamed Area"}`,
        });
      }
    }
    return opts;
  }, [form.floors]);

  const toggleFloorCollapse = (floorKey: string) => {
    setCollapsedFloors((prev) => ({ ...prev, [floorKey]: !prev[floorKey] }));
  };

  const addFloor = () => {
    const nextOrder = form.floors.length + 1;
    setForm((prev) => ({
      ...prev,
      floors: [
        ...prev.floors,
        {
          clientKey: nextKey("floor"),
          floor_id: null,
          floor_name: `${nextOrder}F`,
          floor_order: String(nextOrder),
          is_active: true,
          disposal_areas: [],
        },
      ],
    }));
  };

  const removeUnsavedFloor = (floorKey: string) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.filter((f) => f.clientKey !== floorKey),
    }));
  };

  const updateFloorField = (
    floorKey: string,
    field: "floor_name" | "floor_order" | "is_active",
    value: string | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey ? { ...f, [field]: value } : f
      ),
    }));
  };

  const addArea = (floorKey: string) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: [
              ...f.disposal_areas,
              {
                clientKey: nextKey("area"),
                area_id: null,
                area_name: "",
                description: "",
                is_active: true,
                bins: [],
              },
            ],
          }
          : f
      ),
    }));
  };

  const removeUnsavedArea = (floorKey: string, areaKey: string) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: f.disposal_areas.filter((a) => a.clientKey !== areaKey),
          }
          : f
      ),
    }));
  };

  const updateAreaField = (
    floorKey: string,
    areaKey: string,
    field: "area_name" | "description" | "is_active",
    value: string | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: f.disposal_areas.map((a) =>
              a.clientKey === areaKey ? { ...a, [field]: value } : a
            ),
          }
          : f
      ),
    }));
  };

  const addBin = (floorKey: string, areaKey: string) => {
    const defaultCat = categories[0]?.category_id ?? "";
    if (!defaultCat) {
      setFormError("No waste categories loaded from database.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: f.disposal_areas.map((a) =>
              a.clientKey === areaKey
                ? {
                  ...a,
                  bins: [
                    ...a.bins,
                    {
                      clientKey: nextKey("bin"),
                      bin_id: null,
                      category_id: defaultCat,
                      capacity_liters: "60",
                      is_active: true,
                    },
                  ],
                }
                : a
            ),
          }
          : f
      ),
    }));
  };

  const removeUnsavedBin = (floorKey: string, areaKey: string, binKey: string) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: f.disposal_areas.map((a) =>
              a.clientKey === areaKey
                ? { ...a, bins: a.bins.filter((b) => b.clientKey !== binKey) }
                : a
            ),
          }
          : f
      ),
    }));
  };

  const updateBinField = (
    floorKey: string,
    areaKey: string,
    binKey: string,
    field: "category_id" | "capacity_liters" | "is_active",
    value: string | boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f) =>
        f.clientKey === floorKey
          ? {
            ...f,
            disposal_areas: f.disposal_areas.map((a) =>
              a.clientKey === areaKey
                ? {
                  ...a,
                  bins: a.bins.map((b) =>
                    b.clientKey === binKey ? { ...b, [field]: value } : b
                  ),
                }
                : a
            ),
          }
          : f
      ),
    }));
  };

  const moveBinToArea = (
    sourceFloorKey: string,
    sourceAreaKey: string,
    binKey: string,
    targetAreaKey: string
  ) => {
    if (sourceAreaKey === targetAreaKey) return;
    setForm((prev) => {
      let movedBin: FormBin | null = null;
      const stripped = prev.floors.map((f) => {
        if (f.clientKey !== sourceFloorKey) return f;
        return {
          ...f,
          disposal_areas: f.disposal_areas.map((a) => {
            if (a.clientKey !== sourceAreaKey) return a;
            const found = a.bins.find((b) => b.clientKey === binKey);
            if (found) movedBin = found;
            return { ...a, bins: a.bins.filter((b) => b.clientKey !== binKey) };
          }),
        };
      });
      if (!movedBin) return prev;
      const binToInsert = movedBin;
      return {
        ...prev,
        floors: stripped.map((f) => ({
          ...f,
          disposal_areas: f.disposal_areas.map((a) =>
            a.clientKey === targetAreaKey
              ? { ...a, bins: [...a.bins, binToInsert] }
              : a
          ),
        })),
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = form.station_code.trim();
    const name = form.station_name.trim();
    const locName = form.location_name.trim();

    if (modalMode === "create" && !code) {
      setFormError("Station code is required.");
      return;
    }
    if (!name || !locName) {
      setFormError("Station name and location name are required.");
      return;
    }

    const latStr = form.latitude.trim();
    const lngStr = form.longitude.trim();
    const latitude = latStr ? Number(latStr) : null;
    const longitude = lngStr ? Number(lngStr) : null;
    if ((latStr && Number.isNaN(latitude)) || (lngStr && Number.isNaN(longitude))) {
      setFormError("Latitude and longitude must be valid numbers.");
      return;
    }

    for (const fl of form.floors) {
      if (!fl.floor_name.trim()) {
        setFormError("Every floor must have a name.");
        return;
      }
      for (const ar of fl.disposal_areas) {
        if (!ar.area_name.trim()) {
          setFormError(`Every disposal area on floor "${fl.floor_name}" must have a name.`);
          return;
        }
        for (const bn of ar.bins) {
          if (!bn.category_id) {
            setFormError(`Every bin in "${ar.area_name}" must have a category.`);
            return;
          }
          const cap = Number(bn.capacity_liters);
          if (!cap || Number.isNaN(cap) || cap <= 0) {
            setFormError(`Bin capacity in "${ar.area_name}" must be greater than 0.`);
            return;
          }
        }
      }
    }

    const floorsPayload = form.floors.map((fl, idx) => ({
      ...(fl.floor_id ? { floor_id: fl.floor_id } : {}),
      floor_name: fl.floor_name.trim(),
      floor_order: Number.isFinite(Number(fl.floor_order)) ? Number(fl.floor_order) : idx,
      is_active: fl.is_active,
      disposal_areas: fl.disposal_areas.map((ar) => ({
        ...(ar.area_id ? { area_id: ar.area_id } : {}),
        area_name: ar.area_name.trim(),
        description: ar.description.trim() || null,
        is_active: ar.is_active,
        bins: ar.bins.map((bn) => ({
          ...(bn.bin_id ? { bin_id: bn.bin_id } : {}),
          category_id: bn.category_id,
          capacity_liters: Number(bn.capacity_liters),
          is_active: bn.is_active,
        })),
      })),
    }));

    setSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const url =
        modalMode === "create"
          ? "/api/admin/stations"
          : `/api/admin/stations/${encodeURIComponent(editingCode || code)}`;
      const method = modalMode === "create" ? "POST" : "PATCH";

      const payload =
        modalMode === "create"
          ? {
            station_code: code,
            station_name: name,
            location_name: locName,
            description: form.description.trim() || null,
            latitude,
            longitude,
            is_active: form.is_active,
            floors: floorsPayload,
          }
          : {
            station_name: name,
            location_name: locName,
            description: form.description.trim() || null,
            latitude,
            longitude,
            is_active: form.is_active,
            floors: floorsPayload,
          };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.detail || `Request failed (${res.status})`);
      }

      await loadData();
      if (onDashboardRefresh) {
        await onDashboardRefresh();
      }
      setSuccessMsg(
        modalMode === "create"
          ? `Created station ${code} with ${floorsPayload.length} floor(s).`
          : `Updated station ${editingCode}.`
      );
      setModalMode(null);
      setEditingCode(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save station");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#111827] font-[family-name:var(--font-manrope)]">
            Station &amp; Hierarchy Registry
          </h2>
          <p className="text-sm text-[#4B5563]">
            Manage stations, floors, disposal areas, and individual bins.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#176B45] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125637] transition shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Station
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 text-sm text-[#166534]">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-[#166534] hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Registry Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
        {loading && stations.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin text-[#176B45]" />
            Loading station hierarchy...
          </div>
        ) : stations.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#6B7280]">
            No stations registered yet. Click <strong>New Station</strong> to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E7EB] bg-[#F7F8F4] text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                <tr>
                  <th className="px-5 py-3.5">Station</th>
                  <th className="px-5 py-3.5">Location &amp; GPS</th>
                  <th className="px-5 py-3.5">Hierarchy</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {stations.map((st) => {
                  const floors = st.floors || [];
                  const areas = floors.flatMap((f) => f.disposal_areas || []);
                  const totalBins = areas.reduce(
                    (sum, a) => sum + (a.bins?.length || 0),
                    0
                  );
                  return (
                    <tr key={st.station_uuid} className="hover:bg-[#F9FAFB]/60">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#111827]">
                          {st.station_name}
                        </div>
                        <div className="text-xs font-mono text-[#6B7280]">
                          {st.station_code}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-[#374151]">
                          <MapPin className="h-3.5 w-3.5 text-[#38A6A0] shrink-0" />
                          <span>{st.location_name || "Unset"}</span>
                        </div>
                        <div className="text-xs text-[#6B7280] mt-0.5">
                          {st.latitude !== null && st.longitude !== null
                            ? `${st.latitude.toFixed(5)}, ${st.longitude.toFixed(5)}`
                            : "No GPS coordinates"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#176B45]">
                          <Layers className="h-3.5 w-3.5" />
                          {floors.length} Floor{floors.length === 1 ? "" : "s"} ·{" "}
                          {areas.length} Area{areas.length === 1 ? "" : "s"} ·{" "}
                          {totalBins} Bin{totalBins === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.is_active
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#F3F4F6] text-[#6B7280]"
                            }`}
                        >
                          {st.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(st)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6]"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <Link
                            href={`/stations/${encodeURIComponent(st.station_code)}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#176B45] hover:bg-[#F0FDF4]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F7F8F4] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-[#176B45]" />
                <div>
                  <h3 className="text-lg font-bold text-[#111827] font-[family-name:var(--font-manrope)]">
                    {modalMode === "create"
                      ? "Create Station & Hierarchy"
                      : `Edit Station: ${editingCode}`}
                  </h3>
                  <p className="text-xs text-[#6B7280]">
                    Station → Floors → Disposal Areas → Bins
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#E5E7EB]/60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Station Metadata */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Station Code *
                  </label>
                  <input
                    type="text"
                    value={form.station_code}
                    disabled={modalMode === "edit"}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, station_code: e.target.value }))
                    }
                    placeholder="e.g. NTHU-DELTA-01"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm disabled:bg-[#F3F4F6] disabled:text-[#6B7280]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Station Name *
                  </label>
                  <input
                    type="text"
                    value={form.station_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, station_name: e.target.value }))
                    }
                    placeholder="e.g. Delta Building"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Location / Campus Zone *
                  </label>
                  <input
                    type="text"
                    value={form.location_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, location_name: e.target.value }))
                    }
                    placeholder="e.g. NTHU Main Campus"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-[#374151] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-[#D1D5DB] text-[#176B45]"
                    />
                    Station is Active
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Latitude
                  </label>
                  <input
                    type="text"
                    value={form.latitude}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, latitude: e.target.value }))
                    }
                    placeholder="e.g. 24.7961"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Longitude
                  </label>
                  <input
                    type="text"
                    value={form.longitude}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, longitude: e.target.value }))
                    }
                    placeholder="e.g. 120.9967"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Optional notes about the building or station"
                    className="w-full rounded-xl border border-[#D1D5DB] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Nested Floors -> Disposal Areas -> Bins */}
              <div className="space-y-4 border-t border-[#E5E7EB] pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-[#111827]">
                      Floors, Disposal Areas &amp; Bins
                    </h4>
                    <p className="text-xs text-[#6B7280]">
                      Existing records are soft-deactivated via the Active toggle to preserve historical telemetry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addFloor}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#176B45] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#176B45] hover:bg-[#DCFCE7]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Floor
                  </button>
                </div>

                {form.floors.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] p-6 text-center text-xs text-[#6B7280]">
                    No floors configured. Click <strong>Add Floor</strong> to begin.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {form.floors.map((floor) => {
                      const isCollapsed = !!collapsedFloors[floor.clientKey];
                      return (
                        <div
                          key={floor.clientKey}
                          className={`rounded-2xl border ${floor.is_active
                            ? "border-[#D1D5DB] bg-[#F9FAFB]"
                            : "border-[#E5E7EB] bg-[#F3F4F6] opacity-75"
                            } p-4 space-y-3`}
                        >
                          {/* Floor Header */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleFloorCollapse(floor.clientKey)}
                              className="rounded-lg p-1 text-[#4B5563] hover:bg-white"
                            >
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <input
                              type="text"
                              value={floor.floor_name}
                              onChange={(e) =>
                                updateFloorField(
                                  floor.clientKey,
                                  "floor_name",
                                  e.target.value
                                )
                              }
                              placeholder="Floor name (e.g. 1F)"
                              className="w-40 rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-sm font-semibold"
                            />
                            <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                              <span>Order:</span>
                              <input
                                type="number"
                                value={floor.floor_order}
                                onChange={(e) =>
                                  updateFloorField(
                                    floor.clientKey,
                                    "floor_order",
                                    e.target.value
                                  )
                                }
                                className="w-16 rounded-lg border border-[#D1D5DB] bg-white px-2 py-1 text-xs"
                              />
                            </div>
                            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#374151] ml-1">
                              <input
                                type="checkbox"
                                checked={floor.is_active}
                                onChange={(e) =>
                                  updateFloorField(
                                    floor.clientKey,
                                    "is_active",
                                    e.target.checked
                                  )
                                }
                                className="h-3.5 w-3.5 rounded text-[#176B45]"
                              />
                              Active
                            </label>
                            <div className="ml-auto flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => addArea(floor.clientKey)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#38A6A0] bg-white px-2.5 py-1 text-xs font-semibold text-[#176B45] hover:bg-[#F0FDF4]"
                              >
                                <Plus className="h-3 w-3" />
                                Add Area
                              </button>
                              {!floor.floor_id && (
                                <button
                                  type="button"
                                  onClick={() => removeUnsavedFloor(floor.clientKey)}
                                  className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEF2F2]"
                                  title="Remove unsaved floor"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Disposal Areas */}
                          {!isCollapsed && (
                            <div className="space-y-3 pl-4 border-l-2 border-[#48A868]/40">
                              {floor.disposal_areas.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-3 text-xs text-[#6B7280]">
                                  No disposal areas on this floor. Click <strong>Add Area</strong>.
                                </div>
                              ) : (
                                floor.disposal_areas.map((area) => (
                                  <div
                                    key={area.clientKey}
                                    className="rounded-xl border border-[#E5E7EB] bg-white p-3 space-y-2.5"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        type="text"
                                        value={area.area_name}
                                        onChange={(e) =>
                                          updateAreaField(
                                            floor.clientKey,
                                            area.clientKey,
                                            "area_name",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Area name (e.g. Main Entrance)"
                                        className="w-48 rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-sm font-medium"
                                      />
                                      <input
                                        type="text"
                                        value={area.description}
                                        onChange={(e) =>
                                          updateAreaField(
                                            floor.clientKey,
                                            area.clientKey,
                                            "description",
                                            e.target.value
                                          )
                                        }
                                        placeholder="Area description (optional)"
                                        className="flex-1 min-w-[160px] rounded-lg border border-[#D1D5DB] px-2.5 py-1 text-xs"
                                      />
                                      <label className="inline-flex items-center gap-1.5 text-xs text-[#374151]">
                                        <input
                                          type="checkbox"
                                          checked={area.is_active}
                                          onChange={(e) =>
                                            updateAreaField(
                                              floor.clientKey,
                                              area.clientKey,
                                              "is_active",
                                              e.target.checked
                                            )
                                          }
                                          className="h-3.5 w-3.5 rounded text-[#176B45]"
                                        />
                                        Active
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addBin(floor.clientKey, area.clientKey)
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#F0FDF4] px-2.5 py-1 text-xs font-semibold text-[#176B45] hover:bg-[#DCFCE7]"
                                      >
                                        <Plus className="h-3 w-3" />
                                        Add Bin
                                      </button>
                                      {!area.area_id && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeUnsavedArea(
                                              floor.clientKey,
                                              area.clientKey
                                            )
                                          }
                                          className="rounded-lg p-1 text-[#DC2626] hover:bg-[#FEF2F2]"
                                          title="Remove unsaved area"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    {/* Bins */}
                                    {area.bins.length > 0 && (
                                      <div className="space-y-1.5 pt-1">
                                        {area.bins.map((bin) => (
                                          <div
                                            key={bin.clientKey}
                                            className="flex flex-wrap items-center gap-2 rounded-lg bg-[#F9FAFB] px-2.5 py-1.5 text-xs"
                                          >
                                            <select
                                              value={bin.category_id}
                                              onChange={(e) =>
                                                updateBinField(
                                                  floor.clientKey,
                                                  area.clientKey,
                                                  bin.clientKey,
                                                  "category_id",
                                                  e.target.value
                                                )
                                              }
                                              className="rounded-lg border border-[#D1D5DB] bg-white px-2 py-1 text-xs font-medium"
                                            >
                                              {categories.map((cat) => (
                                                <option
                                                  key={cat.category_id}
                                                  value={cat.category_id}
                                                >
                                                  {cat.category_name}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min={1}
                                                value={bin.capacity_liters}
                                                onChange={(e) =>
                                                  updateBinField(
                                                    floor.clientKey,
                                                    area.clientKey,
                                                    bin.clientKey,
                                                    "capacity_liters",
                                                    e.target.value
                                                  )
                                                }
                                                className="w-16 rounded-lg border border-[#D1D5DB] bg-white px-2 py-1 text-xs"
                                              />
                                              <span className="text-[#6B7280]">L</span>
                                            </div>
                                            <label className="inline-flex items-center gap-1 text-[#374151]">
                                              <input
                                                type="checkbox"
                                                checked={bin.is_active}
                                                onChange={(e) =>
                                                  updateBinField(
                                                    floor.clientKey,
                                                    area.clientKey,
                                                    bin.clientKey,
                                                    "is_active",
                                                    e.target.checked
                                                  )
                                                }
                                                className="h-3.5 w-3.5 rounded text-[#176B45]"
                                              />
                                              Active
                                            </label>
                                            {areaOptions.length > 1 && (
                                              <div className="flex items-center gap-1 ml-auto">
                                                <MoveRight className="h-3 w-3 text-[#6B7280]" />
                                                <select
                                                  value={area.clientKey}
                                                  onChange={(e) =>
                                                    moveBinToArea(
                                                      floor.clientKey,
                                                      area.clientKey,
                                                      bin.clientKey,
                                                      e.target.value
                                                    )
                                                  }
                                                  title="Move bin to another area in this station"
                                                  className="max-w-[180px] rounded-lg border border-[#D1D5DB] bg-white px-2 py-1 text-xs text-[#374151]"
                                                >
                                                  {areaOptions.map((opt) => (
                                                    <option key={opt.key} value={opt.key}>
                                                      {opt.label}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>
                                            )}
                                            {!bin.bin_id && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeUnsavedBin(
                                                    floor.clientKey,
                                                    area.clientKey,
                                                    bin.clientKey
                                                  )
                                                }
                                                className="rounded p-1 text-[#DC2626] hover:bg-[#FEF2F2]"
                                                title="Remove unsaved bin"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#176B45] px-5 py-2 text-sm font-semibold text-white hover:bg-[#125637] disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modalMode === "create" ? "Create Station" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
