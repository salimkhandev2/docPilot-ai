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
