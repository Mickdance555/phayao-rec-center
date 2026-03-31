"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  ShieldCheck, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  User, 
  Clock, 
  MapPin, 
  Calendar,
  XCircle,
  Scan,
  History as HistoryIcon
} from "lucide-react";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, addMinutes, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Coordinates
  const CENTER_LAT = 19.2089;
  const CENTER_LNG = 99.8864;
  const MAX_DISTANCE = 500;

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  // State
  const [bookingData, setBookingData] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'checking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");
  const [todayStats, setTodayStats] = useState<{ total: number, checkedIn: number } | null>(null);
  const [manualId, setManualId] = useState("");
  const [isAdminAtLocation, setIsAdminAtLocation] = useState<boolean | 'loading'>('loading');
  const [isAdminTestMode, setIsAdminTestMode] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const canOperate = isAdminAtLocation === true || isAdminTestMode;

  useEffect(() => {
    if (status === 'scanning' || status === 'idle') {
      if (!navigator.geolocation) {
        setIsAdminAtLocation(false);
        return;
      }
      
      const checkLoc = () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const dist = getDistance(pos.coords.latitude, pos.coords.longitude, CENTER_LAT, CENTER_LNG);
            setIsAdminAtLocation(dist <= MAX_DISTANCE);
          },
          () => setIsAdminAtLocation(false),
          { enableHighAccuracy: true }
        );
      };

      checkLoc();
      const interval = setInterval(checkLoc, 10000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const fetchTodayStats = async () => {
    try {
      const dateStart = startOfDay(new Date());
      const dateEnd = endOfDay(new Date());
      
      const q = query(
        collection(db, "bookings"),
        where("startTime", ">=", Timestamp.fromDate(dateStart)),
        where("startTime", "<=", Timestamp.fromDate(dateEnd))
      );
      
      const querySnapshot = await getDocs(q);
      const bookings = querySnapshot.docs.map(doc => doc.data());
      setTodayStats({
        total: bookings.length,
        checkedIn: bookings.filter(b => b.status === 'checked-in').length
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualId.trim()) return;
    
    setStatus('checking');
    try {
      const dateStart = startOfDay(new Date());
      const dateEnd = endOfDay(new Date());
      
      const q = query(
        collection(db, "bookings"),
        where("memberId", "==", manualId.trim()),
        where("startTime", ">=", Timestamp.fromDate(dateStart)),
        where("startTime", "<=", Timestamp.fromDate(dateEnd)),
        where("status", "in", ["confirmed", "checked-in"]),
        orderBy("startTime", "asc"),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setErrorMessage("ไม่พบคิวจองที่สามารถเช็คอิน/เอาท์ได้ในขณะนี้");
        setStatus('error');
        return;
      }

      const bookingDoc = querySnapshot.docs[0];
      const booking = { id: bookingDoc.id, ...bookingDoc.data() } as any;
      const now = new Date();

      if (booking.status === 'confirmed') {
         const startTime = (booking.startTime as Timestamp).toDate();
         const endTime = (booking.endTime as Timestamp).toDate();
         const windowStart = addMinutes(startTime, -15);

         if (isBefore(now, windowStart)) {
            setErrorMessage(`ยังไม่ถึงเวลา (เปิดให้เข้าได้ตั้งแต่ ${format(windowStart, 'HH:mm')} น.)`);
            setStatus('error');
            return;
         }
         
         if (isAfter(now, endTime)) {
            setErrorMessage("คิวจองนี้หมดเวลาแล้ว");
            setStatus('error');
            return;
         }

         await updateDoc(doc(db, "bookings", booking.id), {
           status: 'checked-in',
           actualStartTime: Timestamp.now(),
           checkInTime: Timestamp.now()
         });
         setBookingData({ ...booking, type: 'check-in' });
      } else {
         await updateDoc(doc(db, "bookings", booking.id), {
           status: 'completed',
           actualEndTime: Timestamp.now(),
           checkOutTime: Timestamp.now()
         });
         setBookingData({ ...booking, type: 'check-out' });
      }

      setStatus('success');
      fetchTodayStats();
    } catch (error) {
       console.error(error);
       setErrorMessage("เกิดข้อผิดพลาดในการเข้าข้อมูล");
       setStatus('error');
    }
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push("/");
    }
    if (user?.role === 'admin') {
      fetchTodayStats();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (status === 'scanning') {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      
      const onScanSuccessLocal = (decodedText: string) => onScanSuccess(decodedText);
      const onScanFailureLocal = (error: any) => {};

      scanner.render(onScanSuccessLocal, onScanFailureLocal);
      scannerRef.current = scanner;
    } else if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [status]);

  async function onScanSuccess(decodedText: string) {
    if (status === 'checking') return;
    
    try {
      if (scannerRef.current) {
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
      
      setStatus('checking');
      
      const parts = decodedText.split(':');
      const bookingId = parts[0];
      const timestampBlock = parts[1] ? parseInt(parts[1]) : null;
      
      const currentBlock = Math.floor(Date.now() / 30000);
      
      if (!timestampBlock || Math.abs(timestampBlock - currentBlock) > 1) {
        setErrorMessage("QR Code หมดอายุหรือเป็นตัวอย่างภาพแคปหน้าจอ กรุณาใช้โค้ดสดจากแอปพลิเคชัน");
        setStatus('error');
        return;
      }

      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await getDoc(bookingRef);

      if (!bookingSnap.exists()) {
        setErrorMessage("ไม่พบบันทึกการจองนี้ในระบบ (Invalid ID)");
        setStatus('error');
        return;
      }

      const booking = { id: bookingSnap.id, ...bookingSnap.data() } as any;
      const now = new Date();
      const startTime = (booking.startTime as Timestamp).toDate();
      const endTime = (booking.endTime as Timestamp).toDate();

      if (booking.status === 'confirmed') {
        const windowStart = addMinutes(startTime, -15);
        if (isBefore(now, windowStart)) {
          setErrorMessage(`ยังไม่ถึงเวลาจอง (เช็คอินได้ตั้งแต่ ${format(windowStart, 'HH:mm')} น.)`);
          setStatus('error');
          return;
        }
        
        if (isAfter(now, endTime)) {
          setErrorMessage("การจองนี้หมดเวลาไปแล้ว ไม่สามารถเช็คอินได้");
          setStatus('error');
          return;
        }

        await updateDoc(bookingRef, {
          status: 'checked-in',
          actualStartTime: Timestamp.now(),
          checkInTime: Timestamp.now()
        });

        setBookingData({ ...booking, type: 'check-in' });
        setStatus('success');
      } 
      else if (booking.status === 'checked-in') {
        await updateDoc(bookingRef, {
          status: 'completed',
          actualEndTime: Timestamp.now(),
          checkOutTime: Timestamp.now()
        });

        setBookingData({ ...booking, type: 'check-out' });
        setStatus('success');
      } 
      else {
        setErrorMessage(`การจองนี้มีสถานะ "${booking.status}" ไม่สามารถดำเนินการต่อได้`);
        setStatus('error');
      }

      fetchTodayStats();
    } catch (error) {
       console.error("Scan error:", error);
       setErrorMessage("เกิดข้อผิดพลาดในการตรวจสอบข้อมูลทางเทคนิค");
       setStatus('error');
    }
  }

  if (authLoading || !user || user.role !== 'admin') return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans tracking-widest text-[10px] font-black uppercase text-slate-400">Loading Authorized Admin...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 mt-16 animate-in fade-in duration-700">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-blue-900/10 rotate-3">
               <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 leading-tight">ระบบเจ้าหน้าที่</h1>
              <div className="flex items-center gap-3 mt-1">
                 <Link href="/admin/bookings" className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">
                    Manage Bookings
                 </Link>
                 <button 
                  onClick={() => setIsAdminTestMode(!isAdminTestMode)}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all ${isAdminTestMode ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                >
                  {isAdminTestMode ? 'TEST MODE: ON' : 'TEST MODE: OFF'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-50 text-center shadow-blue-900/5 min-w-[80px]">
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">จองวันนี้</p>
               <p className="text-xl font-black text-blue-600">{todayStats ? todayStats.total : "..."}</p>
            </div>
            <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-50 text-center shadow-blue-900/5 min-w-[80px]">
               <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">เข้าแล้ว</p>
               <p className="text-xl font-black text-green-600">{todayStats ? todayStats.checkedIn : "..."}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[3.5rem] shadow-2xl shadow-blue-900/5 p-10 sm:p-14 border border-white text-center relative overflow-hidden">
           {isAdminTestMode && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-50 text-orange-500 px-4 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border border-orange-100 z-10 animate-pulse">
                 Beta: GPS Bypassed
              </div>
           )}

           {status === 'idle' && (
             <div className="space-y-10 animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 mx-auto shadow-inner shadow-blue-100">
                   <Scan size={48} strokeWidth={1.5} className="animate-pulse" />
                </div>
                
                <div className="space-y-6">
                  <div className={`p-5 rounded-3xl flex items-center justify-center gap-3 border-2 transition-all ${isAdminAtLocation === true ? 'bg-green-50 text-green-600 border-green-100' : isAdminAtLocation === 'loading' ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                     {isAdminAtLocation === true ? <CheckCircle2 size={20} /> : isAdminAtLocation === 'loading' ? <Loader2 className="animate-spin" size={20} /> : <AlertCircle size={20} />}
                     <span className="text-[11px] font-black uppercase tracking-[0.15em]">
                        {isAdminAtLocation === true ? 'Location: Verified' : isAdminAtLocation === 'loading' ? 'Verifying location...' : 'Out of range / GPS Disabled'}
                     </span>
                  </div>

                  <button
                    disabled={!canOperate}
                    onClick={() => setStatus('scanning')}
                    className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 ${canOperate ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:scale-[0.98]' : 'bg-slate-100 text-slate-300 cursor-not-allowed grayscale'}`}
                  >
                    <Camera size={24} />
                    {canOperate ? 'สแกน QR Code' : 'กรุณาอยู่ในพิกัด'}
                  </button>
                  
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t-2 border-slate-50"></span></div>
                    <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-white px-6 text-slate-300">OR</span></div>
                  </div>

                  <form onSubmit={handleManualCheckIn} className="space-y-4">
                    <div className="relative group">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                      <input 
                        type="text" 
                        placeholder="PY-REC-XXXX"
                        value={manualId}
                        onChange={(e) => setManualId(e.target.value.toUpperCase())}
                        className="w-full pl-16 pr-8 py-6 bg-slate-50 border-4 border-slate-50 rounded-[2rem] text-2xl font-black focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner uppercase tracking-widest placeholder:tracking-normal placeholder:font-bold placeholder:text-slate-300"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={!canOperate || !manualId}
                      className={`w-full py-5 rounded-[1.5rem] font-black uppercase tracking-widest text-sm transition-all shadow-lg ${canOperate && manualId ? 'bg-slate-900 text-white hover:bg-black shadow-slate-200' : 'bg-slate-50 text-slate-200 cursor-not-allowed'}`}
                    >
                      เช็คอินด้วยรหัส
                    </button>
                  </form>
                </div>
             </div>
           )}

           {status === 'scanning' && (
             <div className="space-y-6 animate-in fade-in duration-300">
                <div id="qr-reader" className="overflow-hidden rounded-[2.5rem] border-8 border-slate-50 shadow-inner"></div>
                <button
                  onClick={() => setStatus('idle')}
                  className="w-full bg-slate-100 text-slate-400 py-5 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle size={18} />
                  ยกเลิกการแสกน
                </button>
             </div>
           )}

           {status === 'checking' && (
             <div className="py-24 flex flex-col items-center gap-6">
                <div className="w-20 h-20 border-8 border-blue-600 border-t-transparent rounded-full animate-spin shadow-inner shadow-blue-100"></div>
                <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Checking records...</p>
             </div>
           )}

            {status === 'success' && bookingData && (
              <div className="space-y-10 animate-in fade-in zoom-in duration-500">
                 <div className={`w-32 h-32 rounded-[3.5rem] flex items-center justify-center mx-auto shadow-inner ${bookingData.type === 'check-in' ? 'bg-green-50 text-green-600 shadow-green-100' : 'bg-blue-50 text-blue-600 shadow-blue-100'}`}>
                    {bookingData.type === 'check-in' ? (
                       <CheckCircle2 size={80} strokeWidth={1} className="animate-bounce" />
                    ) : (
                       <HistoryIcon size={80} strokeWidth={1} className="rotate-12" />
                    )}
                  </div>
                  <div>
                    <h2 className={`text-4xl font-black mb-2 ${bookingData.type === 'check-in' ? 'text-green-600' : 'text-blue-600'}`}>
                       {bookingData.type === 'check-in' ? 'เช็คอินสำเร็จ!' : 'เช็คเอาท์เรียบร้อย'}
                    </h2>
                    <p className="text-slate-400 font-bold text-xl px-10">
                       คุณ {bookingData.userName} {bookingData.type === 'check-in' ? 'ยินดียิ่งที่ได้พบท่าน' : 'เตรียมตัวเดินทางปลอดภัย'}
                    </p>
                 </div>

                 <div className="bg-slate-50 rounded-[3rem] p-10 text-left space-y-6 shadow-inner border border-slate-100">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
                         <Clock size={28} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">ช่วงเวลาที่จอง</p>
                        <p className="font-black text-2xl text-slate-800">
                          {format((bookingData.startTime as Timestamp).toDate(), 'HH:mm')} - {format((bookingData.endTime as Timestamp).toDate(), 'HH:mm')} น.
                        </p>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">บันทึกเวลาจริง:</span>
                       <span className="text-lg font-black text-slate-900 bg-white px-5 py-2 rounded-2xl shadow-sm">
                          {format(new Date(), 'HH:mm:ss')} น.
                       </span>
                    </div>
                 </div>

                 <button
                   onClick={() => { setStatus('idle'); setManualId(""); }}
                   className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-slate-200"
                 >
                   ทำรายการต่อไป
                 </button>
              </div>
            )}

           {status === 'error' && (
             <div className="py-10 space-y-10 animate-in fade-in zoom-in duration-500">
                <div className="w-28 h-28 bg-red-50 rounded-[3rem] flex items-center justify-center text-red-500 mx-auto shadow-inner shadow-red-100">
                   <AlertCircle size={80} strokeWidth={1} />
                </div>
                
                <div className="space-y-4">
                   <h2 className="text-3xl font-black text-red-500">ดำเนินการไม่สำเร็จ</h2>
                   <div className="bg-red-50 py-6 px-10 rounded-3xl border-2 border-red-100 inline-block">
                      <p className="text-red-700 font-bold text-lg leading-relaxed">
                        {errorMessage}
                      </p>
                   </div>
                </div>
                
                <button
                  onClick={() => setStatus('idle')}
                  className="w-full bg-blue-600 text-white py-6 rounded-[2.5rem] font-black text-xl shadow-2xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                >
                  ลองใหม่อีกครั้ง
                </button>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}
