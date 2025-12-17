import React from "react";

const ViewportOverlay = React.memo(({ is_time, times_type, statusMessage }) => (
    <>
        {/* Outer border */}
        <div
            style={{
                position: 'absolute',
                top: '1%',
                left: '2%',
                height: '85%',
                width: '98%',
                zIndex: 1,
                pointerEvents: 'none',
                border: '2px solid #b5b5b5',
                borderRadius: '8px',
                boxShadow: '0 0 0 2px #f8f8f8, 0 2px 6px rgba(0,0,0,0.1)',
                backgroundColor: 'transparent',
            }}
        />

        {/* genome positions */}
        <div
            style={{
                position: 'absolute',
                top: '1%',
                left: '5%',
                height: '3%',
                width: '95%',
                zIndex: 10,
                pointerEvents: 'none',
                // border: '1px solid #d0d0d0',
                borderBottom: '1px solid #cccccc',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
        />
        {/* genome info */}
        <div
            style={{
                position: 'absolute',
                top: '4%',
                left: '5%',
                height: '2%',
                width: '95%',
                zIndex: 10,
                pointerEvents: 'none',
                // border: '1px solid #d0d0d0',
                borderBottom: '1px solid #d0d0d0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
        />
        {/* tree time */}
        <div
            style={{
                position: 'absolute',
                top: '1%',
                left: '2%',
                height: '85%',
                width: '3%',
                zIndex: 10,
                pointerEvents: 'none',
                // border: '1px solid #d0d0d0',
                borderRight: '1px solid rgba(232, 226, 226, 0.96)',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                justifyContent: 'flex-end',
            }}
        >
            {/* vertical label */}
            <div
                style={{
                    display: 'flex',
                    transform: 'rotate(-90deg)',
                    whiteSpace: 'nowrap',
                    fontSize: '12px',
                    color: '#333',
                    fontWeight: 500,
                    letterSpacing: '2px',
                    // padding: '0 10px',
                }}
            >
                {is_time ? times_type : "No Time Data"}
            </div>
        </div>

        {/* Processing Overlay inside viewport */}
        {(statusMessage?.status === "processing-file" || statusMessage?.status === "file-load") && (
            <div
                style={{
                    position: 'absolute',
                    top: '1%',
                    left: '2%',
                    height: '85%',
                    width: '98%',
                    zIndex: 20,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    backdropFilter: 'blur(2px)',
                    borderRadius: '8px',
                }}
            >
                <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white shadow-xl border border-slate-200">
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
