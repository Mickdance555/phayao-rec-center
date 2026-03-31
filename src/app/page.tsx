"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addHours,
  isBefore,
  startOfDay,
  endOfDay,
  isAfter
} from "date-fns";
import { th } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  X,
  Plus,
  ArrowRight,
  Clock,
  Smartphone,
  QrCode,
  ShieldCheck,
  Loader2,
  Info,
  Phone,
  Mail,
  MapPin,
  UserPlus,
  LogIn,
  LayoutDashboard,
  AlertTriangle
} from "lucide-react";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isOperationalDay } from "@/lib/holidays";

export default function LandingPage() {
  const { user, firebaseUser, loading: authLoading, signInWithGoogle } = useAuth();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const timeSlots = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

  // Policy Constants
  const maxBookingDays = 15;
  const today = startOfDay(new Date());
  const maxDate = startOfDay(addHours(today, maxBookingDays * 24));

  useEffect(() => {
     setLoadingBookings(true);
     const monthStart = startOfMonth(currentMonth);
     const monthEnd = endOfMonth(currentMonth);
     const q = query(
       collection(db, "bookings"),
       where("startTime", ">=", Timestamp.fromDate(monthStart)),
       where("startTime", "<=", Timestamp.fromDate(monthEnd))
     );

     const unsubscribe = onSnapshot(q, (snapshot) => {
        const bookingData = snapshot.docs.map(doc => ({
          id: doc.id, ...doc.data(),
          start: (doc.data().startTime as Timestamp).toDate(),
          end: (doc.data().endTime as Timestamp).toDate()
        }));
        setBookings(bookingData);
        setLoadingBookings(false);
     }, (error) => {
        setLoadingBookings(false);
     });

     return () => unsubscribe();
  }, [currentMonth]);

  const handleDateClick = (date: Date) => {
    const clickedDate = startOfDay(date);
    if (isBefore(clickedDate, today) || isAfter(clickedDate, maxDate)) {
       return;
    }
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleActionClick = () => {
    if (!firebaseUser) signInWithGoogle();
    else if (!user) router.push("/register");
    else router.push("/dashboard");
  };

  const getDayBookings = (date: Date) => bookings.filter((b: any) => isSameDay(b.start, date));
  const isSlotBooked = (date: Date, timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = addHours(slotStart, 1);
    return getDayBookings(date).some((b: any) => (slotStart >= b.start && slotStart < b.end) || (slotEnd > b.start && slotEnd <= b.end));
  };

  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-48 sm:pb-32 bg-slate-50 border-b border-slate-100 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-blue-600/5 -skew-x-12 translate-x-1/2"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center lg:text-left grid lg:grid-cols-2 items-center gap-16">
           <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-[0.2em] mb-8 border border-blue-100 shadow-sm">
                 <ShieldCheck size={14} /> Official Recreation Portal
              </span>
              <h1 className="text-5xl sm:text-7xl font-black text-slate-900 leading-[1.05] tracking-tight mb-8">
                 จองเวลา <br /> สุขภาพกาย สุขภาพใจ <br /><span className="text-blue-600">อบจ.พะเยา</span>
              </h1>
              <p className="text-xl sm:text-2xl text-slate-500 font-bold leading-relaxed mb-12 max-w-xl">
                 โครงการส่งเสริมสุขภาพสำหรับทุกคน เช็คเวลาว่างและจองคิวใช้งานออนไลน์ได้ทันที ตลอด 24 ชม.
              </p>
           <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start items-center">
                 {!firebaseUser ? (
                   <>
                     <button 
                      onClick={signInWithGoogle}
                      className="px-10 py-6 bg-blue-600 text-white rounded-3xl text-xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 w-full sm:w-auto justify-center"
                     >
                        <LogIn />
                        เข้าสู่ระบบจองห้อง
                     </button>
                     <button 
                      onClick={signInWithGoogle}
                      className="px-10 py-6 bg-white text-blue-600 border-4 border-blue-100 rounded-3xl text-xl font-black shadow-lg hover:bg-blue-50 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 w-full sm:w-auto justify-center group"
                     >
                        <UserPlus className="group-hover:rotate-12 transition-transform" />
                        ลงทะเบียนสมาชิกใหม่
                     </button>
                   </>
                 ) : (
                   <button 
                    onClick={() => router.push(user ? "/dashboard" : "/register")}
                    className="px-10 py-6 bg-blue-600 text-white rounded-3xl text-xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center gap-3 w-full sm:w-auto justify-center"
                   >
                      <LayoutDashboard />
                      {user ? "ไปที่หน้าแดชบอร์ด" : "ดำเนินการลงทะเบียนต่อ"}
                      <ArrowRight />
                   </button>
                 )}
              </div>
           </div>
           <div className="hidden lg:block relative group">
              <div className="relative bg-white p-6 rounded-[4rem] shadow-2xl border-4 border-white transition-all group-hover:-rotate-1">
                 <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1000" className="w-full h-96 object-cover rounded-[3rem]" alt="gym" />
                 <div className="absolute -bottom-6 -right-6 bg-blue-600 text-white p-8 rounded-[3rem] shadow-2xl font-black rotate-6 group-hover:rotate-0 transition-transform cursor-pointer" onClick={handleActionClick}>
                    จองห้องเลย! <ArrowRight className="inline ml-2" />
                 </div>
              </div>
           </div>
        </div>
      </section>

      {/* Synchronized Calendar Preview Section */}
      <section id="calendar" className="py-24 bg-white px-4">
        <div className="max-w-6xl mx-auto">
           <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">ตรวจสอบตารางการใช้งานห้องนันทนาการ</h2>
              <p className="text-slate-500 font-bold text-lg">แสดงสถานะความว่างแบบเรียลไทม์จากฐานข้อมูลกลาง</p>
              <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
                 <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-600 px-4 py-2 rounded-xl text-[10px] font-black border border-yellow-100">
                    <AlertTriangle size={14} /> หมายเหตุ: สามารถจองล่วงหน้าได้ไม่เกิน 15 วัน
                 </div>
                 <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-[10px] font-black border border-slate-200">
                    <Clock size={14} /> เปิดให้บริการ: จันทร์ - ศุกร์ (ปิดเสาร์-อาทิตย์ และนักขัตฤกษ์)
                 </div>
              </div>
              <div className="w-20 h-1.5 bg-blue-600 mx-auto mt-6 rounded-full"></div>
           </div>

           {/* Quick Action Button Above Calendar */}
           <div className="flex justify-end mb-8">
              {!firebaseUser && (
                <button 
                  onClick={signInWithGoogle}
                  className="px-8 py-4 bg-blue-50 text-blue-600 rounded-2xl font-black text-sm flex items-center gap-3 hover:bg-blue-100 transition-all border border-blue-100"
                >
                  <CalendarIcon size={18} />
                  เข้าสู่ระบบเพื่อทำการจอง
                </button>
              )}
           </div>

           <div className="bg-white rounded-[4rem] shadow-2xl shadow-blue-900/10 border-4 border-slate-50 overflow-hidden relative">
              {loadingBookings && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                   <div className="flex flex-col items-center gap-4">
                      <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-xs">กำลังซิงค์ข้อมูลกับฐานข้อมูล...</p>
                   </div>
                </div>
              )}

              <header className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between border-b border-slate-50 gap-6 bg-slate-50/30">
                 <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm">
                    <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-2xl transition-all"><ChevronLeft size={24} /></button>
                    <div className="px-8 font-black text-slate-700 text-lg sm:text-xl min-w-[220px] text-center">{format(currentMonth, 'MMMM yyyy', { locale: th })}</div>
                    <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-2xl transition-all"><ChevronRight size={24} /></button>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-xs font-black text-green-500 bg-green-50 px-4 py-2 rounded-xl border border-green-100"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> ห้องว่าง</div>
                    <div className="flex items-center gap-2 text-xs font-black text-red-500 bg-red-50 px-4 py-2 rounded-xl border border-red-100"><div className="w-2 h-2 bg-red-500 rounded-full" /> เต็ม</div>
                 </div>
              </header>

              <div className="grid grid-cols-7 bg-white py-6 border-b border-slate-50">
                {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => <div key={d} className="text-center text-[10px] sm:text-xs font-black text-slate-300 uppercase tracking-widest">{d}</div>)}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map(day => {
                  const currentDayBookers = getDayBookings(day);
                  const bookedCount = currentDayBookers.length;
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonthDay = isSameMonth(day, monthStart);
                  const isAllowed = !isBefore(startOfDay(day), today) && !isAfter(startOfDay(day), maxDate) && isOperationalDay(day);

                  return (
                    <div 
                      key={day.toString()} 
                      onClick={() => isAllowed && handleDateClick(day)}
                      className={`min-h-[140px] sm:min-h-[180px] p-4 border-r border-b border-slate-50 transition-all relative flex flex-col ${!isCurrentMonthDay ? 'bg-slate-50/20 opacity-10 pointer-events-none' : ''} ${!isAllowed ? 'opacity-10 cursor-not-allowed grayscale pointer-events-none' : 'cursor-pointer group hover:bg-blue-50/30'}`}
                    >
                      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg mb-4 transition-all ${isToday ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 ring-4 ring-blue-50' : isAllowed ? 'text-[#1A1A1A] group-hover:text-blue-600 group-hover:scale-110' : 'text-[#D1D5DB]'}`}>{format(day, 'd')}</span>
                      
                      <div className="flex-1 space-y-2">
                        {isAllowed && isCurrentMonthDay && (
                           bookedCount >= 9 ? (
                              <div className="bg-red-50 text-red-500 rounded-xl px-2 py-1 text-[10px] font-black border border-red-100 text-center">เต็มทุกช่วง</div>
                           ) : bookedCount > 0 ? (
                              <div className="bg-blue-50 text-blue-600 rounded-xl px-2 py-1 text-[10px] font-black border border-blue-100 text-center italic">จองแล้ว {bookedCount}/9</div>
                           ) : (
                              <div className="bg-green-50 text-green-600 rounded-xl px-2 py-1 text-[10px] font-black border border-green-100 text-center opacity-0 group-hover:opacity-100">ว่าง (จองเลย)</div>
                           )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
           </div>

           {/* CTA Below Calendar (Only for Guests) */}
           {!firebaseUser && (
              <div className="mt-16 bg-blue-50 rounded-[3rem] p-12 text-center border-4 border-blue-100/50 shadow-xl shadow-blue-900/5 animate-in fade-in zoom-in duration-1000">
                 <h3 className="text-3xl font-black text-blue-900 mb-6">ยังไม่ได้เป็นสมาชิกยังใช่ไหม?</h3>
                 <p className="text-blue-600 font-bold text-xl mb-10 max-w-lg mx-auto leading-relaxed">ลงทะเบียนฟรีวันนี้ เพื่อรับสิทธิ์เข้าถึงระบบการจองที่รวดเร็ว และติดตามข่าวสารโครงการใหม่ๆ ก่อนใคร</p>
                 <button 
                  onClick={signInWithGoogle}
                  className="px-16 py-8 bg-blue-600 text-white rounded-[2.5rem] text-2xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-105 transition-all flex items-center mx-auto gap-4 group"
                 >
                    <UserPlus size={32} className="group-hover:rotate-12 transition-transform" />
                    สมัครสมาชิกที่นี่
                    <ArrowRight size={32} className="group-hover:translate-x-2 transition-transform" />
                 </button>
              </div>
           )}

           {/* CTA for Logged-in Users */}
           {firebaseUser && (
              <div className="mt-16 text-center animate-bounce duration-[5000ms]">
                <p className="text-slate-400 font-bold mb-6 italic">พบช่วงเวลาที่ต้องการ? อย่ารอช้า คว้าสิทธิ์นั้นไว้ก่อนใคร!</p>
                <button 
                  onClick={() => router.push(user ? "/dashboard" : "/register")}
                  className="px-12 py-6 bg-slate-900 text-white rounded-3xl text-xl font-black shadow-2xl hover:scale-105 transition-all flex items-center mx-auto gap-3"
                >
                   <LayoutDashboard className="text-blue-500" />
                   {user ? "เข้าสู่หน้าจัดการการจอง" : "ดำเนินการสมัครสมาชิกต่อ"}
                   <ArrowRight />
                </button>
              </div>
           )}
        </div>
      </section>

      {/* Features Overview */}
      <section className="py-24 bg-slate-50 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
           <FeatureCard icon={<Smartphone className="w-10 h-10" />} title="จองผ่านมือถือ" desc="เข้าถึงระบบได้ง่ายทุกที่ จากมือถือของคุณเอง" />
           <FeatureCard icon={<CalendarIcon className="w-10 h-10" />} title="ตารางออนไลน์" desc="เช็คเวลาว่างได้แบบสดๆ อัปเดตรายวินาที" />
           <FeatureCard icon={<QrCode className="w-10 h-10" />} title="QR Code ยืนยัน" desc="รับรหัสทันใจหลังจองเสร็จ เพื่อความรวดเร็วที่หน้างาน" />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-24 text-white px-4 border-t border-white/5">
         <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-16">
            <div className="lg:col-span-2">
               <h3 className="text-3xl font-black mb-8 underline decoration-blue-600 decoration-8">Rec Center Phayao</h3>
               <p className="text-slate-400 font-bold text-lg max-w-sm mb-12">เราไม่ใช่แค่ห้องนันทนาการ แต่คือศูนย์รวมสุขภาพที่ดีของชาวพะเยา</p>
               <div className="flex gap-4">
                  {[Phone, Mail, MapPin].map((Icon, i) => <div key={i} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-blue-600 transition-all cursor-pointer"><Icon size={20} /></div>)}
               </div>
            </div>
            <div>
               <h4 className="text-blue-500 font-black uppercase tracking-widest text-xs mb-8">โครงการโดย</h4>
               <p className="font-black text-xl italic leading-tight">องค์การบริหารส่วนจังหวัดพะเยา</p>
               <p className="text-slate-500 font-bold mt-4">กรมการปกครองส่วนท้องถิ่น</p>
            </div>
            <div>
               <h4 className="text-blue-500 font-black uppercase tracking-widest text-xs mb-8">ที่อยู่</h4>
               <p className="text-slate-400 font-bold text-sm">เลขที่ 1 ถนนพหลโยธิน ต.เวียง <br /> อ.เมือง จ.พะเยา 56000</p>
            </div>
         </div>
      </footer>

      {/* Read-Only Modal for Public Viewer */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
              <header className="p-12 bg-gradient-to-br from-blue-700 to-blue-900 text-white relative">
                 <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X size={24} /></button>
                 <div className="flex items-center gap-3 mb-2 opacity-80 font-black uppercase tracking-[0.2em] text-[10px]">ตรวจสอบตารางประจำวัน</div>
                 <h2 className="text-4xl font-extrabold">{format(selectedDate, 'eeee d MMMM', { locale: th })}</h2>
              </header>
              <div className="p-10 max-h-[60vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
                 <div className="grid grid-cols-1 gap-4">
                   {timeSlots.map((time) => {
                     const isBooked = isSlotBooked(selectedDate, time);
                     return (
                       <div key={time} className={`flex items-center justify-between p-7 rounded-[2.5rem] border-4 transition-all ${isBooked ? 'bg-red-50 border-red-100' : 'bg-white border-blue-50 hover:border-blue-200 shadow-sm'}`}>
                          <div className="flex items-center gap-6">
                             <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl ${isBooked ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-600'}`}>{time}</div>
                             <p className="font-black text-slate-800 text-xl">{time} - {parseInt(time)+1}:00 น.</p>
                          </div>
                          {isBooked ? (
                             <div className="bg-red-50 text-red-500 px-6 py-2 rounded-2xl font-black text-sm uppercase tracking-widest border border-red-100 italic">ไม่ว่าง</div>
                          ) : 
                            (firebaseUser && user ? 
                              <button onClick={() => router.push("/dashboard")} className="px-10 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100">จอง</button> :
                              <button onClick={handleActionClick} className="px-8 py-3.5 bg-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-800 hover:text-white transition-all shadow-sm flex items-center gap-2">
                                 <Info size={14} />
                                 เข้าสู่ระบบ
                              </button>
                            )
                          }
                       </div>
                     );
                   })}
                 </div>
              </div>
              <footer className="p-8 bg-white border-t border-slate-50 text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phayao Provincial Administrative Organization</p>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
}

function FeatureCard({icon, title, desc}: any) {
  return (
    <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-blue-900/5 hover:-translate-y-2 transition-all border border-slate-100 group">
      <div className="text-blue-600 mb-8 bg-blue-50 w-20 h-20 flex items-center justify-center rounded-3xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500 shadow-inner">{icon}</div>
      <h3 className="text-2xl font-black text-slate-800 mb-4">{title}</h3>
      <p className="text-slate-500 font-bold leading-relaxed">{desc}</p>
    </div>
  );
}
