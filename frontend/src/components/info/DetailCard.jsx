import React from "react";

export const DetailCard = ({ title, children }) => (
  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
    <h2 className="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">
      {title}
    </h2>
    <div className="space-y-1">
      {children}
    </div>
  </div>
);

export const DetailRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-1 border-b border-gray-100 last:border-b-0">
    <span className="font-medium text-gray-700 min-w-0 flex-1 text-sm">{label}:</span>
    <span className="text-gray-900 text-right ml-3 break-words max-w-xs text-sm">
      {value || 'N/A'}
    </span>
  </div>
);
