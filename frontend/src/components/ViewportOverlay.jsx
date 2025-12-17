import React from "react";

const ViewportOverlay = React.memo(({ is_time, times_type, statusMessage }) => (
    <>
        {/* Main Genome Container (One box around all genome grid layers: Positions + Info + Ortho) */}
        <div
            style={{
                position: 'absolute',
                top: '1%',
                left: '5%',
                height: '85%',
                width: '95%',
                zIndex: 1,
                pointerEvents: 'none',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: 'transparent',
            }}
        >
            {/* Divider for Genome Positions area (approx 4% absolute) */}
            <div style={{ position: 'absolute', top: '3.5%', left: 0, right: 0, height: '1px', backgroundColor: '#e2e8f0' }} />
            {/* Divider for Genome Info area (approx 6% absolute) */}
            <div style={{ position: 'absolute', top: '5.8%', left: 0, right: 0, height: '1px', backgroundColor: '#e2e8f0' }} />
        </div>

        {/* Time Layer (Strictly Outside the main genome box and tree-time axis) */}
        <div
            style={{
                position: 'absolute',
                top: '6%',
                left: '0%',
                height: '80%',
                width: '2%', // Reduced from 5% to increase distance from the axis (starts at 2%)
                zIndex: 11,
                pointerEvents: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <div
                style={{
                    transform: 'rotate(-90deg)',
                    whiteSpace: 'nowrap',
                    fontSize: '10px',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    opacity: 0.8,
                }}
            >
                {is_time ? times_type : "Timeline"}
            </div>
        </div>

        {/* Processing Overlay inside viewport - focused on the main ortho area */}
        {(statusMessage?.status === "processing-file" || statusMessage?.status === "file-load") && (
            <div
                style={{
                    position: 'absolute',
                    top: '6%',
                    left: '5%',
                    height: '80%',
                    width: '95%',
                    zIndex: 20,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    borderRadius: '0 0 8px 8px',
                }}
            >
                <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white border border-slate-200">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-slate-800">Processing File</h3>
                        <p className="text-sm text-slate-500">{statusMessage?.filename || "Loading visualization..."}</p>
                    </div>
                </div>
            </div>
        )}

    </>
));

export default ViewportOverlay;
