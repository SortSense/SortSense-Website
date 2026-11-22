"use client";

import { createClient } from "@/lib/supabase/client";
import type { WasteCategory } from "@/components/types";

export type EmptyCompartmentTarget = "all" | WasteCategory;

export interface EmptyBinsResult {
  station_id: string;
  compartment: EmptyCompartmentTarget;
  timestamp: string;
  message?: string;
}

/**
 * Execute POST /api/bins/empty with the active Supabase Bearer access token
 * and a single automatic 401 refreshSession() retry.
 */
export async function emptyStationBins(params: {
  stationId: string;
  compartment: EmptyCompartmentTarget;
  notes?: string | null;
}): Promise<EmptyBinsResult> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let accessToken = session?.access_token;
  if (!accessToken) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    accessToken = refreshed.session?.access_token;
  }

  if (!accessToken) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const payload = JSON.stringify({
    station_id: params.stationId,
    compartment: params.compartment,
    notes: params.notes?.trim() || null,
  });

  let res = await fetch("/api/bins/empty", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: payload,
  });

  if (res.status === 401) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession();
    const retryToken = refreshed.session?.access_token;
    if (refreshError || !retryToken) {
      throw new Error("Authentication expired. Please sign in again.");
    }
    res = await fetch("/api/bins/empty", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${retryToken}`,
      },
      body: payload,
    });
  }

  const body = (await res.json().catch(() => ({}))) as {
    detail?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(body.detail || `Failed to empty bin (HTTP ${res.status})`);
  }

  return {
    station_id: params.stationId,
    compartment: params.compartment,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    message: body.message,
  };
}
