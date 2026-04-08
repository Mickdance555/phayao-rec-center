"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  History, 
  Clock, 
  MapPin, 
  QrCode, 
  Loader2, 
  Calendar, 
  CheckCircle2, 
  Timer, 
  ChevronRight,
  XCircle,
  AlertTriangle,
  X,
  ShieldCheck,
  Info,
  Users as UsersIcon,
  User as UserIcon
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  Timestamp,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, isAfter, isBefore, addMinutes, subHours } from "date-fns";
import { th } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { signQR } from "@/lib/crypto";



export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [selectedDetailBooking, setSelectedDetailBooking] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Security Features
  const [currentTime, setCurrentTime] = useState(new Date());


  const [qrValue, setQrValue] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function updateQR() {
      if (selectedBooking && user) {
        const timestampBlock = Math.floor(new Date().getTime() / 60000);
        const signature = await signQR(selectedBooking.id, timestampBlock, user.uid);
        setQrValue(`${selectedBooking.id}:${timestampBlock}:${signature}`);
      }
    }
    updateQR();
  }, [currentTime.getMinutes(), selectedBooking, user]);



  useEffect(() => {
    if (user) {
      fetchUserBookings();
    }
  }, [user]);

  const fetchUserBookings = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "bookings"),
        where("userId", "==", user?.uid),
        orderBy("startTime", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const bookingData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: (doc.data().startTime as Timestamp).toDate(),
        end: (doc.data().endTime as Timestamp).toDate(),
        created: (doc.data().createdAt as Timestamp).toDate()
      }));
      setBookings(bookingData);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("คุณแน่ใจใช่ไหมว่าจะยกเลิกการจองนี้?")) return;
    
    setIsCancelling(true);
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: 'cancelled',
        cancelledAt: Timestamp.now()
      });
      await fetchUserBookings();
      setSelectedBooking(null);
    } catch (error) {
      console.error("Cancellation error:", error);
      alert("เกิดข้อผิดพลาดในการยกเลิก");
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusInfo = (booking: any) => {
    const now = new Date();
    
    if (booking.status === 'cancelled') {
       return { label: 'ยกเลิกแล้ว', color: 'bg-red-50 text-red-500', icon: XCircle };
    }
    if (booking.status === 'checked-in') {
      return { label: 'เช็คอินแล้ว', color: 'bg-green-100 text-green-600', icon: CheckCircle2 };
    }
    if (isAfter(now, booking.end)) {
      return { label: 'สิ้นสุดแล้ว', color: 'bg-slate-100 text-slate-500', icon: History };
    }
    if (isBefore(now, addMinutes(booking.start, -30))) {
      return { label: 'รอดำเนินการ', color: 'bg-blue-100 text-blue-600', icon: Clock };
    }
    return { label: 'พร้อมเช็คอิน', color: 'bg-yellow-100 text-yellow-600', icon: Timer };
  };

  const showQRCode = true;

  if (authLoading) return <div className="min-h-screen flex items-center justify-center font-sans bg-slate-50"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 mt-16 animate-in fade-in duration-700">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-blue-200 rotate-3">
               <History size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 leading-tight">ประวัติการจอง</h1>
              <p className="text-slate-500 font-bold tracking-tight">รายการจองย้อนหลังและรหัสผ่านสำหรับเข้าใช้งาน</p>
            </div>
          </div>
          
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border border-slate-50 shadow-sm animate-pulse">
             <Loader2 size={48} className="animate-spin text-blue-600 mb-6" />
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs tracking-[0.2em]">กำลังค้นประวัติการใช้งาน...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <History size={48} />
             </div>
             <p className="text-slate-400 font-black text-xl mb-2">ยังไม่มีประวัติการจอง</p>
             <p className="text-slate-300 font-bold">เริ่มจองเวลาของคุณได้ที่หน้าหลัก</p>
          </div>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const status = getStatusInfo(booking);
              const SStatusIcon = status.icon;
              const isCancelled = booking.status === 'cancelled';
              const canCancel = !isCancelled && isBefore(new Date(), subHours(booking.start, 6)) && booking.status !== 'checked-in';
              
              return (
                <div 
                  key={booking.id}
                  onClick={() => !isCancelled && setSelectedBooking(booking)}
                  className={`bg-white p-8 rounded-[3rem] border border-slate-200 transition-all group relative overflow-hidden ${isCancelled ? 'opacity-60 grayscale bg-slate-50/50 cursor-default' : 'shadow-xl shadow-blue-900/5 hover:-translate-y-1 hover:shadow-blue-900/10 cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCancelled ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white shadow-xl shadow-blue-200'}`}>
                         <Calendar size={28} />
                      </div>
                      <div>
                        <p className={`font-black text-2xl ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                           {format(booking.start, 'd MMMM yyyy', { locale: th })}
                        </p>
                        <p className="text-sm font-black text-blue-500 uppercase tracking-widest mt-1">
                           {format(booking.start, 'HH:mm')} - {format(booking.end, 'HH:mm')} น.
                        </p>
                      </div>
                    </div>
                    <div className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 border ${status.color}`}>
                       <SStatusIcon size={14} />
                       {status.label}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                       <MapPin size={16} className="text-blue-200" />
                       ชั้น 2 อบจ.พะเยา
                    </div>
                    {!isCancelled && (
                       <div className="flex items-center gap-4">
                         <button 
                           onClick={(e) => {
                             e.stopPropagation();
                             setSelectedDetailBooking(booking);
                           }}
                           className="p-2 bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-widest"
                         >
                           <Info size={16} /> รายละเอียด
                         </button>
                         <div className="text-blue-600 font-black text-xs flex items-center gap-2 group-hover:translate-x-2 transition-transform">
                            แตะเพื่อดู QR CODE <ChevronRight size={18} />
                         </div>
                       </div>
                    )}
                    {isCancelled && booking.cancelledAt && (
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          ยกเลิกเมื่อ {format(booking.cancelledAt.toDate(), 'd MMM HH:mm', { locale: th })}
                       </div>
                    )}
                  </div>

                  {!isCancelled && !canCancel && booking.status !== 'checked-in' && isBefore(new Date(), booking.start) && (
                     <div className="mt-4 text-[10px] font-black text-red-300 flex items-center gap-1">
                        <AlertTriangle size={12} /> ไม่สามารถยกเลิกได้ (ต้องทำล่วงหน้า 6 ชม.)
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* QR Code Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[4rem] shadow-2xl p-10 relative overflow-hidden animate-in zoom-in-95 duration-500">
              
              <button 
                onClick={() => setSelectedBooking(null)}
                className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center text-center">
                 <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white mb-8 shadow-2xl shadow-blue-200 rotate-12">
                    <QrCode size={48} />
                 </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-2 leading-none">Personal QR</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8 opacity-70">
                    MEMBER PASS
                  </p>

                  <div className="relative group w-full flex flex-col items-center">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900 text-white px-5 py-2.5 rounded-full text-[9px] font-black shadow-2xl whitespace-nowrap border-b-2 border-blue-500 uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck size={12} className="text-blue-400" />
                       ID: {user?.fullName}
                    </div>

                     <div className="p-10 bg-slate-50 rounded-[3.5rem] shadow-inner mb-6 relative overflow-hidden flex flex-col items-center border border-slate-100">
                        <div className="bg-white p-4 rounded-[2rem] shadow-2xl">
                          <QRCodeSVG 
                            value={qrValue} 
                            size={180}
                            level={"H"}
                            includeMargin={false}
                          />
                        </div>
                        <div className="mt-6 flex items-center gap-3 text-blue-600 font-black px-6 py-2 bg-blue-50 rounded-full">
                           <Timer size={16} className="animate-pulse" />
                           <span className="text-base tracking-[0.1em]">{format(currentTime, 'HH:mm:ss')}</span>
                        </div>
                     </div>
                    
                    {showQRCode && (
                      <div className="mb-8 flex flex-col items-center w-full px-12">
                         <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div 
                               className="h-full bg-blue-600 transition-all duration-1000" 
                               style={{ width: `${((currentTime.getTime() % 60000) / 60000) * 100}%` }}
                            ></div>
                         </div>
                         <p className="mt-3 text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] opacity-60">Refreshing in 60s</p>
                      </div>
                    )}
                  </div>

                 {/* Details & Cancellation */}
                 {isBefore(new Date(), subHours(selectedBooking.start, 6)) && selectedBooking.status === 'confirmed' ? (
                   <button 
                    disabled={isCancelling}
                    onClick={() => handleCancelBooking(selectedBooking.id)}
                    className="w-full py-5 bg-white border-2 border-red-50 text-red-400 rounded-3xl font-black text-xs hover:bg-red-50 hover:border-red-100 transition-all active:scale-95 flex items-center justify-center gap-2 mb-2"
                   >
                     {isCancelling ? <Loader2 className="animate-spin" /> : "ยกเลิกการจองรายการนี้"}
                   </button>
                 ) : selectedBooking.status === 'confirmed' && isBefore(new Date(), selectedBooking.start) && (
                   <p className="mb-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 justify-center italic">
                      <AlertTriangle size={12} /> ยกเลิกได้ก่อนเริ่ม 6 ชม. เท่านั้น
                   </p>
                 )}
                 
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    SESSION ID: {selectedBooking.id.substring(0, 8)}...
                 </p>
              </div>
           </div>
        </div>
      )}
      {/* Booking Detail Modal */}
      {selectedDetailBooking && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
              <header className="p-8 bg-blue-600 text-white flex justify-between items-center shrink-0">
                 <div>
                    <h2 className="text-2xl font-black">รายละเอียดการจอง</h2>
                    <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest opacity-80">Booking Details</p>
                 </div>
                 <button 
                   onClick={() => setSelectedDetailBooking(null)}
                   className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
                 >
                   <X size={20} />
                 </button>
              </header>

              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Calendar size={12} className="text-blue-500" /> วันที่เข้าใช้
                       </p>
                       <p className="text-lg font-black text-slate-800">
                          {format(selectedDetailBooking.start, 'd MMM yy', { locale: th })}
                       </p>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Clock size={12} className="text-blue-500" /> ช่วงเวลา
                       </p>
                       <p className="text-lg font-black text-slate-800">
                          {format(selectedDetailBooking.start, 'HH:mm')} - {format(selectedDetailBooking.end, 'HH:mm')} น.
                       </p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                       <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <UsersIcon size={14} className="text-blue-500" /> ผู้เข้าใช้งาน ({selectedDetailBooking.totalAttendees || selectedDetailBooking.attendees?.length || 1})
                       </h3>
                       <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                          Total: {selectedDetailBooking.totalAttendees || selectedDetailBooking.attendees?.length || 1} people
                       </span>
                    </div>

                    <div className="bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
                       <div className="p-6 space-y-4">
                          {selectedDetailBooking.attendees && selectedDetailBooking.attendees.length > 0 ? (
                             selectedDetailBooking.attendees.map((at: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-200/50 last:border-0 last:pb-0">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                         <UserIcon size={14} />
                                      </div>
                                      <div>
                                         <p className="text-sm font-black text-slate-700 leading-tight">{at.name}</p>
                                         <p className="text-[10px] font-bold text-slate-400 tracking-tight">{at.phone || 'ไม่ระบุเบอร์โทร'}</p>
                                      </div>
                                   </div>
                                   {at.isMember && (
                                      <span className="text-[8px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">Member</span>
                                   )}
                                </div>
                             ))
                          ) : (
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                   <UserIcon size={14} />
                                </div>
                                <p className="text-sm font-black text-slate-700">{selectedDetailBooking.userName}</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between text-slate-400">
                       <p className="text-[10px] font-black uppercase tracking-widest">ทำรายการเมื่อ</p>
                       <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                          {format(selectedDetailBooking.created, 'd MMM yyyy HH:mm:ss', { locale: th })}
                       </p>
                    </div>
                    <p className="mt-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center">
                       SESSION ID: {selectedDetailBooking.id}
                    </p>
                 </div>
              </div>

              <footer className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
                 <button 
                   onClick={() => setSelectedDetailBooking(null)}
                   className="w-full py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-2xl font-black text-xs hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
                 >
                   ปิดหน้าต่าง
                 </button>
              </footer>
           </div>
        </div>
      )}
    </div>
  );
}
