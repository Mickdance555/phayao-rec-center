"use client";

import { useState } from "react";
import { AlertTriangle, X, Megaphone } from "lucide-react";

export default function AnnouncementModal() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl relative overflow-hidden border-4 border-amber-100/50 animate-in zoom-in-95 duration-300">
        
        {/* Top Decorative Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-8 text-white relative">
          <button 
            onClick={() => setIsOpen(false)} 
            className="absolute top-6 right-6 p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner">
              <Megaphone size={26} className="text-white animate-bounce" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white mb-1">
                ประกาศสำคัญ
              </span>
              <h2 className="text-2xl font-black tracking-tight leading-none">แจ้งปิดระบบการจองห้องซ้อม</h2>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 sm:p-10 space-y-6">
          <div className="bg-amber-50/80 border-2 border-amber-200/60 rounded-3xl p-6 flex items-start gap-4">
            <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={24} />
            <p className="text-slate-800 font-bold text-base sm:text-lg leading-relaxed">
              ปิดระบบการจองห้องซ้อมวันที่ 1 - 30 กันยายน 2569 เนื่องจากอุทยานวิทยาศาสจร์ได้มีการปรับปรุงภายในใหม่ หากมีการเปลี่ยนแปลงจะประกาศแจ้งให้ทราบอีกครั้งผ่านหน้าเว็บไซต์
            </p>
          </div>

          <div className="text-center text-xs font-bold text-slate-400">
            ศูนย์นันทนาการ องค์การบริหารส่วนจังหวัดพะเยา
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-orange-200 hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all"
          >
            รับทราบ
          </button>
        </div>

      </div>
    </div>
  );
}
