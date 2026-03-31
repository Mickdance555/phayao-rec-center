"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts";
import { 
  ShieldCheck, 
  FileDown, 
  Users, 
  BookOpen, 
  Calendar, 
  Filter, 
  Loader2,
  TrendingUp,
  UserCheck,
  UserMinus,
  ArrowRight
} from "lucide-react";
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, startOfDay, subDays, startOfWeek, startOfMonth, isWithinInterval, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";

const COLORS = ['#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#E0F2FE', '#0EA5E9', '#0284C7', '#0369A1', '#075985'];

export default function AdminReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push("/");
    }
    if (user?.role === 'admin') {
      fetchData();
    }
  }, [user, authLoading, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "bookings"), orderBy("startTime", "asc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: (doc.data().startTime as Timestamp).toDate()
      }));
      setBookings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Data based on selection
  const filteredData = useMemo(() => {
    const now = new Date();
    let start: Date;
    if (filter === 'day') start = startOfDay(now);
    else if (filter === 'week') start = startOfWeek(now, { weekStartsOn: 1 });
    else start = startOfMonth(now);

    return bookings.filter(b => b.start >= start);
  }, [bookings, filter]);

  // Stats Calculation
  const stats = useMemo(() => {
    const totalBookings = filteredData.length;
    let totalAttendees = 0;
    let members = 0;
    let nonMembers = 0;

    filteredData.forEach(b => {
      totalAttendees += (b.totalAttendees || 1);
      if (b.attendees) {
        b.attendees.forEach((at: any) => {
          if (at.isMember) members++;
          else nonMembers++;
        });
      } else {
        members++; // Default if no attendee list (older bookings)
      }
    });

    return { totalBookings, totalAttendees, members, nonMembers };
  }, [filteredData]);

  // Bar Chart Data (Bookings per day)
  const barChartData = useMemo(() => {
    const map: any = {};
    filteredData.forEach(b => {
      const dateKey = format(b.start, 'dd MMM', { locale: th });
      map[dateKey] = (map[dateKey] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  // Pie Chart Data (Time Slots)
  const pieChartData = useMemo(() => {
    const map: any = {};
    filteredData.forEach(b => {
      const timeStr = format(b.start, 'HH:mm');
      map[timeStr] = (map[timeStr] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Export CSV
  const exportToCSV = () => {
    const headers = ["วันที่", "เวลา", "ผู้จอง", "รหัสสมาชิก", "จำนวนผู้เข้างาน", "ชื่อผู้ร่วมงาน", "เบอร์โทรผู้ร่วมงาน"];
    const rows = filteredData.flatMap(b => {
       const dateStr = format(b.start, 'yyyy-MM-dd');
       const timeStr = `${format(b.start, 'HH:mm')} - ${format(b.endTime.toDate(), 'HH:mm')}`;
       if (b.attendees && b.attendees.length > 0) {
          return b.attendees.map((at: any) => [
            dateStr, timeStr, b.userName, b.memberId, b.totalAttendees, at.name, at.phone
          ]);
       }
       return [[dateStr, timeStr, b.userName, b.memberId, 1, b.userName, "N/A"]];
    });

    let csvContent = "\uFEFF"; // Add BOM for Excel Thai support
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map((val: any) => `"${val}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reports_${filter}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 mt-16 animate-in fade-in duration-1000">
         <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
               <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-[0.2em] text-xs">
                  <ShieldCheck size={16} />
                  Executive Dashboard
               </div>
               <h1 className="text-4xl font-black text-slate-900 leading-tight">สถิติและรายงานสรุปผล</h1>
               <p className="text-slate-500 font-bold">ข้อมูลการเข้าใช้งาน สำหรับผู้บริหาร อบจ.พะเยา</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                  {['day', 'week', 'month'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilter(t as any)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${filter === t ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t === 'day' ? 'รายวัน' : t === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}
                    </button>
                  ))}
               </div>
               <button 
                 onClick={exportToCSV}
                 className="flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-black transition-all hover:scale-105 active:scale-95"
               >
                  <FileDown size={18} />
                  ส่งออกข้อมูล (Export CSV)
               </button>
            </div>
         </header>

         {loading ? (
            <div className="py-32 flex flex-col items-center justify-center gap-6">
               <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
               <p className="text-slate-400 font-black uppercase tracking-widest text-xs">กำลังประมวลผลข้อมูลทางสถิติ...</p>
            </div>
         ) : (
            <div className="space-y-10 pb-20">
               {/* Stats Cards */}
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="ผู้เข้าใช้งานรวม" value={stats.totalAttendees} unit="คน" icon={<Users className="text-blue-600" />} color="blue" />
                  <StatCard title="จำนวนการจอง" value={stats.totalBookings} unit="ครั้ง" icon={<BookOpen className="text-indigo-600" />} color="indigo" />
                  <StatCard title="สมาชิก" value={stats.members} unit="คน" icon={<UserCheck className="text-green-600" />} color="green" />
                  <StatCard title="บุคคลทั่วไป" value={stats.nonMembers} unit="คน" icon={<UserMinus className="text-orange-600" />} color="orange" />
               </div>

               {/* Charts Section */}
               <div className="grid lg:grid-cols-3 gap-8">
                  {/* Bar Chart */}
                  <div className="lg:col-span-2 bg-white rounded-[3rem] p-8 sm:p-12 shadow-xl shadow-blue-900/5 border border-white relative overflow-hidden">
                     <div className="flex items-center justify-between mb-10">
                        <div>
                           <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                              <TrendingUp className="text-blue-600 w-7 h-7" /> 
                              สถิติการจอง{filter === 'day' ? 'รายวัน' : filter === 'week' ? 'รายสัปดาห์' : 'รายเดือน'}
                           </h3>
                           <p className="text-xs font-black text-slate-400 mt-1 uppercase tracking-[0.2em] opacity-60">Usage Statistics Analysis</p>
                        </div>
                     </div>
                     <div className="h-[350px] relative">
                        {barChartData.length === 0 ? (
                           <div className="absolute inset-0 flex items-center justify-center bg-slate-50/30 rounded-3xl border-2 border-dashed border-slate-100 italic text-slate-400 font-bold">
                              ยังไม่มีข้อมูลการจองในส่วนนี้
                           </div>
                        ) : (
                           <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={barChartData}>
                                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                 <XAxis dataKey="name" fontSize={11} fontWeight={800} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                 <YAxis fontSize={11} fontWeight={800} axisLine={false} tickLine={false} tick={{fill: '#64748B'}} />
                                 <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px'}} />
                                 <Bar dataKey="value" radius={[12, 12, 0, 0]} fill="#3B82F6">
                                    {barChartData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.value > 10 ? '#1D4ED8' : '#3B82F6'} />)}
                                 </Bar>
                              </BarChart>
                           </ResponsiveContainer>
                        )}
                     </div>
                  </div>

                  {/* Pie Chart */}
                  <div className="bg-white rounded-[3rem] p-8 sm:p-12 shadow-xl shadow-blue-900/5 border border-white flex flex-col">
                     <div className="mb-10">
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                           <Clock className="text-blue-500" /> ช่วงเวลายอดนิยม
                        </h3>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Peak Booking Slots</p>
                     </div>
                     <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                           <PieChart>
                              <Pie
                                 data={pieChartData}
                                 innerRadius={60}
                                 outerRadius={100}
                                 paddingAngle={5}
                                 dataKey="value"
                              >
                                 {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                              <Legend verticalAlign="bottom" layout="vertical" iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 800, color: '#475569'}} />
                           </PieChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </main>
    </div>
  );
}

function StatCard({title, value, unit, icon, color}: any) {
   const colors: any = {
      blue: 'bg-blue-50 border-blue-100',
      indigo: 'bg-indigo-50 border-indigo-100',
      green: 'bg-green-50 border-green-100',
      orange: 'bg-orange-50 border-orange-100'
   };
   return (
      <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-blue-900/5 hover:-translate-y-1 transition-all group`}>
         <div className="flex items-center justify-between mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-6 bg-slate-50`}>{icon}</div>
            <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
         </div>
         <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
         <div className="flex items-baseline gap-2">
            <h4 className="text-4xl font-black text-slate-900 leading-none">{value}</h4>
            <span className="text-xs font-bold text-slate-400 uppercase">{unit}</span>
         </div>
      </div>
   );
}

function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
