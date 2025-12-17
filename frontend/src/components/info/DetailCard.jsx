import React from "react";

export const DetailCard = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-4 hover:shadow-md transition-shadow duration-200">
    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 pb-2 border-b border-slate-100">
      {title}
    </h2>
    <div className="space-y-2">
      {children}
    </div>
  </div>
);

export const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-slate-50 last:border-b-0">
    <span className="font-semibold text-slate-700 text-sm">{label}</span>
    <span className="text-slate-600 text-right ml-4 text-sm break-words font-medium">
      {value || 'N/A'}
    </span>
  </div>
);
