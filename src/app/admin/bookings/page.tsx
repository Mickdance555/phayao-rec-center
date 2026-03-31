"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  ShieldCheck, 
  Search, 
  Clock, 
  Calendar as CalendarIcon, 
  Trash2, 
  Loader2, 
  Filter, 
  ChevronRight,
  AlertTriangle,
  User as UserIcon,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  deleteDoc, 
  doc, 
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, isSameDay, startOfDay, endOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function AdminBookingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState<string>("");
  
  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push("/");
    }
    if (user?.role === 'admin') {
      fetchBookings();
    }
  }, [user, authLoading, router]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "bookings"), orderBy("startTime", "desc"));
      const querySnapshot = await getDocs(q);
      const bookingData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookings(bookingData);
    } catch (e) {
      console.error("Error fetching bookings:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "bookings", id));
      setBookings(bookings.filter(b => b.id !== id));
      setConfirmDelete(null);
    } catch (e) {
      console.error("Error deleting booking:", e);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = 
      b.userName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.memberId?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterDate) {
      const bDate = (b.startTime as Timestamp).toDate();
      const fDate = new Date(filterDate);
      return matchesSearch && isSameDay(bDate, fDate);
    }
    
    return matchesSearch;
  });

  if (authLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 mt-16">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
           <div className="space-y-2">
              <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-[0.2em] text-xs">
                 <ShieldCheck size={16} />
                 Admin Control Panel
              </div>
              <h1 className="text-4xl font-black text-slate-900 leading-tight">จัดการข้อมูลการจองห้อง</h1>
              <p className="text-slate-500 font-bold">ตรวจสอบและยกเลิกรายการจองทั้งหมดของศูนย์นันทนาการ</p>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                  type="text" 
                  placeholder="ค้นหาชื่อ หรือ รหัสสมาชิก..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold focus:border-blue-500 focus:outline-none transition-all w-full sm:w-64 shadow-sm"
                 />
              </div>
              <div className="relative">
                 <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                  type="date" 
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-[2rem] text-sm font-bold focus:border-blue-500 focus:outline-none transition-all w-full shadow-sm"
                 />
              </div>
           </div>
        </header>

        {loading ? (
          <div className="flex-1 py-32 flex flex-col items-center justify-center gap-6">
             <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs">กำลังดึงข้อมูลการจองล่าสุด...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-sm">
             <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mx-auto mb-6">
                <Search size={40} />
             </div>
             <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบรายการจอง</h2>
             <p className="text-slate-400 font-bold">ลองปรับการค้นหาหรือเลือกวันที่อื่น</p>
          </div>
        ) : (
          <div className="space-y-6">
             {/* Bookings Table / List */}
             <div className="bg-white rounded-[3rem] shadow-xl shadow-blue-900/5 overflow-hidden border border-slate-50">
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">ข้อมูลสมาชิก</th>
                            <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">วันที่และเวลา</th>
                            <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest">สถานะ</th>
                            <th className="px-8 py-6 text-xs font-black text-slate-400 uppercase tracking-widest text-right">จัดการ</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {filteredBookings.map((booking) => {
                            const startTime = (booking.startTime as Timestamp).toDate();
                            const endTime = (booking.endTime as Timestamp).toDate();
                            
                            return (
                               <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black">
                                           {booking.userName?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                           <p className="font-black text-slate-800 text-lg">{booking.userName}</p>
                                           <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                              <UserIcon size={12} /> {booking.memberId}
                                           </div>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     <div className="flex items-center gap-3">
                                        <CalendarIcon size={16} className="text-slate-300" />
                                        <div>
                                           <p className="font-black text-slate-700">{format(startTime, 'd MMMM yyyy', { locale: th })}</p>
                                           <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">{format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')} น.</p>
                                        </div>
                                     </div>
                                  </td>
                                  <td className="px-8 py-6">
                                     {booking.status === 'confirmed' ? (
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-black border border-blue-100">
                                           ยืนยันแล้ว
                                        </span>
                                     ) : booking.status === 'checked-in' ? (
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-xs font-black border border-green-100">
                                           <CheckCircle2 size={12} /> เข้าใช้งานแล้ว
                                        </span>
                                     ) : (
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-black">
                                           {booking.status}
                                        </span>
                                     )}
                                  </td>
                                  <td className="px-8 py-6 text-right">
                                     <button 
                                      onClick={() => setConfirmDelete(booking.id)}
                                      className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm shadow-red-100 border border-red-50"
                                      title="ยกเลิกการจอง"
                                     >
                                        <Trash2 size={20} />
                                     </button>
                                  </td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
             
             <p className="text-center text-slate-400 text-xs font-bold py-4">
                พบทั้งหมด {filteredBookings.length} รายการ
             </p>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-12 text-center text-pretty">
                 <div className="w-20 h-20 bg-red-50 rounded-[2rem] flex items-center justify-center text-red-500 mx-auto mb-8 shadow-inner">
                    <AlertTriangle size={40} className="animate-pulse" />
                 </div>
                 <h2 className="text-3xl font-black text-slate-800 mb-4">ยกเลิกการจองนี้?</h2>
                 <p className="text-slate-500 font-bold text-lg leading-relaxed mb-10">คุณต้องการลบรายการจองของ <strong className="text-slate-900">{bookings.find(b => b.id === confirmDelete)?.userName}</strong> ใช่หรือไม่? <br /> <span className="text-xs text-red-400 uppercase tracking-[0.1em] font-black">การดำเนินการนี้ไม่สามารถย้อนกลับได้</span></p>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <button 
                      disabled={isDeleting}
                      onClick={() => setConfirmDelete(null)}
                      className="px-8 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black hover:bg-slate-200 transition-all active:scale-95"
                    >
                       ยกเลิก
                    </button>
                    <button 
                      disabled={isDeleting}
                      onClick={() => handleDelete(confirmDelete)}
                      className="px-8 py-5 bg-red-600 text-white rounded-3xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                       {isDeleting ? <Loader2 className="animate-spin" size={20} /> : "ยืนยันการลบ"}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
