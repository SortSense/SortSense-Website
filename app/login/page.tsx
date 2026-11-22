"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, Lock, Mail, Shield } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F8F9F6] px-4 py-12">
      {/* Ambient Radial Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-96 w-96 rounded-full bg-emerald-800/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-24 h-[26rem] w-[26rem] rounded-full bg-lime-300/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-emerald-700/[0.06] blur-3xl"
      />

      {/* Subtle Campus Topographic & Geometric Dot-Grid Pattern */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full text-[#14532D] opacity-[0.055]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="sortsense-login-dots"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.15" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sortsense-login-dots)" />
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          opacity="0.7"
        >
          <path d="M-120 180 C 160 90, 340 280, 640 160 S 1120 120, 1520 230" />
          <path d="M-100 240 C 200 150, 380 340, 680 220 S 1140 180, 1540 290" />
          <path d="M-80 620 C 220 520, 440 720, 780 590 S 1220 510, 1560 640" />
          <path d="M-60 690 C 260 590, 480 790, 820 660 S 1260 580, 1580 710" />
        </g>
      </svg>

      {/* Top-Left Back to Home Navigation */}
      <div className="relative z-10 w-full max-w-md mb-4 sm:fixed sm:top-6 sm:left-6 sm:w-auto sm:mb-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-950/10 bg-white/85 backdrop-blur-sm px-3.5 py-1.5 text-xs font-semibold text-[#14532D] shadow-xs hover:bg-white hover:border-[#14532D]/30 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Elevated Centered Sign-In Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 backdrop-blur-sm p-8 border border-emerald-950/10 shadow-xl shadow-emerald-950/5 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <BrandLogo />
          </div>
          <h1 className="text-xl font-bold text-[#14231B] font-jakarta">
            Staff Portal Sign In
          </h1>
          <p className="text-xs text-[#65736A]">
            Access the SortSense university operations console
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-[#202A25] mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@university.edu"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DCE5DC] bg-[#F8F9F6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14532D]/15 focus:border-[#14532D] text-[#202A25] transition-all"
              />
              <Mail className="w-4 h-4 text-[#65736A] absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-[#202A25] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#DCE5DC] bg-[#F8F9F6] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#14532D]/15 focus:border-[#14532D] text-[#202A25] transition-all"
              />
              <Lock className="w-4 h-4 text-[#65736A] absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {errorMessage && (
            <div
              className="p-3 bg-[#FFF0EE] border border-[#FADAD7] rounded-xl text-xs text-[#C84F49] flex items-center gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="w-full mt-2"
          >
            {loading ? "Authenticating..." : "Sign In to Console"}
          </Button>
        </form>

        <div className="p-3 rounded-xl bg-[#F6F8F5] border border-[#E2EAE2] text-[11px] text-[#65736A] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#14231B]">
            <Shield className="w-3.5 h-3.5 text-[#14532D]" />
            <span>Role-Based Access</span>
          </div>
          <p>
            Supports authenticated <code>ADMIN</code> and <code>JANITOR</code>{" "}
            accounts via Supabase Auth and the <code>profiles</code> table.
          </p>
        </div>
      </div>
    </main>
  );
}
