"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
  User, 
  Phone, 
  CreditCard, 
  UserPlus, 
  ArrowRight, 
  Loader2,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { doc, setDoc, Timestamp, collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { hashSHA256 } from "@/lib/crypto";

export default function RegisterPage() {
  const { firebaseUser, user: profile, loading: authLoading, refreshUserProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    idCard: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!firebaseUser) {
        router.push("/");
      } else if (profile) {
        router.push("/dashboard");
      }
    }
  }, [firebaseUser, profile, authLoading, router]);

  const generateMemberId = async (): Promise<string> => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("memberId", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    
    let lastId = 0;
    if (!querySnapshot.empty) {
      const lastUser = querySnapshot.docs[0].data();
      const match = lastUser.memberId.match(/PY-REC-(\d+)/);
      if (match) {
        lastId = parseInt(match[1], 10);
      }
    }
    
    const nextId = (lastId + 1).toString().padStart(4, '0');
    return `PY-REC-${nextId}`;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    
    if (formData.idCard.length !== 13) {
      setError("เลขบัตรประชาชนต้องครบ 13 หลัก");
      return;
    }
    
    setIsSubmitting(true);
    setError("");
    
    try {
      // PDPA - Compliance: Hash before checking against Blacklist
      const hashedPhone = await hashSHA256(formData.phone.trim());
      const hashedIdCard = await hashSHA256(formData.idCard.trim());

      // Security: Blacklist Check (Querying hashed values)
      const blacklistChecks = [
        query(collection(db, "blacklist"), where("email", "==", firebaseUser.email)),
        query(collection(db, "blacklist"), where("fullName", "==", formData.fullName.trim())),
        query(collection(db, "blacklist"), where("phone", "==", hashedPhone)),
        query(collection(db, "blacklist"), where("idCard", "==", hashedIdCard))
      ];

      for (const q of blacklistChecks) {
        const snap = await getDocs(q);
        if (!snap.empty) {
          setError("ขออภัย ข้อมูลระบุตัวตนของคุณอยู่ในบัญชีรายชื่อผู้กระทำความผิด (Blacklist) ไม่สามารถสมัครสมาชิกได้");
          setIsSubmitting(false);
          return;
        }
      }

      const memberId = await generateMemberId();
      const newUserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        memberId: memberId,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        idCard: formData.idCard.trim(),
        role: "user",
        status: "active",
        createdAt: Timestamp.now()
      };
      
      await setDoc(doc(db, "users", firebaseUser.uid), newUserProfile);
      
      // Force state refresh
      await refreshUserProfile();
      
      // Smaller delay to let state propagate
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
      
    } catch (err) {
      console.error(err);
      setError("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.fullName.length > 2 && formData.phone.length >= 9 && formData.idCard.length === 13;

  if (authLoading || (firebaseUser && profile)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
         <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F7FF] flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl rotate-6 mb-8 transform hover:rotate-0 transition-transform">
            <UserPlus size={48} />
          </div>
          <h1 className="text-4xl font-extrabold text-[#112D4E] mb-4 tracking-tight">ลงทะเบียนสมาชิก</h1>
          <p className="text-slate-500 font-bold text-xl leading-relaxed">
            กรุณากรอกข้อมูลเพื่อเข้าใช้งาน <br />
            <span className="text-blue-600 font-black">สมัครฟรี ใช้งานได้ทันที</span>
          </p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-[4rem] shadow-2xl p-10 sm:p-16 space-y-10 border border-white relative overflow-hidden">
           <div className="absolute -top-10 -right-10 p-4 opacity-5 pointer-events-none rotate-12">
              <CalendarCheck size={240} />
           </div>

           {error && (
             <div className="p-5 bg-red-50 text-red-600 text-lg font-black rounded-3xl flex items-center gap-4 border-2 border-red-100">
                <CreditCard size={24} />
                {error}
             </div>
           )}

           <div className="space-y-8 relative z-10">
              <div className="space-y-4">
                <label className="text-lg font-black text-slate-400 uppercase tracking-widest pl-4">ชื่อ - นามสกุล</label>
                <input required type="text" placeholder="ตัวอย่าง: นายมานะ รักเรียน" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} className="w-full px-8 py-6 bg-slate-50 border-4 border-slate-50 rounded-[2.5rem] text-2xl font-black focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-4">
                <label className="text-lg font-black text-slate-400 uppercase tracking-widest pl-4">เบอร์โทรศัพท์</label>
                <input required type="tel" maxLength={10} placeholder="08xxxxxxxx" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} className="w-full px-8 py-6 bg-slate-50 border-4 border-slate-50 rounded-[2.5rem] text-2xl font-black focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner" />
              </div>
              <div className="space-y-4">
                <label className="text-lg font-black text-slate-400 uppercase tracking-widest pl-4">เลขบัตรประชาชน (13 หลัก)</label>
                <div className="relative">
                  <input required type="text" maxLength={13} placeholder="เลขบัตรประชาชน 13 หลัก" value={formData.idCard} onChange={(e) => setFormData({...formData, idCard: e.target.value.replace(/\D/g, '')})} className="w-full px-8 py-6 bg-slate-50 border-4 border-slate-50 rounded-[2.5rem] text-2xl font-black focus:bg-white focus:border-blue-200 outline-none transition-all shadow-inner" />
                  {formData.idCard.length === 13 && <div className="absolute right-6 top-1/2 -translate-y-1/2 text-green-500"><CheckCircle2 size={32} /></div>}
                </div>
              </div>
           </div>

           <button 
             disabled={isSubmitting || !isFormValid} 
             type="submit" 
             className={`w-full py-7 rounded-[2.5rem] text-2xl font-black shadow-2xl transition-all active:scale-90 flex items-center justify-center gap-4 mt-12 disabled:opacity-30 disabled:scale-100 ${isFormValid ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-slate-200 text-slate-400'}`}
           >
             {isSubmitting ? <Loader2 className="animate-spin" size={32} /> : <>ลงทะเบียนสมาชิก <ArrowRight size={32} /></>}
           </button>
           
           <div className="mt-10 flex flex-col items-center justify-center gap-2 text-center">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                 <ShieldCheck size={14} className="text-blue-500" />
                 PDPA COMPLIANT
              </div>
              <p className="text-[12px] font-bold text-slate-400">ข้อมูลของท่านจะถูกเข้ารหัสเพื่อความปลอดภัยตามมาตรฐานความปลอดภัยข้อมูลส่วนบุคคล</p>
           </div>
        </form>
      </div>
    </div>
  );
}
