"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { 
  LogOut, 
  Home, 
  Calendar, 
  History, 
  User, 
  ShieldCheck, 
  Users, 
  LayoutDashboard,
  LogIn,
  TrendingUp
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Navbar() {
  const { user, firebaseUser, logout, signInWithGoogle } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-4 py-4 ${scrolled ? 'bg-white/90 backdrop-blur-xl shadow-2xl shadow-blue-900/5' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between bg-white/40 backdrop-blur-md rounded-[2.5rem] p-3 sm:px-6 border border-white/40 shadow-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:rotate-12 transition-transform">
            <LayoutDashboard size={20} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">ศูนย์นันทนาการ</h1>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Phayao Pao</p>
          </div>
        </Link>

        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
            <Home size={18} />
            <span className="hidden md:inline">หน้าหลัก</span>
          </Link>
          
          {user && user.status === "active" && (
            <>
              <Link href="/dashboard" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <LayoutDashboard size={18} />
                <span className="hidden md:inline">ห้องจอง / แดชบอร์ด</span>
              </Link>
              <Link href="/history" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <History size={18} />
                <span className="hidden md:inline">ประวัติการจอง</span>
              </Link>
            </>
          )}

          {user && user.role === "admin" && (
            <div className="flex items-center gap-4">
              <Link href="/admin" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <ShieldCheck size={18} />
                <span className="hidden md:inline">เช็คอิน (Scan)</span>
              </Link>
              <Link href="/admin/bookings" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <ShieldCheck size={18} className="text-blue-500" />
                <span className="hidden md:inline">จัดการการจอง</span>
              </Link>
              <Link href="/admin/users" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <Users size={18} className="text-blue-500" />
                <span className="hidden md:inline">จัดการสมาชิก</span>
              </Link>
              <Link href="/admin/ban-requests" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <ShieldCheck size={18} className="text-red-500" />
                <span className="hidden md:inline text-red-600">คำขอระงับถาวร</span>
              </Link>
              <Link href="/admin/reports" className={`flex items-center gap-2 text-sm font-black transition-colors ${scrolled ? 'text-slate-600 hover:text-blue-600' : 'text-slate-700 hover:text-blue-900'}`}>
                <TrendingUp size={18} className="text-blue-500" />
                <span className="hidden md:inline">สถิติและรายงาน</span>
              </Link>
            </div>
          )}

          <div className="h-6 w-[1px] bg-slate-200 mx-2 hidden sm:block opacity-50"></div>

          {firebaseUser ? (
            <div className="flex items-center gap-4">
               {user && user.status === "active" && (
                 <Link href="/dashboard" className="hidden lg:flex items-center gap-2 px-6 py-2.5 bg-blue-50 text-blue-700 rounded-2xl font-black text-sm hover:bg-blue-100 transition-all border border-blue-100">
                    <LayoutDashboard size={18} />
                    ห้องจองของฉัน
                 </Link>
               )}
               <button 
                onClick={logout}
                className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 border border-red-100"
               >
                 <LogOut size={20} />
               </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={signInWithGoogle}
                className="px-5 py-2.5 bg-white text-blue-600 border-2 border-blue-100 rounded-2xl text-xs sm:text-sm font-black hover:bg-blue-50 hover:border-blue-200 transition-all active:scale-95 shadow-sm"
              >
                สมัครสมาชิก
              </button>
              <button 
                onClick={signInWithGoogle}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-200 transition-all active:scale-95 shadow-lg shadow-blue-100"
              >
                <LogIn size={18} />
                เข้าสู่ระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
