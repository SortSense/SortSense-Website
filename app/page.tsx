'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import {
  Radio,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 30);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F8F4] text-[#202A25] flex flex-col font-sans">
      {/* Floating Pill Header Shell */}
      <div className={`site-header-wrapper ${isScrolled ? 'is-scrolled' : ''}`}>
        <header className={`site-header ${isScrolled ? 'is-scrolled' : ''}`}>
          <BrandLogo />

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#65736A]">
            <a href="#architecture" className="hover:text-[#176B45] transition-colors">
              IoT Architecture
            </a>
            <a href="#streams" className="hover:text-[#176B45] transition-colors">
              Waste Streams
            </a>
            <a href="#roles" className="hover:text-[#176B45] transition-colors">
              Staff Workflows
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs font-semibold text-[#65736A] hover:text-[#176B45] hover:bg-[#E9F3ED] rounded-lg transition-colors"
            >
              Staff Sign In
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#176B45] hover:bg-[#0F4C35] rounded-xl shadow-xs transition-all active:translate-y-[1px]"
            >
              <span>Operations Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5] text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#48A868] animate-pulse" />
          <span>University Environmental Operations Console</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-[#202A25] tracking-tight font-display leading-tight max-w-3xl mx-auto">
          Intelligent Waste Sorting &amp;{' '}
          <span className="text-[#176B45]">Campus Telemetry</span>
        </h1>

        <p className="text-sm sm:text-base text-[#65736A] max-w-2xl mx-auto leading-relaxed">
          SortSense connects Fabio&apos;s ESP32-S3 ToF sensors and Edric&apos;s AI inference backend to a unified
          cloud operations platform — empowering facility managers and janitors with live fill tracking.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#176B45] hover:bg-[#0F4C35] text-white text-xs font-bold shadow-xs transition-all active:translate-y-[1px]"
          >
            <Radio className="w-4 h-4" />
            <span>Launch Live Console</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#E9F3ED] text-[#202A25] border border-[#E1E8E1] text-xs font-bold transition-all active:translate-y-[1px]"
          >
            <ShieldCheck className="w-4 h-4 text-[#176B45]" />
            <span>Staff Portal Access</span>
          </Link>
        </div>
      </section>

      {/* 4 Standardized Waste Streams */}
      <section id="streams" className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[11px] font-bold text-[#65736A] uppercase tracking-wider font-display">
            Standardized Categories
          </span>
          <h2 className="text-2xl font-bold text-[#202A25] font-display">
            Four Segregated Campus Streams
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-[#E1E8E1] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#38A6A0] uppercase tracking-wider font-display">
                Plastic
              </span>
              <span className="w-3 h-3 rounded-full bg-[#38A6A0]" />
            </div>
            <h3 className="font-bold text-sm text-[#202A25]">Rigid Containers &amp; Bottles</h3>
            <p className="text-xs text-[#65736A] leading-relaxed">
              Clean beverage bottles, containers, and tubs. Monitored via ToF distance sensors.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#E1E8E1] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#D49A3A] uppercase tracking-wider font-display">
                Paper
              </span>
              <span className="w-3 h-3 rounded-full bg-[#D49A3A]" />
            </div>
            <h3 className="font-bold text-sm text-[#202A25]">Dry Paper &amp; Cardboard</h3>
            <p className="text-xs text-[#65736A] leading-relaxed">
              Office documents, study sheets, and packaging. Kept clean and dry.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#E1E8E1] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#71849A] uppercase tracking-wider font-display">
                Metal
              </span>
              <span className="w-3 h-3 rounded-full bg-[#71849A]" />
            </div>
            <h3 className="font-bold text-sm text-[#202A25]">Drink Cans &amp; Food Tins</h3>
            <p className="text-xs text-[#65736A] leading-relaxed">
              Aluminum beverage cans and metal packaging. Empty of liquids before disposal.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#E1E8E1] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#776F68] uppercase tracking-wider font-display">
                General Waste
              </span>
              <span className="w-3 h-3 rounded-full bg-[#776F68]" />
            </div>
            <h3 className="font-bold text-sm text-[#202A25]">Non-Recyclable Materials</h3>
            <p className="text-xs text-[#65736A] leading-relaxed">
              Food wrappers, soiled packaging, and composites destined for landfill diversion.
            </p>
          </div>
        </div>
      </section>

      {/* Role Workflows Overview */}
      <section id="roles" className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-[#E1E8E1] space-y-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E9F3ED] text-[#176B45] border border-[#CDE3D5]">
              ADMIN WORKFLOW
            </span>
            <h3 className="text-base font-bold text-[#202A25] font-display">
              Facility &amp; System Governance
            </h3>
            <ul className="text-xs text-[#65736A] space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#176B45]" />
                Campus-wide station fleet monitoring &amp; GPS calibration
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#176B45]" />
                Daily recycling diversion analytics &amp; sorting accuracy tracking
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#176B45]" />
                AI verified waste disposal audit stream &amp; break-beam logs
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-[#E1E8E1] space-y-3">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#FFF6E4] text-[#C48419] border border-[#FDE8BF]">
              JANITOR WORKFLOW
            </span>
            <h3 className="text-base font-bold text-[#202A25] font-display">
              Operational Task Dispatch
            </h3>
            <ul className="text-xs text-[#65736A] space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C48419]" />
                Priority collection queue sorted by fill percentage (≥85% first)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C48419]" />
                Separate sensor error condition alerts without false fill assumptions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C48419]" />
                Authorized bin emptying logs committed to bin_emptying_events
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#E1E8E1] bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#65736A] gap-4">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-[#176B45] transition-colors">
              Staff Portal
            </Link>
            <span>•</span>
            <Link href="/dashboard" className="hover:text-[#176B45] transition-colors">
              Console
            </Link>
            <span>•</span>
            <span className="font-mono text-[#65736A]">SortSense © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
