import { PAGE_SIZES } from "../utils/editorConstants";

/**
 * Fixed top toolbar: page size info, size selector (A4/Letter/Custom only,
 * matching the original — no A5), orientation toggle, and Export PDF button.
 */
export default function EditorToolbar({
    pageSize,
    orientation,
    pdfPageHeight,
    pageCount,
    handleSizeChange,
    handleOrientationToggle,
    handleExportPDF,
    handleCaptureScreenshot,
    handleDownloadHTML,
    isGeneratingPDF,
}) {
    return (
        <div style={{
            position: 'fixed', top: '10px', left: '16px',
            zIndex: 1000, background: 'white', padding: '8px 16px', borderRadius: '10px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            display: 'flex', gap: '20px', alignItems: 'center', border: '1px solid #f3f4f6',
        }}>
            {/* Document Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '8px', fontWeight: '800', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document Details</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1f2937', fontWeight: '600' }}>
                    <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{pageCount} {pageCount === 1 ? 'Page' : 'Pages'}</span>
                    <span style={{ color: '#e5e7eb', fontSize: '8px' }}>●</span>
                    <span style={{ fontSize: '11px', color: '#4b5563' }}>{PAGE_SIZES[pageSize]?.[orientation]?.width} × {PAGE_SIZES[pageSize]?.[orientation]?.height}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: '400' }}>({pdfPageHeight?.toFixed(0)}px)</span>
                </div>
            </div>

            <div style={{ width: '1px', height: '20px', background: '#f3f4f6' }} />

            {/* Configs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Size</label>
                    <select
                        value={pageSize}
                        onChange={handleSizeChange}
                        style={{
                            padding: '4px 8px', borderRadius: '6px', border: '1px solid #e5e7eb',
                            fontSize: '12px', color: '#374151', cursor: 'pointer', background: '#f9fafb',
                            outline: 'none', fontWeight: '500'
                        }}
                    >
                        <option value="A4">A4</option>
                        <option value="LETTER">Letter</option>
                        <option value="CUSTOM">Custom...</option>
                    </select>
                </div>

                <button
                    onClick={handleOrientationToggle}
                    style={{
                        padding: '4px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
                        background: orientation === 'portrait' ? '#2563eb' : '#f9fafb',
                        color: orientation === 'portrait' ? 'white' : '#374151',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                >
                    {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                </button>
            </div>

            <div style={{ width: '1px', height: '20px', background: '#f3f4f6' }} />

            {/* Screenshot Capture */}
            <button
                onClick={handleCaptureScreenshot}
                style={{
                    padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151', fontSize: '12px', fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.1s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                </svg>
                Debug Screenshot
            </button>

            <div style={{ width: '1px', height: '20px', background: '#f3f4f6' }} />

            {/* HTML Download */}
            <button
                onClick={handleDownloadHTML}
                style={{
                    padding: '6px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#374151', fontSize: '12px', fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.1s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                Debug HTML
            </button>

            <div style={{ width: '1px', height: '20px', background: '#f3f4f6' }} />

            {/* Export PDF */}
            <button
                onClick={handleExportPDF}
                disabled={isGeneratingPDF}
                style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    background: isGeneratingPDF ? '#9ca3af' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white', fontSize: '12px', fontWeight: '700',
                    cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
                    boxShadow: isGeneratingPDF ? 'none' : '0 4px 6px -1px rgba(220, 38, 38, 0.2)',
                    transition: 'transform 0.1s active',
                }}
            >
                {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
            </button>
        </div>
    );
}
