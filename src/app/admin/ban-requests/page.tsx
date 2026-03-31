"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  Users, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X,
  UserX,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck
} from "lucide-react";
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  deleteDoc, 
  orderBy,
  Timestamp,
  where,
  updateDoc,
  setDoc,
  onSnapshot,
  arrayUnion
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { hashSHA256 } from "@/lib/crypto";

export default function BanRequestsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push("/");
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      const q = query(
        collection(db, "banRequests"), 
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedRequests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          created: (doc.data().createdAt as Timestamp)?.toDate() || new Date()
        }));
        setRequests(fetchedRequests);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser]);

  const handleApprove = async (requestId: string, requestData: any) => {
    if (!currentUser) return;
    if (requestData.approvers.includes(currentUser.uid)) {
      alert("คุณได้อนุมัติคำขอนี้ไปแล้ว");
      return;
    }

    setActionLoading(requestId);
    try {
      const newApprovalCount = requestData.approvalCount + 1;
      const isFullApproval = newApprovalCount >= requestData.requiredApprovals;

      if (isFullApproval) {
        // PERMANENT BAN EXECUTION - PDPA Compliant (Hashing)
        const hashedPhone = await hashSHA256(requestData.targetUserPhone);
        const hashedIdCard = await hashSHA256(requestData.targetUserIdCard);

        // 1. Add to blacklist (Store only hashed sensitive data)
        await setDoc(doc(db, "blacklist", requestData.targetUserEmail), {
          email: requestData.targetUserEmail, // Keep email as key (standard practice for account identification)
          fullName: requestData.targetUserName,
          phone: hashedPhone,
          idCard: hashedIdCard,
          hashed: true, // Marker for PDPA compliance
          bannedAt: Timestamp.now(),
          reason: requestData.reason,
          requestId: requestId
        });

        // 2. Delete User
        await deleteDoc(doc(db, "users", requestData.targetUserId));

        // 3. Update Request Status
        await updateDoc(doc(db, "banRequests", requestId), {
          status: "completed",
          approvalCount: newApprovalCount,
          approvers: arrayUnion(currentUser.uid),
          completedAt: Timestamp.now()
        });

        alert("ระงับการใช้งานถาวรเสร็จสมบูรณ์ และข้อมูลถูกเพิ่มเข้า Blacklist แล้ว");
      } else {
        // JUST UPDATE APPROVAL
        await updateDoc(doc(db, "banRequests", requestId), {
          approvalCount: newApprovalCount,
          approvers: arrayUnion(currentUser.uid)
        });
        alert("บันทึกการอนุมัติเรียบร้อยแล้ว");
      }
    } catch (error) {
      console.error("Approval error:", error);
      alert("เกิดข้อผิดพลาดในการอนุมัติ");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm("คุณต้องการคัดค้านและยกเลิกคำขอนี้ใช่หรือไม่?")) return;
    
    setActionLoading(requestId);
    try {
      await updateDoc(doc(db, "banRequests", requestId), {
        status: "rejected",
        rejectedBy: currentUser?.uid,
        rejectedAt: Timestamp.now()
      });
      alert("ยกเลิกคำขอเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Reject error:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 mt-16 animate-in fade-in duration-700">
        <div className="mb-12 flex items-center gap-4">
           <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3">
              <ShieldCheck size={32} />
           </div>
           <div>
              <h1 className="text-3xl font-black text-slate-900 leading-tight">คำขอระงับถาวร</h1>
              <p className="text-slate-500 font-bold">รอการอนุมัติจากผู้ดูแลระบบทั้งหมดเพื่อดำเนินการ Blacklist</p>
           </div>
        </div>

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[4rem] border border-slate-50 shadow-sm shadow-blue-900/5">
             <Loader2 size={48} className="animate-spin text-blue-600 mb-6" />
             <p className="text-slate-400 font-black tracking-widest uppercase text-xs text-center px-8">กำลังตรวจสอบคำขอที่ค้างอยู่จากคณะกรรมการ...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-200 mb-6 transition-transform hover:scale-110 duration-500">
                <CheckCircle2 size={48} />
             </div>
             <p className="text-slate-400 font-black text-xl">ไม่มีคำขอที่รอการพิจารณาในขณะนี้</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((req) => (
              <div 
                key={req.id}
                className="bg-white p-10 rounded-[3.5rem] border border-white shadow-2xl shadow-blue-900/5 flex flex-col gap-10 animate-in slide-in-from-bottom-6 duration-500 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 -rotate-12 pointer-events-none">
                   <AlertCircle size={120} />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                   <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-red-500 shadow-inner">
                         <UserX size={40} />
                      </div>
                      <div>
                         <h3 className="text-2xl font-black text-slate-900 mb-1">{req.targetUserName}</h3>
                         <p className="text-slate-400 font-bold flex items-center gap-2">
                            <Clock size={16} />
                            ส่งเมื่อ: {format(req.created, 'd MMM yyyy HH:mm', { locale: th })}
                         </p>
                      </div>
                   </div>

                   <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-3">
                         <div className="text-xs font-black uppercase tracking-widest text-slate-400">ระดับการเห็นชอบ</div>
                         <div className="flex gap-1.5">
                            {Array.from({ length: req.requiredApprovals }).map((_, i) => (
                               <div key={i} className={`w-3 h-3 rounded-full ${i < req.approvalCount ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-slate-100'}`}></div>
                            ))}
                         </div>
                      </div>
                      <p className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
                         อนุมัติแล้ว {req.approvalCount} / {req.requiredApprovals} ท่าน
                      </p>
                   </div>
                </div>

                <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 relative">
                   <div className="flex items-center gap-2 text-xs font-black text-red-400 uppercase tracking-widest mb-3">
                      <AlertCircle size={14} /> เหตุผลที่เสนอแบน
                   </div>
                   <p className="text-red-700 font-bold text-lg leading-relaxed">{req.reason}</p>
                   <p className="mt-4 text-[11px] font-black text-red-300 uppercase tracking-widest">
                      เสนอโดย: <span className="underline">{req.createdByName}</span>
                   </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                   <button 
                     disabled={actionLoading === req.id}
                     onClick={() => handleReject(req.id)}
                     className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black text-sm hover:bg-slate-50 hover:text-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                   >
                      <XCircle size={20} /> คัดค้านคำขอ
                   </button>
                   <button 
                     disabled={actionLoading === req.id || req.approvers.includes(currentUser.uid)}
                     onClick={() => handleApprove(req.id, req)}
                     className={`flex-[2] py-5 rounded-3xl font-black text-sm shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-95 ${req.approvers.includes(currentUser.uid) ? 'bg-slate-50 text-slate-300 border border-slate-100' : 'bg-green-500 text-white shadow-green-200 hover:bg-green-600'}`}
                   >
                      {actionLoading === req.id ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : req.approvers.includes(currentUser.uid) ? (
                        <UserCheck size={20} />
                      ) : (
                        <CheckCircle2 size={20} />
                      )}
                      {req.approvers.includes(currentUser.uid) ? 'คุณอนุมัติแล้ว' : 'อนุมัติการระงับถาวร'}
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
