import React from 'react';

export function SkeletonDashboard() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto font-sans animate-pulse">
      {/* Filter Bar */}
      <div className="bg-white p-4 border border-slate-200 rounded-lg h-24 shadow-sm w-full">
        <div className="h-6 bg-slate-200 rounded w-1/4 mb-4"></div>
        <div className="flex gap-4">
          <div className="h-8 bg-slate-100 rounded w-32"></div>
          <div className="h-8 bg-slate-100 rounded w-48"></div>
          <div className="h-8 bg-slate-100 rounded w-48"></div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 shrink-0">
        <div className="bg-sky-50/50 border border-sky-100/50 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-sky-200 rounded w-2/3"></div>
          <div className="h-8 bg-sky-200 rounded w-1/2"></div>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-emerald-200 rounded w-2/3"></div>
          <div className="h-8 bg-emerald-200 rounded w-1/2"></div>
        </div>
        <div className="xl:col-span-2 bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
           <div className="h-3 bg-indigo-200 rounded w-1/3"></div>
           <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 h-10 bg-indigo-100/50 rounded"></div>
             <div className="flex-1 h-10 bg-indigo-100/50 rounded"></div>
             <div className="flex-1 h-10 bg-indigo-100/50 rounded"></div>
           </div>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg shadow-sm h-32 flex flex-col justify-between">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-8 bg-slate-200 rounded w-1/2"></div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-5 shrink-0">
        <div className="bg-slate-50 p-5 border border-slate-200 rounded-lg shadow-sm h-80">
           <div className="h-4 bg-slate-200 rounded w-1/4 mb-10"></div>
           <div className="flex h-48 items-end gap-2 justify-between">
              {[...Array(20)].map((_, i) => (
                 <div key={i} className="bg-slate-200 w-full rounded-t" style={{ height: `${Math.random() * 80 + 20}%`}}></div>
              ))}
           </div>
        </div>
        <div className="bg-slate-50 p-5 border border-slate-200 rounded-lg shadow-sm h-80">
           <div className="h-4 bg-slate-200 rounded w-1/4 mb-10"></div>
           <div className="flex h-48 items-end gap-2 justify-between">
              {[...Array(20)].map((_, i) => (
                 <div key={i} className="bg-slate-200 w-full rounded-t" style={{ height: `${Math.random() * 80 + 20}%`}}></div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
