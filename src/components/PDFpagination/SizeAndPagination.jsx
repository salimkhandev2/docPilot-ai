'use client';

import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import { useEffect, useRef, useState } from 'react';

const PAGE_SIZES = {
    A4: {
        portrait: { width: '210mm', height: '297mm' },
        landscape: { width: '297mm', height: '210mm' },
    },
    LETTER: {
        portrait: { width: '8.5in', height: '11in' },
        landscape: { width: '11in', height: '8.5in' },
    },
    A5: {
        portrait: { width: '148mm', height: '210mm' },
        landscape: { width: '210mm', height: '148mm' },
    },
    CUSTOM: {
        portrait: { width: '210mm', height: '297mm' },
        landscape: { width: '297mm', height: '210mm' },
    },
};


export default function VisualPaginationEditor() {
    const editorRef = useRef(null);
    const containerRef = useRef(null);

    const [pageSize, setPageSize] = useState('A4');
    const [orientation, setOrientation] = useState('portrait');
    const [pageCount, setPageCount] = useState(1);
    const [showCustomModal, setShowCustomModal] = useState(false);
    const [customWidth, setCustomWidth] = useState('210');
    const [customHeight, setCustomHeight] = useState('297');
    const [pdfPageHeight, setPdfPageHeight] = useState(1123); // Default to A4 px height (via HTML example)
    const [customUnit, setCustomUnit] = useState('mm');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => {
        if (!containerRef.current || editorRef.current) return;

        const editor = grapesjs.init({
            container: containerRef.current,
            // height: '100vh',
            width: 'auto',
            storageManager: false,
            fromElement: false,
            canvas: {
                // scripts: ['https://cdn.tailwindcss.com'],
                // styles: ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'],
            },
        });

        editorRef.current = editor;

        editor.Components.addType('visual-page', {
            model: {
                defaults: {
                    tagName: 'div',
                    attributes: { class: 'visual-page' },
                    draggable: false,
                    droppable: true,
                    copyable: false,
                    selectable: false,
                    removable: false,
                    hoverable: false,
                    style: {
                        width: '210mm',
                        maxWidth: '210mm',
                        minWidth: '210mm',
                        margin: '0 auto',
                        background: 'white',
                        padding: '0px',
                        position: 'relative',
                        display: 'flow-root',
                        overflowAnchor: 'none',
                    },
                },
            },
        });


        editor.on('load', () => {
            const wrapper = editor.getWrapper();


            wrapper.setStyle({
                background: 'black',
                padding: '80px 20px 40px',
                minHeight: '100vh',
            });

            // Add styles for the page break indicator in the editor


            if (!wrapper.find('.visual-page').length) {
                const firstPage = wrapper.append({ type: 'visual-page' });
                const page = Array.isArray(firstPage) ? firstPage[0] : firstPage;

                page.append(`
                    <div>
                        When you print or export to PDF, Playwright will use these exact dimensions and automatically handle text splitting and page breaks.
                        <div id='id_12'>Hello</div>
                    </div>
                `);
            } else {
                console.log('❌ Condition failed - page already exists');
            }

            applyPageSize(pageSize, orientation);
            addPrintStyles();
            updatePageCount();
        });

        function convertToPixels(cssValue, frameDoc) {
            const testEl = frameDoc.createElement('div');
            testEl.style.cssText = `position: absolute; visibility: hidden; height: ${cssValue};`;
            frameDoc.body.appendChild(testEl);
            const pixels = testEl.offsetHeight;
            frameDoc.body.removeChild(testEl);
            return pixels;
        }

        // Visual page break markers (no auto page creation)
        let markerTimeout = null;

        editor.on('component:add component:update', () => {
            clearTimeout(markerTimeout);
            markerTimeout = setTimeout(() => {
                updatePageBreakMarkers();
            }, 300);
        });

        function applyPageSize(sizeKey, orient) {
            const size = PAGE_SIZES[sizeKey]?.[orient];
            if (!size) return;

            const wrapper = editor.getWrapper();
            const pages = wrapper.find('.visual-page');

            pages.forEach(page => {
                page.addStyle({
                    width: size.width,
                });
            });

            addPrintStyles(sizeKey, orient);
            // Re-calculate indicators when page size changes
            if (editorRef.current?.updateMarkers) {
                editorRef.current.updateMarkers();
            }
        }

        function addPrintStyles(sizeKey, orient) {
            const size = PAGE_SIZES[sizeKey]?.[orient];
            if (!size) return;

            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            const oldStyle = frameDoc.getElementById('print-styles');
            if (oldStyle) oldStyle.remove();

            // NOTE: server-side Playwright will override this
            const printStyle = `
                @media print {
                    @page {
                        size: A4; /* Default fallback */
                    }
                    .content {
                        width: ${size.width};
                        margin: 0 auto;
                        background: white;
                        display: flow-root;
                    }
                    body {
                        background: black;
                        padding: 0;
                    }
                    .page-break-indicator {
                        display: none !important;
                    }
                }
            `;

            const styleEl = frameDoc.createElement('style');
            styleEl.id = 'print-styles';
            styleEl.textContent = printStyle;
            frameDoc.head.appendChild(styleEl);
        }

        function updatePageCount() {
            const wrapper = editor.getWrapper();
            const pages = wrapper.find('.visual-page');
            setPageCount(pages.length);
        }

        editorRef.current.getEditor = () => editor;
        editorRef.current.applyPageSize = applyPageSize;
        editorRef.current.updatePageCount = updatePageCount;
    }, []); // End of mount effect. 

    // Effect to update editor when size/orientation changes
    useEffect(() => {
        if (editorRef.current && editorRef.current.applyPageSize) {
            editorRef.current.applyPageSize(pageSize, orientation);
        }
    }, [pageSize, orientation]);

    // We need to keep a ref to the current pdfPageHeight so the static closure functions can see it
    const pdfPageHeightRef = useRef(1123);
    useEffect(() => {
        pdfPageHeightRef.current = pdfPageHeight;
        if (editorRef.current?.updateMarkers) {
            editorRef.current.updateMarkers();
        }
    }, [pdfPageHeight]);

    // Re-attach the marker logic properly to access the Ref
    useEffect(() => {
        if (!editorRef.current) return;

        const editor = editorRef.current;

        function updatePageBreakMarkers() {
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            const wrapper = editor.getWrapper();
            const pages = wrapper.find('.visual-page');

            // Use the calibrated height
            const pageHeight = pdfPageHeightRef.current;
            if (!pageHeight || pageHeight <= 0) return;

            pages.forEach(page => {
                if (!page.view) return;

                const el = page.view.el;

                // Remove old markers first
                const oldMarkers = el.querySelectorAll('.page-break-indicator');
                oldMarkers.forEach(marker => marker.remove());

                // Total content height of the visual-page element
                const totalContentHeight = el.scrollHeight;

                // Calculate number of pages based purely on calibrated height
                const numberOfPages = Math.ceil(totalContentHeight / pageHeight);

                // Only add indicators if content exceeds one page
                if (numberOfPages <= 1) return;

                // Add visual indicators at each page boundary
                for (let i = 1; i < numberOfPages; i++) {
                    const marker = frameDoc.createElement('div');
                    marker.className = 'page-break-indicator';

                    // Position at exact CALIBRATED page height multiples
                    // Logic from HTML: top = i * pageHeight
                    // We need to offset slightly as per HTML example (top: i * pageHeight)
                    // The HTML example uses: line.style.top = (i * pageHeight) + 'px';

                    marker.style.cssText = `
                        position: absolute;
                        left: 0;
                        right: 0;
                        top: ${i * pageHeight}px;
                        height: 3px;
                        background: repeating-linear-gradient(90deg,
                            #ff0000 0px,
                            #ff0000 20px,
                            transparent 20px,
                            transparent 40px);
                        pointer-events: none;
                        z-index: 1000;
                    `;

                    // Add page number label
                    const label = frameDoc.createElement('span');
                    label.textContent = `PAGE BREAK ${i} / ${numberOfPages - 1} @ ${(i * pageHeight).toFixed(0)}px`;
                    label.style.cssText = `
                        position: absolute;
                        right: 20px;
                        top: -22px;
                        background: #ff0000;
                        color: white;
                        padding: 6px 12px;
                        font-size: 11px;
                        font-weight: bold;
                        border-radius: 3px;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                        white-space: nowrap;
                    `;
                    marker.appendChild(label);
                    el.appendChild(marker);
                }

                console.log(`📄 Indicators: ${numberOfPages} pages (calibrated height: ${pageHeight})`);
            });
        }

        editor.updateMarkers = updatePageBreakMarkers;

        // Listen to events
        editor.off('component:add component:update'); // Clear old listeners to avoid dupes/stale closures
        let markerTimeout;
        editor.on('component:add component:update', () => {
            clearTimeout(markerTimeout);
            markerTimeout = setTimeout(() => {
                updatePageBreakMarkers();
            }, 300);
        });

        // Initial run
        updatePageBreakMarkers();

    }, []); // Run once to bind, but rely on ref for values

    // ... (rest of the file) ...


    const handleExportPDF = async () => {
        if (!editorRef.current?.getEditor) return;

        try {
            setIsGeneratingPDF(true);

            const editor = editorRef.current.getEditor();
            const size = PAGE_SIZES[pageSize]?.[orientation];

            // CRITICAL FIX: Get HTML from iframe document to capture dynamic markers
            const frameDoc = editor.Canvas.getDocument();
            const wrapper = editor.getWrapper();
            const wrapperEl = wrapper?.view?.el;

            // Get actual rendered HTML including dynamically added markers
            const html = wrapperEl ? wrapperEl.innerHTML : editor.getHtml();
            let css = editor.getCss();

            // DEBUG: Check if markers are in the HTML
            const markerCount = (html.match(/page-break-indicator/g) || []).length;
            if (markerCount === 0) {
                console.warn('   ⚠️ No markers found! Check updatePageBreakMarkers()');
            }

            // Convert camelCase CSS properties to kebab-case
            css = css.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

            const exportData = {
                html,
                css,
                pageConfig: {
                    width: size.width,
                    height: size.height,
                }
            };

            const response = await fetch('/api/playwright', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    html: exportData.html,
                    css: exportData.css,
                    pageConfig: exportData.pageConfig,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate PDF');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document.pdf';
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSizeChange = (e) => {
        const newSize = e.target.value;
        if (newSize === 'CUSTOM') {
            setShowCustomModal(true);
        } else {
            setPageSize(newSize);
        }
    };

    const handleOrientationToggle = () => {
        setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
    };

    const applyCustomSize = () => {
        PAGE_SIZES.CUSTOM = {
            portrait: {
                width: `${customWidth}${customUnit}`,
                height: `${customHeight}${customUnit}`
            },
            landscape: {
                width: `${customHeight}${customUnit}`,
                height: `${customWidth}${customUnit}`
            },
        };
        setPageSize('CUSTOM');
        setShowCustomModal(false);
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>

            <div style={{
                position: 'fixed', top: '10px', left: '50%', transform: 'translateX(-50%)',
                zIndex: 1000, background: 'white', padding: '12px 20px', borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', display: 'flex', gap: '16px',
                alignItems: 'center', border: '1px solid #e5e7eb',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>PDF Page Height (px):</span>
                        <input
                            type="number"
                            value={pdfPageHeight || ''}
                            onChange={(e) => setPdfPageHeight(Number(e.target.value))}
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '12px', width: '80px' }}
                        />
                    </label>
                </div>

                <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Size:</label>
                    <select value={pageSize} onChange={handleSizeChange} style={{
                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
                        fontSize: '14px', cursor: 'pointer', background: 'white',
                    }}>
                        <option value="A4">A4</option>
                        <option value="LETTER">Letter</option>
                        <option value="CUSTOM">Custom...</option>
                    </select>
                </div>

                <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />

                <button onClick={handleOrientationToggle} style={{
                    padding: '6px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                    background: orientation === 'portrait' ? '#3b82f6' : '#f3f4f6',
                    color: orientation === 'portrait' ? 'white' : '#374151',
                    fontSize: '14px', fontWeight: '500', cursor: 'pointer',
                }}>
                    📄 {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
                </button>

                <div style={{ width: '1px', height: '24px', background: '#e5e7eb' }} />



                <button onClick={handleExportPDF} disabled={isGeneratingPDF} style={{
                    padding: '6px 16px', borderRadius: '6px', border: '1px solid #ef4444',
                    background: isGeneratingPDF ? '#9ca3af' : '#ef4444',
                    color: 'white', fontSize: '14px', fontWeight: '500',
                    cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
                    opacity: isGeneratingPDF ? 0.7 : 1,
                }}>
                    {isGeneratingPDF ? '⏳ Generating...' : '📄 Export PDF'}
                </button>
            </div>


            {showCustomModal && (
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
                                <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)}
                                    style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }}>
                                    <option value="mm">mm</option>
                                    <option value="in">in</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>Height</label>
                            <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowCustomModal(false)} style={{
                                padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db',
                                background: 'white', cursor: 'pointer',
                            }}>Cancel</button>
                            <button onClick={applyCustomSize} style={{
                                padding: '8px 16px', borderRadius: '6px', border: 'none',
                                background: '#3b82f6', color: 'white', cursor: 'pointer',
                            }}>Apply</button>
                        </div>
                    </div>
                </div>
            )}

            <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
        </div>
    );
}