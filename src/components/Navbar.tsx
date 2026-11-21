"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { OFFICE_ROLES, ROLE_LABELS } from "@/lib/workflow";

// Icons (You can use lucide-react or heroicons, I'm using inline SVGs for zero dependencies)
const BellIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);
const ChevronDown = () => (
  <svg
    className="w-4 h-4 ml-1"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);
const LogoutIcon = () => (
  <svg
    className="w-4 h-4 mr-2"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

interface NavbarProps {
  user: { name: string; email: string; role: string; image?: string };
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  // New state for Profile Dropdown
  const [showProfile, setShowProfile] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showMobile, setShowMobile] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node))
        setShowMore(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchNotifs() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifCount(data.unreadCount || 0);
      setNotifs(data.notifications || []);
    } catch {}
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifCount(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const ALL = ["incubatee", "mentor", ...OFFICE_ROLES];
  const REPORTERS = ["executive", "manager", "sr_manager", "ceo", "admin_it"];
  // primary = always in the bar; the rest sit under "More" (PRD: role-specific navigation)
  const links = [
    { href: "/dashboard", label: "Dashboard", roles: ["incubatee", ...OFFICE_ROLES], primary: true },
    { href: "/mentor", label: "Mentor hub", roles: ["mentor"], primary: true },
    { href: "/apply", label: "Apply", roles: ["incubatee"], primary: true },
    { href: "/connect", label: "Find a mentor", roles: ["incubatee"], primary: true },
    { href: "/approvals", label: "Applications", roles: OFFICE_ROLES as string[], primary: true },
    { href: "/network", label: "Network", roles: OFFICE_ROLES as string[], primary: true },
    { href: "/qpr", label: "Progress", roles: ["incubatee", ...OFFICE_ROLES], primary: true },
    { href: "/messages", label: "Messages", roles: ALL, primary: true },
    { href: "/invest", label: "Invest", roles: ["mentor"], primary: true },
    { href: "/invest", label: "Investor pitches", roles: ["incubatee"], primary: false },
    { href: "/invest", label: "Investment proposals", roles: OFFICE_ROLES as string[], primary: false },
    { href: "/reports", label: "Reports", roles: REPORTERS, primary: false },
    { href: "/broadcast", label: "Broadcast", roles: ["executive", "manager", "ceo", "admin_it"], primary: false },
    { href: "/posts", label: "Blog posts", roles: ["staff", "admin_it"], primary: false },
    { href: "/staff", label: "Team", roles: ["ceo"], primary: false },
    { href: "/admin", label: "Admin", roles: ["ceo", "admin_it"], primary: false },
    { href: "/startups", label: "Directory", roles: ALL, primary: false },
  ].filter((l) => l.roles.includes(user.role));
  const primaryLinks = links.filter((l) => l.primary);
  const moreLinks = links.filter((l) => !l.primary);
  const moreActive = moreLinks.some((l) => l.href === pathname);

  // Generate Avatar URL based on name if user doesn't have one
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0D8ABC&color=fff&size=128`;

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-lg border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* 1. Logo Section */}
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-leaf-700 to-indigo-700 flex items-center justify-center shadow-sm">
              <span
                className="text-white font-bold text-lg"
                style={{ fontFamily: "serif" }}
              >
                C
              </span>
            </div>
            <span className="font-display text-lg font-bold text-slate-800 hidden sm:block tracking-tight">
              CIMP-BIIF
            </span>
          </Link>

          {/* 2. Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {primaryLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group relative px-3 py-2"
              >
                <span
                  className={`text-sm font-medium transition-colors ${
                    pathname === l.href
                      ? "text-leaf-700"
                      : "text-slate-600 group-hover:text-slate-900"
                  }`}
                >
                  {l.label}
                </span>
                {/* Active Indicator Dot */}
                {pathname === l.href && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-leaf-700" />
                )}
              </Link>
            ))}
            {moreLinks.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} aria-haspopup="menu"
                  className={`px-3 py-2 text-sm font-medium flex items-center gap-1 ${moreActive ? "text-leaf-700" : "text-slate-600 hover:text-slate-900"}`}>
                  More <ChevronDown />
                </button>
                {showMore && (
                  <div role="menu" className="absolute left-0 top-10 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                    {moreLinks.map((l) => (
                      <Link key={l.href + l.label} href={l.href} role="menuitem" onClick={() => setShowMore(false)}
                        className={`block px-4 py-2 text-sm ${pathname === l.href ? "text-leaf-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>{l.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Right Side: Search, Notifications, Profile */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile menu */}
          <button onClick={() => setShowMobile((v) => !v)} aria-expanded={showMobile} aria-controls="mobile-nav" aria-label="Menu"
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={showMobile ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && notifCount > 0) markAllRead();
              }}
              className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
            >
              <BellIcon />
              {notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-fade-in py-2">
                <div className="px-4 py-2 border-b border-slate-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Notifications
                  </span>
                  {notifCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-leaf-700 hover:text-leaf-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      No new notifications
                    </div>
                  ) : (
                    notifs.map((n: any) => (
                      <div
                        key={n._id}
                        className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${!n.read ? "bg-leaf-50/30" : ""}`}
                      >
                        <p
                          className={`text-sm ${n.read ? "text-slate-600" : "text-slate-900 font-semibold"}`}
                        >
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Profile Dropdown (New Feature) */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-700 leading-tight">
                  {user.name.split(" ")[0]}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
              <div className="relative">
                <img
                  src={user.image || avatarUrl}
                  alt={user.name}
                  className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
                />
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <ChevronDown />
            </button>

            {/* Profile Menu */}
            {showProfile && (
              <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in z-50">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-bold text-slate-800">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user.email}
                  </p>
                </div>
                <div className="py-1">
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-leaf-700"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-leaf-700"
                  >
                    Your Profile
                  </Link>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogoutIcon />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showMobile && (
        <div id="mobile-nav" className="md:hidden border-t border-slate-200 bg-white px-4 py-3 grid grid-cols-2 gap-1">
          {links.map((l) => (
            <Link key={l.href + l.label} href={l.href} onClick={() => setShowMobile(false)}
              className={`px-3 py-2 rounded-lg text-sm ${pathname === l.href ? "bg-leaf-50 text-leaf-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
