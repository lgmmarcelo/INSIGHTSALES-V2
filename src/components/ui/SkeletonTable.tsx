import React from 'react';

export function SkeletonTable() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto w-full animate-pulse">
      {/* Top Controls */}
      <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm flex flex-col md:flex-row gap-4 justify-between h-auto md:h-20">
        <div className="flex gap-4">
           <div className="h-10 bg-slate-100 rounded w-32"></div>
           <div className="h-10 bg-slate-100 rounded w-48 hidden md:block"></div>
        </div>
        <div className="flex gap-4">
           <div className="h-10 bg-slate-100 rounded w-48"></div>
           <div className="h-10 bg-slate-100 rounded w-32 hidden md:block"></div>
        </div>
      </div>

      {/* KPI Row (Optional, maybe Table page has KPIs) */}
      <div className="flex gap-4 h-24 shrink-0">
         <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm flex-1 p-4">
             <div className="h-3 bg-slate-200 rounded w-1/3 mb-4"></div>
             <div className="h-8 bg-slate-200 rounded w-1/2"></div>
         </div>
         <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm flex-1 p-4">
             <div className="h-3 bg-slate-200 rounded w-1/3 mb-4"></div>
             <div className="h-8 bg-slate-200 rounded w-1/2"></div>
         </div>
         <div className="bg-slate-50 border border-slate-200 rounded-lg shadow-sm flex-1 p-4 hidden md:block">
             <div className="h-3 bg-slate-200 rounded w-1/3 mb-4"></div>
             <div className="h-8 bg-slate-200 rounded w-1/2"></div>
         </div>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4">
           <div className="h-4 bg-slate-200 rounded w-1/12"></div>
           <div className="h-4 bg-slate-200 rounded w-3/12"></div>
           <div className="h-4 bg-slate-200 rounded w-2/12"></div>
           <div className="h-4 bg-slate-200 rounded w-2/12"></div>
           <div className="h-4 bg-slate-200 rounded w-2/12"></div>
           <div className="h-4 bg-slate-200 rounded w-2/12"></div>
        </div>
        <div className="flex flex-col">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-slate-100 px-6 py-4">
               <div className="h-4 bg-slate-100 rounded w-1/12"></div>
               <div className="h-4 bg-slate-100 rounded w-3/12"></div>
               <div className="h-4 bg-slate-100 rounded w-2/12"></div>
               <div className="h-4 bg-slate-100 rounded w-2/12"></div>
               <div className="h-4 bg-slate-100 rounded w-2/12"></div>
               <div className="h-4 bg-slate-100 rounded w-2/12"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
