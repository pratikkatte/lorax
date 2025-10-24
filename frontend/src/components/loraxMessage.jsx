import React from "react";

// const statusColors = {
//   info: "bg-blue-50 text-blue-700 border-blue-200",
//   success: "bg-emerald-50 text-emerald-800 border-emerald-300",
//   warning: "bg-yellow-50 text-yellow-700 border-yellow-200",
//   error: "bg-red-50 text-red-700 border-red-200",
// };

const LoraxMessage = ({ message, status = "info", className = "" }) => {
  if (!message) return null;
  return (
    <div className="w-full h-full flex justify-center items-center">
    <div className="text-sm text-gray-500">{message}</div>
  </div>
  );
};

export default LoraxMessage;
