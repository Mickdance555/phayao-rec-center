"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { 
  Filter,
  AlertOctagon,
  Ban,
  Slash,
  Siren,
  UserX,
  Clock3,
  Users, 
  Trash2, 
  ShieldCheck, 
  AlertCircle, 
  Loader2, 
  X,
  User as UserIcon,
  Phone,
  CreditCard,
  Lock,
  Search,
  CheckCircle2
} from "lucide-react";
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  deleteDoc, 
  orderBy,
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, addDays } from "date-fns";
import { th } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { addDoc, updateDoc } from "firebase/firestore";
import { maskIdCard, maskPhone } from "@/lib/crypto";

const DELETE_SECRET = "Userdeletebyadmin";
const SUPER_ADMIN_EMAIL = "j.naphat.mick@gmail.com";

export default function UserManagementPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Penalty Modal States
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isBanModalOpen, setIsBanModalOpen] = useState(false);
  const [penaltyReason, setPenaltyReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);
  const [isProcessingPenalty, setIsProcessingPenalty] = useState(false);

  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      router.push("/");
    }
    if (currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser, authLoading, router]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: (doc.data().createdAt as Timestamp)?.toDate() || new Date()
      }));
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (userToDelete: any) => {
    setSelectedUser(userToDelete);
    setDeletePassword("");
    setDeleteError("");
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser || !currentUser) return;
    
    // Double check password
    if (deletePassword !== DELETE_SECRET) {
      setDeleteError("รหัสยืนยันไม่ถูกต้อง");
      return;
    }

    // Protection Logic (Backend level check)
    if (selectedUser.email === SUPER_ADMIN_EMAIL) {
       setDeleteError("ไม่สามารถลบผู้ดูแลระบบสูงสุด (Project Owner) ได้");
       return;
    }

    // Permission Logic (Admin check)
    const isSuperAdmin = currentUser.email === SUPER_ADMIN_EMAIL;
    if (!isSuperAdmin && selectedUser.role === 'admin') {
       setDeleteError("คุณไม่มีสิทธิ์ลบผู้ดูแลคนอื่นได้ (เฉพาะเจ้าของโครงการเท่านั้น)");
       return;
    }

    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteDoc(doc(db, "users", selectedUser.id));
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Delete error:", error);
      setDeleteError("เกิดข้อผิดพลาดในการลบข้อมูล กรุณาตรวจสอบสิทธิ์และลองใหม่อีกครั้ง");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!selectedUser || !currentUser || !penaltyReason) return;
    
    setIsProcessingPenalty(true);
    try {
      const suspendedUntil = addDays(new Date(), suspendDays);
      await updateDoc(doc(db, "users", selectedUser.id), {
        status: "suspended",
        suspendedUntil: Timestamp.fromDate(suspendedUntil),
        penaltyReason: penaltyReason,
        suspendedBy: currentUser.uid,
        suspendedAt: Timestamp.now()
      });
      
      setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, status: "suspended", suspendedUntil: Timestamp.fromDate(suspendedUntil) } : u));
      setIsSuspendModalOpen(false);
      setSelectedUser(null);
      setPenaltyReason("");
    } catch (error) {
      console.error("Suspension error:", error);
      alert("เกิดข้อผิดพลาดในการระงับการใช้งาน");
    } finally {
      setIsProcessingPenalty(false);
    }
  };

  const handleRequestBan = async () => {
    if (!selectedUser || !currentUser || !penaltyReason) return;

    setIsProcessingPenalty(true);
    try {
      // Get all admin count
      const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
      const totalAdmins = adminsSnap.size;

      await addDoc(collection(db, "banRequests"), {
        targetUserId: selectedUser.id,
        targetUserName: selectedUser.fullName,
        targetUserEmail: selectedUser.email,
        targetUserPhone: selectedUser.phone,
        targetUserIdCard: selectedUser.idCard,
        reason: penaltyReason,
        createdBy: currentUser.uid,
        createdByName: currentUser.fullName,
        createdAt: Timestamp.now(),
        approvers: [currentUser.uid],
        approvalCount: 1,
        requiredApprovals: totalAdmins, // Need all admins to agree
        status: "pending"
      });

      alert("ส่งคำขอระงับการใช้งานถาวรเรียบร้อยแล้ว รอการอนุมัติจากผู้ดูแลคนอื่นๆ");
      setIsBanModalOpen(false);
      setSelectedUser(null);
      setPenaltyReason("");
    } catch (error) {
      console.error("Ban request error:", error);
      alert("เกิดข้อผิดพลาดในการส่งคำขอ");
    } finally {
      setIsProcessingPenalty(false);
    }
  };

  const canDeleteUser = (u: any) => {
    if (!currentUser) return false;
    // Cannot delete Super Admin
    if (u.email === SUPER_ADMIN_EMAIL) return false;
    // Super Admin can delete anyone else
    if (currentUser.email === SUPER_ADMIN_EMAIL) return true;
    // Normal Admin can only delete 'user' role
    return u.role === 'user';
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.memberId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || u.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (authLoading || !currentUser || currentUser.role !== 'admin') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <Navbar />
      
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12 mt-16 animate-in fade-in duration-700">
        <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl rotate-3 shadow-slate-200">
                 <Users size={32} />
              </div>
              <div>
                 <h1 className="text-3xl font-black text-slate-900 leading-tight">จัดการสมาชิก</h1>
                 <p className="text-slate-500 font-bold">รายชื่อสมาชิกทั้งหมดในระบบและสิทธิ์การใช้งาน</p>
              </div>
           </div>

           <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[280px]">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                   type="text" 
                   placeholder="ค้นหาชื่อ, อีเมล หรือรหัสสมาชิก..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm focus:border-blue-500 focus:outline-none font-bold text-slate-700 transition-all shadow-blue-900/5"
                 />
              </div>
              <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm shadow-blue-900/5">
                 {(['all', 'pending', 'active'] as const).map((f) => (
                    <button 
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                       {f === 'all' ? 'ทั้งหมด' : f === 'pending' ? 'รออนุมัติ' : 'ปกติ'}
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[4rem] border border-slate-50 shadow-sm shadow-blue-900/5">
             <Loader2 size={48} className="animate-spin text-blue-600 mb-6" />
             <p className="text-slate-400 font-black tracking-widest uppercase text-xs">กำลังรวบรวมข้อมูลสมาชิกทั้งหมด...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <Users size={48} />
             </div>
             <p className="text-slate-400 font-black text-xl">ไม่พบข้อมูลสมาชิกที่ค้นหา</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((u) => (
              <div 
                key={u.id}
                className="bg-white p-8 rounded-[3rem] border border-white shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all group animate-in slide-in-from-bottom-4"
              >
                <div className="flex items-center justify-between mb-8">
                   <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 relative overflow-hidden group-hover:scale-105 transition-all shadow-inner">
                      {u.photoURL ? <img src={u.photoURL} alt={u.fullName} className="w-full h-full object-cover" /> : <UserIcon size={24} />}
                   </div>
                   <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border ${u.role === 'admin' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      {u.role}
                   </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <h3 className="text-xl font-black text-slate-800 mb-1">{u.fullName}</h3>
                      <div className="text-blue-600 font-bold text-xs flex items-center gap-2 uppercase tracking-tighter">
                         <div className={`w-2 h-2 rounded-full ${u.status === 'active' ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-yellow-500 shadow-lg shadow-yellow-200'}`}></div>
                         {u.memberId || 'รอดำเนินการ'}
                      </div>
                   </div>

                   <div className="space-y-3 pt-6 border-t border-slate-50">
                      <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                         <CreditCard size={16} className="text-slate-300" />
                         {maskIdCard(u.idCard)}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                         <Phone size={16} className="text-slate-300" />
                         {maskPhone(u.phone)}
                      </div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none pt-2">
                         เข้าร่วมเมื่อ: {format(u.created, 'd MMM yyyy', { locale: th })}
                      </p>
                   </div>

                   <div className="pt-4 flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest self-start ${u.status === 'active' ? 'bg-green-50 text-green-600' : u.status === 'suspended' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
                           {u.status === 'active' ? 'ปกติ' : u.status === 'suspended' ? 'ระงับชั่วคราว' : 'รอการอนุมัติ'}
                        </div>
                        {u.status === 'suspended' && u.suspendedUntil && (
                           <div className="text-[9px] font-bold text-red-400 pl-1">สิ้นสุด: {format((u.suspendedUntil as Timestamp).toDate(), 'd MMM yy', { locale: th })}</div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {u.role === 'user' && u.status !== 'suspended' && (
                          <button 
                            onClick={() => { setSelectedUser(u); setIsSuspendModalOpen(true); }}
                            className="w-10 h-10 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center hover:bg-orange-500 hover:text-white transition-all shadow-sm border border-orange-100"
                            title="ระงับชั่วคราว"
                          >
                             <Siren size={18} />
                          </button>
                        )}
                        {u.role === 'user' && (
                          <button 
                            onClick={() => { setSelectedUser(u); setIsBanModalOpen(true); }}
                            className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-red-600 transition-all shadow-sm border border-slate-800"
                            title="ระงับถาวร"
                          >
                             <UserX size={18} />
                          </button>
                        )}
                        {canDeleteUser(u) && (
                           <button 
                             onClick={() => handleDeleteClick(u)}
                             className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                           >
                              <Trash2 size={18} />
                           </button>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[4rem] shadow-2xl relative overflow-hidden flex flex-col p-10 animate-in zoom-in-95 duration-500">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"
              >
                <X size={24} />
              </button>

              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner shadow-red-100/50">
                    <Trash2 size={40} />
                 </div>
                 
                 <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">ยืนยันการลบสมาชิก?</h2>
                    <p className="text-slate-400 font-bold px-4">
                       คุณกำลังจะลบ <span className="text-slate-800">{selectedUser.fullName}</span> ข้อมูลทั้งหมดจะหายไปและไม่สามารถกู้คืนได้
                    </p>
                 </div>

                 <div className="space-y-4">
                    <div className="relative">
                       <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                       <input 
                         type="password"
                         placeholder="ป้อนรหัสผ่านลับเพื่อยืนยัน"
                         value={deletePassword}
                         onChange={(e) => {
                            setDeletePassword(e.target.value);
                            setDeleteError("");
                         }}
                         className={`w-full pl-14 pr-6 py-5 bg-slate-50 border-4 rounded-[2rem] text-lg font-black focus:bg-white outline-none transition-all shadow-inner ${deleteError ? 'border-red-50' : 'border-slate-50 focus:border-blue-200 shadow-blue-100/30'}`}
                       />
                    </div>
                    {deleteError && (
                      <p className="bg-red-50 text-red-500 py-3 px-6 rounded-2xl text-[10px] font-black border border-red-100 flex items-center justify-center gap-2 animate-in shake duration-300">
                         <AlertCircle size={14} />
                         {deleteError}
                      </p>
                    )}
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-[2rem] font-black text-sm hover:bg-slate-200 transition-all active:scale-95 shadow-inner"
                    >
                       ยกเลิก
                    </button>
                    <button 
                      disabled={isDeleting || !deletePassword}
                      onClick={handleConfirmDelete}
                      className="flex-[2] py-5 bg-red-500 text-white rounded-[2rem] font-black text-sm shadow-2xl shadow-red-200 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                       {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                       {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบบัญชี'}
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Temporary Suspension Modal */}
      {isSuspendModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl relative overflow-hidden flex flex-col p-10 animate-in zoom-in-95 duration-500">
              <button onClick={() => setIsSuspendModalOpen(false)} className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
              
              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner"><Siren size={40} /></div>
                 <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">ระงับการใช้งานชั่วคราว</h2>
                    <p className="text-slate-400 font-bold px-4">ระงับบัญชี {selectedUser.fullName} ชั่วคราว</p>
                 </div>

                 <div className="space-y-6 text-left">
                    <div className="space-y-3">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">ระยะเวลาการระงับ</label>
                       <div className="grid grid-cols-3 gap-3">
                          {[7, 15, 30].map(d => (
                             <button key={d} onClick={() => setSuspendDays(d)} className={`py-4 rounded-2xl font-black text-sm transition-all border-2 ${suspendDays === d ? 'bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-100' : 'bg-slate-50 border-slate-50 text-slate-400 hover:border-orange-200'}`}>
                                {d} วัน
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-3">
                       <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 font-bold">เหตุผลการระงับ</label>
                       <textarea 
                          placeholder="ระบุเหตุผล เช่น ไม่คืนอุปกรณ์ หรือรบกวนผู้อื่น..."
                          value={penaltyReason}
                          onChange={(e) => setPenaltyReason(e.target.value)}
                          className="w-full p-6 bg-slate-50 border-2 border-slate-50 rounded-3xl outline-none font-bold text-slate-700 focus:bg-white focus:border-orange-200 transition-all min-h-[120px]"
                       />
                    </div>
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsSuspendModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-sm hover:bg-slate-200 transition-all">ยกเลิก</button>
                    <button 
                      disabled={isProcessingPenalty || !penaltyReason} 
                      onClick={handleConfirmSuspend}
                      className="flex-[2] py-5 bg-orange-500 text-white rounded-3xl font-black text-sm shadow-2xl shadow-orange-100 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                    >
                       {isProcessingPenalty ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                       ยืนยันการระงับ
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Permanent Ban Request Modal */}
      {isBanModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl relative overflow-hidden flex flex-col p-10 animate-in zoom-in-95 duration-500">
              <button onClick={() => setIsBanModalOpen(false)} className="absolute top-8 right-8 p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
              
              <div className="text-center space-y-6">
                 <div className="w-20 h-20 bg-slate-900 text-white rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl rotate-3"><UserX size={40} /></div>
                 <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">ขอระงับใช้งานถาวร</h2>
                    <p className="text-slate-400 font-bold px-4">ต้องการแบน {selectedUser.fullName} ถาวรหรือไม่?</p>
                    <div className="mt-2 bg-slate-50 p-4 rounded-2xl flex items-center gap-3 text-left">
                       <AlertCircle size={20} className="text-blue-500 flex-shrink-0" />
                       <p className="text-[10px] font-bold text-slate-500">การแบนถาวรต้องได้รับการอนุมัติจากผู้ดูแลระบบทั้งหมดในคณะกรรมการถึงจะมีผล และข้อมูลจะถูกบันทึกเข้า Blacklist ทันที</p>
                    </div>
                 </div>

                 <div className="space-y-3 text-left">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">เหตุผลที่ต้องการแบนถาวร</label>
                    <textarea 
                       placeholder="ระบุเหตุผลอย่างละเอียดสำหรับการพิจารณาของคณะกรรมการ..."
                       value={penaltyReason}
                       onChange={(e) => setPenaltyReason(e.target.value)}
                       className="w-full p-6 bg-slate-50 border-2 border-slate-50 rounded-3xl outline-none font-bold text-slate-700 focus:bg-white focus:border-slate-300 transition-all min-h-[120px]"
                    />
                 </div>

                 <div className="flex gap-4 pt-4">
                    <button onClick={() => setIsBanModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-sm hover:bg-slate-200 transition-all">ยกเลิก</button>
                    <button 
                      disabled={isProcessingPenalty || !penaltyReason} 
                      onClick={handleRequestBan}
                      className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black text-sm shadow-2xl shadow-blue-900/10 hover:bg-black transition-all flex items-center justify-center gap-2"
                    >
                       {isProcessingPenalty ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                       ส่งคำขอแบนถาวร
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
