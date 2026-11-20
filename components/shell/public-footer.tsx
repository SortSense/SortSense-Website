import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/ui/brand-logo';

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Logo reversed />
        <p>Smarter Sorting. Better Choices.</p>
      </div>
      <div className="footer-note">
        <strong>SortSense Campus Platform</strong>
        <span>
          Real-time station monitoring and environmental intelligence for campus waste reduction.
        </span>
      </div>
      <div className="footer-links">
        <Link href="/find-bin">Find a Bin</Link>
        <Link href="/sorting-guide">Sorting Guide</Link>
        <Link href="/login">Staff Access</Link>
      </div>
    </footer>
  );
}
