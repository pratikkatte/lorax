import React from "react";

export default function FeatureCard({ icon, title, desc }) {
    return (
        <div className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl grid place-items-center bg-teal-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                    <span className="text-2xl">{icon}</span>
                </div>
                <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 mb-2">{title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
                </div>
            </div>
        </div>
    );
}
