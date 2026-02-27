/**
 * Modal dialog for custom page dimensions.
 * Unit options are mm and in only — matching the original.
 */
export default function CustomPageSizeModal({
    customWidth, setCustomWidth,
    customHeight, setCustomHeight,
    customUnit, setCustomUnit,
    onCancel, onApply,
}) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: 'white', padding: '24px', borderRadius: '12px', width: '400px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Custom Page Size</h3>

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Width</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="number"
                            value={customWidth}
                            onChange={(e) => setCustomWidth(e.target.value)}
                            style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                        {/* mm and in only — matches original */}
                        <select
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        >
                            <option value="mm">mm</option>
                            <option value="in">in</option>
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Height</label>
                    <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                            background: 'white', cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onApply}
                        style={{
                            padding: '8px 16px', borderRadius: '6px', border: 'none',
                            background: '#3b82f6', color: 'white', cursor: 'pointer',
                        }}
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
