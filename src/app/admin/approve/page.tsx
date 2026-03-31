"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search, 
  User as UserIcon, 
  Phone, 
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Filter
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  orderBy 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { maskIdCard, maskPhone } from "@/lib/crypto";

export default function ApprovePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push("/");
    }
    if (user?.role === 'admin') {
      fetchPendingUsers();
    }
  }, [user, authLoading, router]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().createdAt?.toDate() || new Date()
      }));
      setPendingUsers(users);
    } catch (error) {
      console.error("Error fetching pending users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "approved"
      });
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error approving user:", error);
      alert("เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm("ยืนยันการปฏิเสธสมาชิกคนนี้?")) return;
    
    setActionLoading(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        status: "rejected"
      });
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error("Error rejecting user:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-100">
               <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#112D4E] tracking-tight">อนุมัติสมาชิกใหม่</h1>
              <p className="text-slate-500 font-bold flex items-center gap-2">
                <Users size={16} />
                ตรวจสอบและยืนยันตัวตนสมาชิก
              </p>
            </div>
          </div>
          
          <div className="bg-white px-6 py-4 rounded-3xl shadow-sm border border-slate-50 flex items-center gap-3">
             <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
             <p className="text-sm font-black text-slate-700">รออนุมัติ {pendingUsers.length} รายการ</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border border-slate-50 shadow-sm">
             <Loader2 size={40} className="animate-spin text-blue-600 mb-4" />
             <p className="text-slate-400 font-black">กำลังโหลดข้อมูลสมาชิก...</p>
          </div>
        ) : pendingUsers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
             <CheckCircle2 size={64} className="text-green-200 mb-6" />
             <p className="text-slate-400 font-black text-xl">ไม่มีสมาชิกที่รอการอนุมัติ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {pendingUsers.map((pUser) => (
              <div 
                key={pUser.id}
                className="bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-blue-900/5 border border-white hover:shadow-blue-900/10 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-8 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 flex-1">
                  <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform shadow-inner relative overflow-hidden">
                     {pUser.photoURL ? (
                       <img src={pUser.photoURL} alt="pUser" className="w-full h-full object-cover" />
                     ) : (
                       <UserIcon size={32} />
                     )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 mb-1">{pUser.fullName}</h3>
                      <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-tighter">
                         <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                         {pUser.memberId}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                       <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <Phone size={16} className="text-slate-300" />
                          {maskPhone(pUser.phone)}
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                          <CreditCard size={16} className="text-slate-300" />
                          {maskIdCard(pUser.idCard)}
                       </div>
                       <div className="flex items-center gap-2 text-slate-400 font-bold text-[11px] col-span-full">
                          สมัครเมื่อ: {format(pUser.created, 'd MMM yyyy HH:mm', { locale: th })}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-row flex-col gap-3 min-w-[240px]">
                  <button
                    disabled={actionLoading === pUser.id}
                    onClick={() => handleReject(pUser.id)}
                    className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black text-sm hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} />
                    ปฏิเสธ
                  </button>
                  <button
                    disabled={actionLoading === pUser.id}
                    onClick={() => handleApprove(pUser.id)}
                    className="flex-[2] py-4 bg-green-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-green-100 hover:bg-green-600 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading === pUser.id ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    อนุมัติให้เข้าจอง
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <footer className="py-8 bg-blue-50/50 flex flex-col items-center border-t border-blue-100">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">ระบบจัดการสมาชิก อบจ.พะเยา</p>
      </footer>
    </div>
  );
}
