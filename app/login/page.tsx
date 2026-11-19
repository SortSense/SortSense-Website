'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button } from '@/components/ui/button';
import { Lock, Mail, AlertCircle, Shield } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8F4] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 border border-[#E1E8E1] shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <BrandLogo />
          </div>
          <h1 className="text-xl font-bold text-[#202A25] font-display">
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
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E1E8E1] bg-[#F7F8F4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] text-[#202A25] transition-all"
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
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-[#E1E8E1] bg-[#F7F8F4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] text-[#202A25] transition-all"
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
            {loading ? 'Authenticating...' : 'Sign In to Console'}
          </Button>
        </form>

        <div className="p-3 rounded-xl bg-[#F7F8F4] border border-[#E1E8E1] text-[11px] text-[#65736A] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#202A25]">
            <Shield className="w-3.5 h-3.5 text-[#176B45]" />
            <span>Role-Based Access</span>
          </div>
          <p>
            Supports authenticated <code>ADMIN</code> and <code>JANITOR</code> accounts via Supabase Auth and the <code>profiles</code> table.
          </p>
        </div>
      </div>
    </main>
  );
}
