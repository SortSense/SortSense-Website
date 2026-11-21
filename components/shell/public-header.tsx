"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/brand-logo";
import { createClient } from "@/lib/supabase/client";

function getInitials(fullName: string | null, email: string | null): string {
  const source = (fullName || email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userRole, setUserRole] = useState<"ADMIN" | "JANITOR" | "USER" | null>(
    null,
  );
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarContainerRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const router = useRouter();
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
    setAvatarOpen(false);
  }

  // Monitor scroll position with requestAnimationFrame throttle
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 48);
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close avatar popover on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        avatarContainerRef.current &&
        !avatarContainerRef.current.contains(e.target as Node)
      ) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Check user session & staff role
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        setUserEmail(user.email || "user@campus.edu");
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role, is_active")
          .eq("user_id", user.id)
          .single();

        if (!active) return;
        setUserName(
          profile?.full_name || user.email?.split("@")[0] || "Campus User",
        );
        if (profile && profile.is_active) {
          const r = profile.role?.toUpperCase();
          setUserRole(r === "ADMIN" || r === "JANITOR" ? r : "USER");
        } else {
          setUserRole("USER");
        }
      } else {
        setUserEmail(null);
        setUserName(null);
        setUserRole(null);
      }
    }
    checkAuth();
    return () => {
      active = false;
    };
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAvatarOpen(false);
    setUserEmail(null);
    setUserName(null);
    setUserRole(null);
    router.refresh();
  };

  const isStaff = userRole === "ADMIN" || userRole === "JANITOR";
  const initials = getInitials(userName, userEmail);

  return (
    <div className={`site-header-wrapper ${isScrolled ? "is-scrolled" : ""}`}>
      <header
        className={`site-header ${isScrolled ? "is-scrolled" : ""}`}
        role="banner"
      >
        <Logo />
        <nav
          className={`site-nav ${open ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          <Link
            onClick={() => setOpen(false)}
            href="/"
            className={pathname === "/" ? "active" : ""}
          >
            Home
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/find-bin"
            className={pathname === "/find-bin" ? "active" : ""}
          >
            Find a Bin
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/sorting-guide"
            className={pathname === "/sorting-guide" ? "active" : ""}
          >
            Sorting Guide
          </Link>

          {isStaff && (
            <Link
              onClick={() => setOpen(false)}
              href="/dashboard"
              className="text-[#14532D] font-bold"
            >
              Operations Console
            </Link>
          )}
        </nav>

        <div className="header-actions flex items-center gap-2.5">
          {userEmail ? (
            <div
              ref={avatarContainerRef}
              className="relative"
              onMouseEnter={() => setAvatarOpen(true)}
              onMouseLeave={() => setAvatarOpen(false)}
            >
              <button
                type="button"
                onClick={() => setAvatarOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={avatarOpen}
                className="h-10 w-10 rounded-full bg-[#14532D] text-white text-xs font-bold flex items-center justify-center shadow-xs ring-2 ring-[#14532D]/15 hover:bg-[#0F3F22] transition-colors"
              >
                {initials}
              </button>

              {avatarOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#DCE5DC] bg-white p-4 shadow-xl z-50 space-y-3 text-left">
                  <div className="flex items-start justify-between gap-2 border-b border-[#EFF2EF] pb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#202A25] truncate">
                        {userName}
                      </p>
                      <p className="text-xs text-[#65736A] truncate">
                        {userEmail}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        userRole === "ADMIN"
                          ? "bg-[#E9F3ED] text-[#14532D]"
                          : userRole === "JANITOR"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {userRole || "USER"}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {isStaff && (
                      <Link
                        href="/dashboard"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-[#14532D] bg-[#F2F7F3] hover:bg-[#E4EFE6] transition-colors"
                      >
                        <LayoutDashboard size={14} />
                        Operations Dashboard
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-[#C84F49] hover:bg-[#FFF0EE] transition-colors"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center h-10 px-4 py-2 rounded-full text-xs font-semibold text-[#202A25] border border-[#DCE5DC] bg-white hover:bg-[#F2F7F3] transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
          )}

          <Link
            className="inline-flex items-center justify-center h-10 px-4 py-2 rounded-full text-xs font-semibold bg-[#14532D] text-white hover:bg-[#0F3F22] transition-colors shadow-xs whitespace-nowrap"
            href="/find-bin"
          >
            Find a Bin
          </Link>

          <button
            className="menu-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
    </div>
  );
}
