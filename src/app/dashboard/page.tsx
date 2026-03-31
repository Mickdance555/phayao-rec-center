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
  isAfter,
  addDays
} from "date-fns";
import { th } from "date-fns/locale";
import { 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Loader2,
  X,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  User as UserIcon,
  Phone,
  LayoutDashboard
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp, 
  addDoc,
  orderBy, 
  limit,
  onSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isOperationalDay } from "@/lib/holidays";

export default function DashboardPage() {
  const { user, firebaseUser, loading: authLoading, signInWithGoogle, logout } = useAuth();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [duration, setDuration] = useState(1);
  const [groupType, setGroupType] = useState("สมาชิกทั่วไป");
  const [groupName, setGroupName] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(true);
  const [step, setStep] = useState(1); // 1: Select Time, 2: Attendees Info
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // Attendees info
  const [attendees, setAttendees] = useState<any[]>([]);

  useEffect(() => {
    if (user && attendees.length === 0) {
      setAttendees([{ name: user.fullName, phone: user.phone || "", isMember: true }]);
    }
  }, [user]);

  const handleAcceptRules = () => {
    setShowRulesModal(false);
  };

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"
  ];

  useEffect(() => {
    if (!authLoading) {
      if (!firebaseUser) {
        router.push("/");
      } else if (!user) {
        router.push("/register");
      }
    }
  }, [firebaseUser, user, authLoading, router]);

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

  const calculateMaxBusinessDate = (days: number) => {
    let count = 0;
    let d = new Date();
    // Safety limit to avoid infinite loop
    for (let i = 0; i < 60; i++) {
       d = addDays(d, 1);
       if (isOperationalDay(d)) {
          count++;
          if (count === days) break;
       }
    }
    return startOfDay(d);
  };

  const today = startOfDay(new Date());
  const maxDate = calculateMaxBusinessDate(15);

  const handleDateClick = (date: Date) => {
    const clickedDate = startOfDay(date);
    if (isBefore(clickedDate, today) || isAfter(clickedDate, maxDate) || !isOperationalDay(clickedDate)) {
      return; // Non-selectable
    }
    setSelectedDate(date);
    setStep(1);
    setDuration(1);
    setIsModalOpen(true);
  };

  const getDayBookings = (date: Date) => bookings.filter((b: any) => isSameDay(b.start, date) && b.status !== 'cancelled');
  const getUserDayBookings = (date: Date) => bookings.filter((b: any) => isSameDay(b.start, date) && b.status !== 'cancelled' && b.userId === user?.uid);
  const isSlotBooked = (date: Date, timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = addHours(slotStart, 1);
    return getDayBookings(date).some((b: any) => (slotStart >= b.start && slotStart < b.end) || (slotEnd > b.start && slotEnd <= b.end));
  };

  const addAttendeeField = () => {
    setAttendees([...attendees, { name: "", phone: "", isMember: false }]);
  };

  const removeAttendeeField = (index: number) => {
    if (attendees.length <= 1) return;
    const newAttendees = [...attendees];
    newAttendees.splice(index, 1);
    setAttendees(newAttendees);
  };

  const updateAttendee = (index: number, field: string, value: string) => {
    const newAttendees = [...attendees];
    newAttendees[index][field] = value;
    setAttendees(newAttendees);
  };

  const handleConfirmBooking = async () => {
    if (!user) return;

    if (user.status === 'suspended') {
      const now = new Date();
      const until = user.suspendedUntil?.toDate();
      if (until && now < until) {
        alert(`ขออภัย บัญชีของคุณถูกระงับการใช้งานจนถึงวันที่ ${format(until, 'd MMMM yyyy HH:mm', { locale: th })} กรุณาติดต่อเจ้าหน้าที่หากมีข้อสงสัย`);
        return;
      }
    }

    if (!selectedDate || !selectedTime) return;

    // Check if user already booked more than 2 hours today
    const userTodayBookings = getUserDayBookings(selectedDate);
    const alreadyBookedHours = userTodayBookings.reduce((acc, b) => acc + (b.duration || 1), 0);
    
    if (alreadyBookedHours + duration > 2) {
       alert(`ขออภัย คุณสามารถจองได้ไม่เกิน 2 ชั่วโมงต่อวัน (คุณจองไปแล้ว ${alreadyBookedHours} ชม.)`);
       setIsBookingLoading(false);
       return;
    }

    if (!isOperationalDay(selectedDate)) {
      alert("ขออภัย ห้องนันทนาการเปิดให้บริการเฉพาะวันจันทร์-ศุกร์ ยกเว้นวันหยุดนักขัตฤกษ์");
      return;
    }

    // Validation
    const hasEmpty = attendees.some(at => !at.name.trim() || !at.phone.trim());
    if (hasEmpty) {
      alert("กรุณากรอกข้อมูลผู้ร่วมงานให้ครบถ้วน");
      return;
    }

    setIsBookingLoading(true);
    try {
      // 1. Check member status for each attendee
      const verifiedAttendees = await Promise.all(attendees.map(async (at) => {
         // Query users collection for this name
         const q = query(collection(db, "users"), where("fullName", "==", at.name.trim()));
         const snap = await getDocs(q);
         return {
            ...at,
            isMember: !snap.empty,
            name: at.name.trim(),
            phone: at.phone.trim()
         };
      }));

      const [h, m] = selectedTime.split(':').map(Number);
      const start = new Date(selectedDate);
      start.setHours(h, m, 0, 0);
      const end = addHours(start, duration);

      if (isSlotBooked(selectedDate, selectedTime)) { 
        alert("ขออภัย เวลานี้ถูกจองไปแล้วในขณะที่คุณกำลังทำรายการ"); 
        setIsModalOpen(false);
        return; 
      }

      // If duration is 2, double check the next slot hasn't been taken
      if (duration === 2) {
         const nextHour = `${(h+1).toString().padStart(2, '0')}:00`;
         if (isSlotBooked(selectedDate, nextHour)) {
            alert("ขออภัย ไม่สามารถจอง 2 ชม. ได้เนื่องจากช่วงเวลาถัดไปไม่ว่าง");
            setDuration(1);
            setIsBookingLoading(false);
            return;
         }
      }

      await addDoc(collection(db, "bookings"), {
        userId: user.uid, 
        userName: user.fullName, 
        memberId: user.memberId,
        startTime: Timestamp.fromDate(start), 
        endTime: Timestamp.fromDate(end),
        duration: duration, 
        groupType: groupType,
        groupName: groupName,
        status: "confirmed", 
        createdAt: Timestamp.now(),
        attendees: verifiedAttendees,
        totalAttendees: verifiedAttendees.length
      });

      setIsModalOpen(false);
      setStep(1);
      setGroupType("สมาชิกทั่วไป");
      setGroupName("");
      // Reset attendees to just the user
      setAttendees([{ name: user.fullName, phone: user.phone || "", isMember: true }]);
    } catch (error) { 
      console.error("Booking error:", error);
      alert("เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง");
    } finally { 
      setIsBookingLoading(false); 
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(endOfMonth(monthStart)) });

  if (authLoading || !firebaseUser || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-12 sm:px-6 lg:px-8 mt-16 animate-in fade-in duration-700">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
             <div>
                <h1 className="text-4xl font-black text-slate-900 mb-2 underline decoration-blue-600 decoration-8 underline-offset-8 text-nowrap">ระบบจองห้องนันทนาการ</h1>
                <p className="text-slate-500 font-bold text-lg">สวัสดีคุณ <span className="text-blue-600">{user.fullName}</span> | รหัสสมาชิก: <span className="text-slate-700">{user.memberId}</span></p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                   <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-600 px-4 py-2 rounded-xl text-xs font-black border border-yellow-100">
                      <AlertTriangle size={14} /> หมายเหตุ: สามารถจองล่วงหน้าได้ไม่เกิน 15 วัน
                   </div>
                   <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-black border border-slate-200">
                      <Clock size={14} /> เปิดให้บริการ: จันทร์ - ศุกร์ (ปิดเสาร์-อาทิตย์ และนักขัตฤกษ์)
                   </div>
                </div>
             </div>
             <div className="flex gap-4">
                <Link href="/history" className="flex items-center gap-3 bg-white px-8 py-5 rounded-3xl font-black text-slate-700 shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                   <Clock size={20} className="text-blue-500" />
                   ดูประวัติการจอง
                </Link>
             </div>
          </div>

          <section className="bg-white rounded-[4rem] shadow-2xl shadow-blue-900/5 border-4 border-white overflow-hidden">
             <header className="p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between border-b border-slate-50 gap-6 bg-slate-50/50">
                <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200 rotate-3"><CalendarIcon size={28} /></div>
                   <div>
                      <h2 className="text-2xl font-black text-slate-800">{format(currentMonth, 'MMMM yyyy', { locale: th })}</h2>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">เช็คเวลาว่างและเลือกวันที่ต้องการ</p>
                   </div>
                </div>
                <div className="flex bg-white p-2 rounded-[2rem] border border-slate-100 shadow-inner">
                   <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-2xl transition-all"><ChevronLeft size={24} /></button>
                   <button onClick={() => setCurrentMonth(new Date())} className="px-6 py-2 text-sm font-black text-slate-500 hover:text-blue-600">เดือนนี้</button>
                   <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-2xl transition-all"><ChevronRight size={24} /></button>
                </div>
             </header>

             <div className="grid grid-cols-7 bg-white py-6 border-b border-slate-50">
               {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map(day => <div key={day} className="text-center text-xs font-black text-slate-300 uppercase tracking-widest">{day}</div>)}
             </div>
             <div className="grid grid-cols-7">
               {calendarDays.map(day => {
                  const currentDayBookers = getDayBookings(day);
                  const bookedCount = currentDayBookers.length;
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonthDay = isSameMonth(day, monthStart);
                  const isOp = isOperationalDay(day);
                  const isAllowed = !isBefore(startOfDay(day), today) && !isAfter(startOfDay(day), maxDate) && isOp;
                  return (
                    <div 
                      key={day.toString()} 
                      onClick={() => isAllowed && handleDateClick(day)} 
                      className={`min-h-[160px] p-4 border-r border-b border-slate-50 transition-all relative flex flex-col ${!isCurrentMonthDay ? 'bg-slate-50/20 opacity-20 pointer-events-none' : ''} ${!isOp && isCurrentMonthDay ? 'bg-slate-100/50 opacity-60 grayscale cursor-not-allowed' : !isAllowed && isCurrentMonthDay ? 'bg-slate-50 opacity-30 cursor-not-allowed grayscale' : 'bg-white cursor-pointer group hover:bg-blue-50/50 active:scale-[0.98]'}`}
                    >
                       <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg mb-4 transition-all ${isToday ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 ring-4 ring-blue-50' : isAllowed ? 'text-slate-900 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-sm' : 'text-slate-300'}`}>{format(day, 'd')}</span>
                       <div className="flex-1 space-y-1">
                          {!isOp && isCurrentMonthDay ? (
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic leading-tight">ปิดให้บริการ</div>
                          ) : isAllowed && bookedCount > 0 ? (
                             <div className="bg-red-50 text-red-500 rounded-xl px-3 py-1.5 text-[10px] sm:text-xs font-black border border-red-100 self-start shadow-sm">จองแล้ว {bookedCount}/9</div>
                          ) : isAllowed && isCurrentMonthDay ? (
                             <div className="bg-green-50 text-green-600 rounded-xl px-3 py-1.5 text-[10px] sm:text-xs font-black border border-green-100 self-start opacity-0 group-hover:opacity-100 transition-opacity">ห้องว่าง จองทันที</div>
                          ) : null}
                       </div>
                    </div>
                  );
               })}
             </div>
          </section>
      </main>

       {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className={`bg-white w-full ${step === 1 ? 'max-w-lg' : 'max-w-2xl'} rounded-[4rem] shadow-2xl relative overflow-hidden transition-all duration-500`}>
              <header className="p-10 bg-gradient-to-br from-blue-700 to-blue-900 text-white relative">
                 <button onClick={() => setIsModalOpen(false)} className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"><X size={24} /></button>
                 <div className="flex items-center gap-3 mb-2 opacity-80 font-black uppercase tracking-widest text-xs">
                    {step === 1 ? 'Phayao Rec Center Schedule' : 'กรอกข้อมูลผู้เข้าใช้งาน'}
                 </div>
                 <h2 className="text-3xl font-extrabold">{format(selectedDate, 'eeee d MMMM', { locale: th })}</h2>
              </header>

              <div className="p-8 sm:p-10 max-h-[70vh] overflow-y-auto custom-scrollbar bg-slate-50/50">
                 {step === 1 ? (
                   <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                     {timeSlots.map((time) => {
                       const isBooked = isSlotBooked(selectedDate, time);
                       const isPast = isBefore(addHours(startOfDay(selectedDate), parseInt(time)), new Date());
                       return (
                         <div key={time} className={`flex items-center justify-between p-7 rounded-[2.5rem] border-4 transition-all ${isBooked ? 'bg-red-50 border-red-100' : isPast ? 'bg-slate-100 border-slate-200 opacity-60' : 'bg-white border-blue-50 hover:border-blue-200 shadow-sm'}`}>
                            <div className="flex items-center gap-6">
                               <div className={`w-16 h-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-inner ${isBooked ? 'bg-red-100 text-red-500' : isPast ? 'bg-slate-200 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>{time}</div>
                               <p className="font-black text-slate-800 text-xl">{time} - {parseInt(time)+1}:00 น.</p>
                            </div>
                            {isBooked ? <span className="text-red-500 font-black text-sm uppercase tracking-widest mr-4">ไม่ว่าง</span> : isPast ? <span className="text-slate-400 font-black text-sm uppercase tracking-widest mr-4">เลยเวลา</span> : 
                              <button onClick={() => { setSelectedTime(time); setStep(2); }} className="px-10 py-4 bg-blue-600 text-white rounded-3xl font-black text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100">จอง</button>
                            }
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                       <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <Clock className="text-blue-600" />
                             <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">เวลาที่จอง</p>
                                <p className="text-xl font-black text-blue-900">
                                   {selectedTime} - {parseInt(selectedTime || "0") + duration}:00 น. 
                                   <span className="ml-2 text-sm text-blue-400 font-bold">({duration} ชม.)</span>
                                </p>
                             </div>
                          </div>
                          <button onClick={() => setStep(1)} className="text-blue-600 font-black text-sm hover:underline">เปลี่ยนเวลา</button>
                       </div>

                       <div className="space-y-4">
                          <p className="font-black text-slate-800 uppercase tracking-widest text-sm px-4">เลือกระยะเวลาการใช้งาน</p>
                          <div className="flex gap-4 p-2 bg-white rounded-3xl border border-slate-100 shadow-inner">
                             {[1, 2].map((d) => {
                                // Check if next slot is available for 2hr option
                                const h = parseInt(selectedTime || "0");
                                const nextSlotBooked = d === 2 && isSlotBooked(selectedDate, `${(h+1).toString().padStart(2, '0')}:00`);
                                const isFinalSlot = d === 2 && h >= 16; // 16:00 is the last slot

                                return (
                                   <button
                                      key={d}
                                      disabled={nextSlotBooked || isFinalSlot}
                                      onClick={() => setDuration(d)}
                                      className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm transition-all flex flex-col items-center gap-1 ${duration === d ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-slate-400 hover:text-slate-600'} ${(nextSlotBooked || isFinalSlot) ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                                   >
                                      <span>{d} ชั่วโมง</span>
                                      {(nextSlotBooked || isFinalSlot) && <span className="text-[8px] opacity-70">ถัดไปไม่ว่าง</span>}
                                   </button>
                                );
                             })}
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div className="bg-white p-8 rounded-[2.5rem] border border-blue-50 shadow-sm space-y-6">
                             <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">ประเภทกลุ่มผู้ใช้งาน</label>
                                <select 
                                   value={groupType}
                                   onChange={(e) => setGroupType(e.target.value)}
                                   className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-blue-600 transition-all cursor-pointer"
                                >
                                   <option>สมาชิกทั่วไป</option>
                                   <option>สมาชิกทีม/ชมรม (ระบุชื่อ)</option>
                                   <option>กิจกรรมหน่วยงาน (ระบุชื่อ)</option>
                                   <option>อื่นๆ</option>
                                </select>
                             </div>

                             {(groupType === "สมาชิกทีม/ชมรม (ระบุชื่อ)" || groupType === "กิจกรรมหน่วยงาน (ระบุชื่อ)") && (
                                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">ชื่อทีม / กิจกรรม / ชมรม</label>
                                   <input 
                                      type="text" 
                                      placeholder="ตัวอย่าง: ทีมพะเยาเอฟซี / ชมรมหมากล้อม"
                                      value={groupName}
                                      onChange={(e) => setGroupName(e.target.value)}
                                      className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-50 rounded-2xl outline-none font-bold text-slate-700 focus:bg-white focus:border-blue-600 transition-all"
                                   />
                                </div>
                             )}
                          </div>

                          <div className="flex items-center justify-between font-black text-slate-800 uppercase tracking-widest text-sm px-4">
                             <span>ผู้เข้าใช้งาน ({attendees.length})</span>
                            <button onClick={addAttendeeField} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-all text-xs">
                               <Plus size={14} /> เพิ่มรายชื่อ
                            </button>
                         </div>

                         <div className="space-y-4">
                            {attendees.map((at, idx) => (
                               <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group animate-in slide-in-from-left-4 duration-300">
                                  {idx > 0 && (
                                    <button onClick={() => removeAttendeeField(idx)} className="absolute -top-2 -right-2 w-8 h-8 bg-red-50 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-red-100 shadow-sm"><X size={14} /></button>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                                           <UserIcon size={12} /> ชื่อ-นามสกุล
                                        </div>
                                        <input 
                                          type="text" 
                                          placeholder="ระบุชื่อจริง"
                                          value={at.name}
                                          onChange={(e) => updateAttendee(idx, 'name', e.target.value)}
                                          className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-200 outline-none font-bold text-slate-700 focus:bg-white transition-all"
                                          disabled={idx === 0}
                                        />
                                     </div>
                                     <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
                                           <Phone size={12} /> เบอร์โทรศัพท์
                                        </div>
                                        <input 
                                          type="tel" 
                                          placeholder="08xxxxxxxx"
                                          value={at.phone}
                                          maxLength={10}
                                          onChange={(e) => updateAttendee(idx, 'phone', e.target.value.replace(/\D/g, ''))}
                                          className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl focus:border-blue-200 outline-none font-bold text-slate-700 focus:bg-white transition-all"
                                          disabled={idx === 0}
                                        />
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>

                      <button 
                        disabled={isBookingLoading}
                        onClick={handleConfirmBooking}
                        className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] text-2xl font-black shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-4"
                      >
                         {isBookingLoading ? <Loader2 className="animate-spin" size={32} /> : <><span>ยืนยันการจอง</span> <ArrowRight size={32} /></>}
                      </button>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
      {/* Rules & Regulations Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-500">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
              <header className="p-10 bg-blue-600 text-white">
                 <div className="flex items-center gap-3 mb-6 font-black uppercase tracking-widest text-xl">ระเบียบการเข้าใช้บริการ</div>
                 <h2 className="text-3xl font-black leading-tight">ห้องกิจกรรมนันทนาการเปิดให้บริการตั้งแต่วันจันทร์ถึงวันศุกร์ 8:00 น. - 17:00 น.</h2>
              </header>
              
              <div className="p-10 overflow-y-auto custom-scrollbar flex-1">
                 <div className="space-y-6 text-slate-600 font-bold leading-relaxed">
                    <p className="text-slate-900 text-lg">โปรดอ่านและยอมรับข้อกำหนดการเข้าใช้งานดังนี้:</p>
                    
                    <ul className="space-y-4">
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">1</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการสามารถจองได้ 1-2 ชั่วโมงต่อ 1 วัน</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">2</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการสามารถยกเลิกการก่อนที่จะถึงเวลาที่จองไว้ล่วงหน้า 6 ชั่วโมง</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">3</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการสามารถเลือกวันจองล่วงหน้าได้สูงสุด 15 วัน(วันทำการของห้องกิจกรรมนันทนาการ)</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">4</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการเมื่อจะเข้ามาใช้งานห้องกิจกรรมนันทนาการตามเวลาที่จองไว้จะต้องแสกน QR code กับเจ้าหน้าที่ เพื่อทำการ Check-in เข้าใช้งานห้องกิจกรรมนันทนาการทุกครั้ง</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">5</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการเมื่อสิ้นสุดการใช้งานห้องกิจกรรมนันทนาการตามเวลาที่ได้จองไว้แล้วจะต้องทำการแสกน QR code อีกครั้งเพื่อทำการ Check-out จากห้องกิจกรรมนันทนาการทุกครั้ง</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black">6</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการเมื่อเข้ามาใช้บริการห้องกิจกรรมนันทนาการ จะต้องแต่งกายสุภาพเรียบร้อย <span className="text-red-500 font-extrabold">ไม่สวมกางเกงขาสั้น กระโปรงสั้น หรือสวมรองเท้าเข้ามาในพื้นที่ห้องกิจกรรมนันทนาการโดยเด็ดขาด</span> หากไม่ปฏิบัติตามจะถือว่าฝ่าฝืนข้อกำหนดจะถูกลงโทษ <span className="text-red-600 underline">ระงับการจอง 7 วัน</span></p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black">7</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการจะต้องรักษาความสะอาดและดูแลรักษาทรัพสินย์ของห้องกิจกรรมนันทนาการ <span className="text-red-500 font-extrabold">ไม่ทำลายทรัพย์สินของทางห้องกิจกรรมนันทนาการโดยเด็ดขาด หากเกิดความเสียหายจะดำเนินการตามกฏหมายอย่างถึงที่สุด</span> ไม่สร้างความสกปรก ทิ้งขยะทุกครั้งก่อนจบการใช้งานห้องกิจกรรมนันทนาการ หากไม่ปฏิบัติตามจะถือว่าฝ่าฝืนข้อกำหนดจะถูกลงโทษ <span className="text-red-600 underline">ระงับการจอง 1 เดือน</span></p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">8</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการโปรดดูแลทรัพย์สินมีค่าของท่าน หากกรณีทรัพย์สินมีค่าของท่านสูญหาย ทางห้องกิจกรรมนันทนาการจะไม่รับผิดชอบต่อการสูญหายหรือเสียหายทุกกรณี</p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black">9</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการจะต้อง <span className="text-red-500 font-extrabold">ไม่นำอาหารและเครื่องดื่มเข้ามาในพื้นที่ห้องกิจกรรมนันทนาการโดยเด็ดขาด</span> เพื่อความสะอาดเรียบร้อยของห้องกิจกรรมนันทนาการ หากพบเห็นจะถือว่าฝ่าฝืนข้อกำหนดจะถูกลงโทษ <span className="text-red-600 underline">ระงับการจอง 1 เดือน</span></p>
                       </li>
                       <li className="flex gap-4">
                          <span className="flex-shrink-0 w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center font-black">10</span>
                          <p>ผู้ใช้บริการห้องกิจกรรมนันทนาการจะต้องใช้งานห้องกิจกรรมนันทนาการเป็นไปโดยระเบียบเรียบร้อย <span className="text-red-500 font-extrabold">ไม่ก่อความวุ่นวาย ส่งเสียงดังรบกวนผู้อื่น หรือประพฤติกรรมอันไม่เหมาะสม</span> หากไม่ปฏิบัติตามจะถือว่าฝ่าฝืนข้อกำหนดจะถูกลงโทษ <span className="text-red-600 underline">ระงับการจอง 1 เดือน</span></p>
                       </li>
                    </ul>

                    <div className="mt-8 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 text-center text-blue-600 font-black">
                       ขอขอบคุณที่เลือกใช้บริการห้องกิจกรรมนันทนาการ อบจ.พะเยา และปฏิบัติตามข้อกำหนดของทางห้องกิจกรรมนันทนาการอย่างเคร่งครัด
                    </div>
                 </div>
              </div>
              
              <footer className="p-8 bg-white border-t border-slate-50">
                 <button
                    onClick={handleAcceptRules}
                    className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-xl shadow-2xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all"
                 >
                    รับทราบและยอมรับข้อกำหนด
                 </button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
}
