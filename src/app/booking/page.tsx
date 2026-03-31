"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  CalendarCheck
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  Timestamp, 
  orderBy 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, addHours, startOfDay, endOfDay, isBefore, parse, isAfter } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function BookingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(1); // 1 or 2 hours
  const [existingBookings, setExistingBookings] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  const timeSlots = [
    "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetchBookingsForDate();
  }, [selectedDate]);

  const fetchBookingsForDate = async () => {
    setChecking(true);
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateStart = startOfDay(new Date(y, m - 1, d));
      const dateEnd = endOfDay(new Date(y, m - 1, d));
      
      const q = query(
        collection(db, "bookings"),
        where("startTime", ">=", Timestamp.fromDate(dateStart)),
        where("startTime", "<=", Timestamp.fromDate(dateEnd)),
        orderBy("startTime", "asc")
      );
      
      const querySnapshot = await getDocs(q);
      const bookings = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: (doc.data().startTime as Timestamp).toDate(),
        end: (doc.data().endTime as Timestamp).toDate()
      }));
      setExistingBookings(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setChecking(false);
    }
  };

  const checkOverlap = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const [h, min] = startTime.split(':').map(Number);
    const start = new Date(y, m - 1, d, h, min);
    const end = addHours(start, duration);

    // Limit check: cannot book past 17:00
    const limitTime = new Date(`${selectedDate}T17:00:00`);
    if (isAfter(end, limitTime)) {
      return "ไม่สามารถจองเกินเวลา 17:00 น. ได้";
    }

    // Overlap check
    for (const booking of existingBookings) {
      if (
        (start >= booking.start && start < booking.end) ||
        (end > booking.start && end <= booking.end) ||
        (start <= booking.start && end >= booking.end)
      ) {
        return "ไม่อนุญาตให้จองเวลาซ้อนกับผู้อื่น";
      }
    }

    // Past time check
    if (isBefore(start, new Date())) {
      return "ไม่สามารถจองเวลาย้อนหลังได้";
    }

    return null;
  };

  const handleBooking = async () => {
    const error = checkOverlap();
    if (error) {
      setErrorMessage(error);
      setBookingStatus('error');
      return;
    }

    setBookingStatus('loading');
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const [h, min] = startTime.split(':').map(Number);
      const start = new Date(y, m - 1, d, h, min);
      const end = addHours(start, duration);

      await addDoc(collection(db, "bookings"), {
        userId: user?.uid,
        userName: user?.displayName,
        memberId: user?.memberId,
        startTime: Timestamp.fromDate(start),
        endTime: Timestamp.fromDate(end),
        duration: duration,
        status: "confirmed",
        createdAt: Timestamp.now()
      });

      setBookingStatus('success');
      setTimeout(() => {
        router.push("/history");
      }, 2000);
    } catch (error) {
      console.error("Booking error:", error);
      setErrorMessage("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      setBookingStatus('error');
    }
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
             <CalendarCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#112D4E]">จองห้องนันทนาการ</h1>
            <p className="text-slate-500 font-medium">กรุณาระบุวันและเวลาที่ต้องการเข้าใช้งาน</p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-blue-100/50 p-6 sm:p-10 border border-slate-50 space-y-8">
           {/* Date Selection */}
           <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon size={16} className="text-blue-500" />
                เลือกวันที่
              </label>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-700 font-semibold focus:border-blue-500 focus:outline-none transition-all cursor-pointer"
              />
           </div>

           {/* Time Selection */}
           <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                เลือกเวลาเริ่ม (เปิด 08:00 - 17:00 น.)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setStartTime(time)}
                    className={`py-3 rounded-2xl font-bold transition-all border-2 ${
                      startTime === time 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
           </div>

           {/* Duration Selection */}
           <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} className="text-blue-500" />
                ระยะเวลาใช้ห้อง
              </label>
              <div className="flex gap-4">
                {[1, 2].map((h) => (
                  <button
                    key={h}
                    onClick={() => setDuration(h)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all border-2 ${
                      duration === h 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                        : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50'
                    }`}
                  >
                    {h} ชั่วโมง
                  </button>
                ))}
              </div>
           </div>

           {/* Status Info / Error Message */}
           {bookingStatus === 'error' && (
             <div className="bg-red-50 text-red-500 p-4 rounded-2xl flex items-center gap-3 animate-shake border border-red-100">
                <AlertCircle size={20} />
                <p className="font-semibold text-sm">{errorMessage}</p>
             </div>
           )}

           {bookingStatus === 'success' && (
             <div className="bg-green-50 text-green-600 p-4 rounded-2xl flex items-center gap-3 border border-green-100">
                <CheckCircle2 size={20} />
                <p className="font-semibold text-sm">จองที่สำเร็จ! กำลังพาท่านไปหน้าประวัติ...</p>
             </div>
           )}

           {/* Submit Button */}
           <button
            disabled={bookingStatus === 'loading' || bookingStatus === 'success'}
            onClick={handleBooking}
            className="w-full bg-blue-600 text-white py-5 rounded-3xl font-bold text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:scale-[0.98] transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-3"
           >
             {bookingStatus === 'loading' ? (
               <>
                 <Loader2 className="animate-spin" />
                 <span>กำลังประมวลผล...</span>
               </>
             ) : (
               <>
                 <CalendarCheck size={22} />
                 <span>ยืนยันการจอง</span>
               </>
             )}
           </button>
        </div>

        {/* Existing Bookings for current date */}
        <div className="mt-10">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">ตารางการจองวันนี้</h3>
          <div className="space-y-2">
            {checking ? (
               <div className="p-4 flex items-center justify-center text-slate-400">
                 <Loader2 size={16} className="animate-spin mr-2" />
                 <span className="text-xs font-medium">กำลังตรวจสอบที่ว่าง...</span>
               </div>
            ) : existingBookings.length === 0 ? (
               <div className="p-8 bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                  <p className="text-slate-400 font-medium text-sm">ยังไม่มีการจองในวันนี้</p>
               </div>
            ) : (
              existingBookings.map((b) => (
                <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                       <Clock size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-700">{format(b.start, 'HH:mm')} - {format(b.end, 'HH:mm')} น.</p>
                      <p className="text-xs text-slate-400 font-medium tracking-tight">คุณ {b.userName?.split(' ')[0]}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-red-50 text-red-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    ไม่ว่าง
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
