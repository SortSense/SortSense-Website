'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, User } from 'lucide-react';
import { Logo } from '@/components/ui/brand-logo';
import { createClient } from '@/lib/supabase/client';

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
  }
  const isLocator = pathname === '/find-bin';

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
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);



  // Check user session & staff role for unobtrusive header actions
  useEffect(() => {
    const supabase = createClient();
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || 'User');
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('user_id', user.id)
          .single();

        if (profile && profile.is_active) {
          setUserRole(profile.role?.toUpperCase() || null);
        }
      } else {
        setUserEmail(null);
        setUserRole(null);
      }
    }
    checkAuth();
  }, [pathname]);

  return (
    <div className={`site-header-wrapper ${isScrolled ? 'is-scrolled' : ''}`}>
      <header
        className={`site-header ${isScrolled ? 'is-scrolled' : ''}`}
        role="banner"
      >
        <Logo />
        <nav
          className={`site-nav ${open ? 'is-open' : ''}`}
          aria-label="Primary navigation"
        >
          <Link
            onClick={() => setOpen(false)}
            href="/"
            className={pathname === '/' ? 'active' : ''}
          >
            Home
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/find-bin"
            className={pathname === '/find-bin' ? 'active' : ''}
          >
            Find a Bin
          </Link>
          <Link
            onClick={() => setOpen(false)}
            href="/sorting-guide"
            className={pathname === '/sorting-guide' ? 'active' : ''}
          >
            Sorting Guide
          </Link>

          {/* If staff role detected, show console link */}
          {userRole && (userRole === 'ADMIN' || userRole === 'JANITOR') && (
            <Link
              onClick={() => setOpen(false)}
              href="/dashboard"
              className="text-[#176B45] font-bold"
            >
              Operations Console
            </Link>
          )}
        </nav>

        <div className="header-actions">
          {!isLocator && (
            <Link
              className="button button-primary header-cta"
              href="/find-bin"
            >
              Find a Bin
            </Link>
          )}

          {userEmail ? (
            <Link
              href={userRole ? '/dashboard' : '/find-bin'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#65736A] hover:text-[#176B45] px-2 py-1 rounded-lg"
              title={`Signed in as ${userEmail}`}
            >
              <User size={15} />
              <span className="hidden sm:inline max-w-[120px] truncate">{userEmail}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#65736A] hover:text-[#176B45] px-3 py-1.5 rounded-lg border border-[#E1E8E1] hover:bg-[#F2F7F3] transition-colors"
            >
              Sign In
            </Link>
          )}

          <button
            className="menu-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
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
