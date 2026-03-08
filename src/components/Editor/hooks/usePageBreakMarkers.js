import { useEffect, useRef } from "react";
import { findComponentsNearRedLines } from "../utils/findNearMarkers";

/**
 * Registers GrapesJS event listeners that draw rich visual page-break
 * indicators inside the canvas. Matches the original implementation exactly:
 *  - Dashed gradient line (solid red when broken)
 *  - "PAGE N START" / "⚠️ PAGE N OVERLAP" label
 *  - Box-shadow glow on broken lines
 *  - Debounced 800ms trigger on all relevant events + canvas:drop + load
 *  - Early-exit when page fits on a single page
 *  - Enterprise Optimization: Strict Stateful Memory to kill React Redraw Thrashing
 */
export function usePageBreakMarkers(editor, pdfPageHeightRef, setPageCount, setLayoutIssues) {
    // Memory cache to prevent aggressive React re-renders when numbers don't change
    const lastPageCount = useRef(-1);
    const lastIssueCount = useRef(-1);

    useEffect(() => {
        if (!editor) return;

        function updatePageBreakMarkers() {
            if (!editor || !editor.Canvas) return;
            const frameDoc = editor.Canvas.getDocument();
            if (!frameDoc) return;

            // Find the visual-page container (support both class and id selectors like original)
            const wrapper = editor.getWrapper();
            const pages = wrapper.find(".visual-page, #visual-page-id");

            // Use the calibrated height from the ref
            const pageHeight = pdfPageHeightRef.current;
            if (!pageHeight || pageHeight <= 0) return;

            // Check for layout issues (crossings)
            const results = findComponentsNearRedLines(editor, 10);

            // Optimization #1: Prevent React State Thrashing
            if (lastIssueCount.current !== results.length) {
                setLayoutIssues(results.length);
                lastIssueCount.current = results.length;
            }

            let totalVirtualPages = 0;

            pages.forEach((page) => {
                const el = page.getEl();
                if (!el) return;

                // Remove old markers first
                const oldMarkers = el.querySelectorAll(".page-break-indicator");
                oldMarkers.forEach((marker) => marker.remove());

                // Total content height
                const totalContentHeight = el.scrollHeight;
                const numberOfPages = Math.ceil(totalContentHeight / pageHeight);

                // Add to total count
                totalVirtualPages += Math.max(1, numberOfPages);

                // Early exit: no page breaks needed if content fits on one page
                if (numberOfPages <= 1) return;

                // Add visual indicators for each page boundary
                for (let i = 1; i < numberOfPages; i++) {
                    const markerY = i * pageHeight;
                    const isBroken = results.some((r) =>
                        r.boxes.some((b) => b.markerY === markerY)
                    );

                    const marker = frameDoc.createElement("div");
                    marker.className = "page-break-indicator";
                    marker.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            top: ${markerY}px;
            height: 2px;
            background: ${isBroken
                            ? "#ff4444"
                            : "repeating-linear-gradient(90deg, #ff4444 0, #ff4444 15px, transparent 15px, transparent 30px)"};
            box-shadow: ${isBroken ? "0 0 10px rgba(255, 68, 68, 0.5)" : "none"};
            pointer-events: none;
            z-index: 9999;
            transition: all 0.3s ease;
          `;

                    const label = frameDoc.createElement("span");
                    label.textContent = isBroken
                        ? `⚠️ PAGE ${i + 1} OVERLAP`
                        : `PAGE ${i + 1} START`;
                    label.style.cssText = `
            position: absolute;
            right: 5px;
            top: 2px;
            background: #ff4444;
            color: white;
            padding: 1px 6px;
            font-size: 9px;
            font-weight: bold;
            border-radius: 3px;
            white-space: nowrap;
            opacity: ${isBroken ? "1" : "0.7"};
            transform: ${isBroken ? "scale(1.1)" : "scale(1)"};
            transition: all 0.3s ease;
          `;

                    marker.appendChild(label);
                    el.appendChild(marker);
                }
            });

            // Optimization #2: Prevent React State Thrashing on global Page Count
            if (lastPageCount.current !== totalVirtualPages) {
                setPageCount(totalVirtualPages);
                lastPageCount.current = totalVirtualPages;
            }
        }

        editor.updateMarkers = updatePageBreakMarkers;

        // Debounced trigger — strongly throttled with Animation Frame alignment
        // Bumped to 800ms: This ensures it waits for the user to comfortably *finish* typing
        // a word or dragging a box before calculating 15 pages worth of geometry.
        let markerTimeout;
        const triggerUpdate = () => {
            clearTimeout(markerTimeout);
            markerTimeout = setTimeout(() => {
                requestAnimationFrame(updatePageBreakMarkers);
            }, 800);
        };

        // Listen to ALL relevant events (includes canvas:drop and load like the original)
        editor.on(
            "component:add component:remove component:update component:styleUpdate canvas:drop load",
            triggerUpdate
        );

        // Initial run
        updatePageBreakMarkers();

        return () => {
            editor.off(
                "component:add component:remove component:update component:styleUpdate canvas:drop load",
                triggerUpdate
            );
        };
    }, [editor]);
}
