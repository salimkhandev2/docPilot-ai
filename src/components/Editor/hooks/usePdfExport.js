import { useState } from "react";
import { convertBlobURLsToBase64 } from "../utils/blobConverter";
import { convertToPixels } from "../utils/grapesJsHelpers";
import { PAGE_SIZES, DOCUMENT_STRICT_STYLES } from "../utils/editorConstants";

/**
 * Encapsulates PDF generation: layout settle, content extraction,
 * and Playwright backend call. Matches original exactly — no canvas
 * snapshotting, simple wrapperEl.innerHTML extraction.
 */
export function usePdfExport(editor, pdfPageHeightRef, pageSize, orientation) {
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    const handleExportPDF = async () => {
        if (!editor || !editor.getHtml) return;

        try {
            setIsGeneratingPDF(true);

            const wrapper = editor.getWrapper();
            const wrapperEl = wrapper?.view?.el;
            const frameDoc = editor.Canvas.getDocument();

            // --- FRONTEND LAYOUT SETTLE ---
            if (wrapperEl && frameDoc) {
                // 1. Wait for all images in the canvas to be ready
                const images = Array.from(frameDoc.querySelectorAll('img'));
                await Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(res => { img.onload = res; img.onerror = res; });
                }));

                // 2. Forced reflow + small settle time for Tailwind JIT
                void frameDoc.body.offsetHeight;
                await new Promise(r => setTimeout(r, 300));
            }

            // 1. Calculate the required number of pages
            const pageHeight = pdfPageHeightRef.current || 1123;
            const scrollHeight = wrapperEl ? wrapperEl.scrollHeight : 0;

            // Robust calculation: Dynamically measure the padding applied to the wrapper
            let verticalPadding = 0;
            if (wrapperEl) {
                const style = frameDoc
                    ? frameDoc.defaultView.getComputedStyle(wrapperEl)
                    : window.getComputedStyle(wrapperEl);
                verticalPadding =
                    (parseFloat(style.paddingTop) || 0) +
                    (parseFloat(style.paddingBottom) || 0);
            }

            // Subtract padding and use a 2px safety buffer for rounding
            const actualContentHeight = Math.max(0, scrollHeight - verticalPadding - 2);
            const numPages = Math.max(1, Math.ceil(actualContentHeight / pageHeight));

            // 2. Get content HTML exactly as original — simple innerHTML
            let contentHtml = wrapperEl ? wrapperEl.innerHTML : editor.getHtml();
            contentHtml = await convertBlobURLsToBase64(contentHtml);

            let css = editor.getCss();

            // Ensure the strict document behavior is included in the PDF CSS
            css = DOCUMENT_STRICT_STYLES + `
        /* Force symbols and characters to render even if clipped */
        * {
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
          line-height: normal !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
          orphans: 1 !important;
          widows: 1 !important;
        }

        .pdf-viewport {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
        }

        .pdf-shifter {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
        }
      ` + "\n" + css;

            const size = PAGE_SIZES[pageSize]?.[orientation];
            const pixelWidth = convertToPixels(size.width, frameDoc);
            const pixelHeight = pageHeight;

            const exportData = {
                html: contentHtml,
                numPages,
                css,
                pageConfig: {
                    width: size.width,
                    height: size.height,
                    pixelWidth,
                    pixelHeight,
                },
                scripts: [
                    'https://cdn.tailwindcss.com',
                ],
                styles: [
                    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
                ],
            };

            const response = await fetch('/api/playwright', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exportData),
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

    return { handleExportPDF, isGeneratingPDF };
}
