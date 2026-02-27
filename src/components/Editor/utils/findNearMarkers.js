/**
 * Page Break Handler — Universal Hybrid Strategy
 *
 * ROOT FIX: All positions are measured exclusively via getBoundingClientRect()
 * so they are in the same coordinate space (viewport-relative, zoom-safe).
 * The previous bug was mixing parseFloat(m.style.top) [CSS pixels] with
 * getBoundingClientRect() [viewport pixels] — these diverge under GrapesJS zoom.
 *
 * STRATEGY A — Small / single-line component (heading, label, image):
 *   Push the WHOLE component below the marker: margin-top += shift
 *   shift = (markerY - compTop) + clearance
 *
 * STRATEGY B — Multi-line paragraph with danger in the middle:
 *   Nudge with padding-top (one line-height per iteration via GrapesJS API)
 *   so text reflows naturally without a visible gap above the paragraph.
 *
 * LOOP: iterative — fix topmost → re-scan → fix next → until clean.
 * fixedIds prevents re-processing components that already got margin-push.
 * Padding-path components are NOT in fixedIds so they can be nudged again
 * if one line-height step wasn't enough.
 */

/**
 * Collects all leaf block-level components in the editor.
 * This is the 'Inclusive Scan' phase.
 */
export const findBlockCandidates = (editor) => {
    if (!editor) return [];
    const wrapper = editor.getWrapper();
    const page = wrapper.find('.visual-page')[0] || wrapper.find('#visual-page-id')[0];
    if (!page) return [];

    const INLINE_TAGS = new Set(['span', 'a', 'i', 'b', 'em', 'strong', 'label', 'abbr', 'cite', 'font']);
    const allComponents = wrapper.find('*');
    const candidates = [];

    allComponents.forEach(comp => {
        let el = comp.getEl();
        if (!el || typeof el.getBoundingClientRect !== 'function') return;
        if (el.closest?.('.page-break-indicator')) return;
        if (['wrapper', 'visual-page'].includes(comp.get('type'))) return;

        // Walk up from inline elements to find a fixable block container
        let targetComp = comp;
        let targetEl = el;
        while (targetEl && targetEl.tagName && (INLINE_TAGS.has(targetEl.tagName.toLowerCase()) || targetEl.tagName.toLowerCase() === 'br')) {
            const parent = targetComp.parent();
            if (!parent) break;
            targetComp = parent;
            targetEl = parent.getEl();
        }
        if (!targetEl) return;

        candidates.push({ id: targetComp.getId(), comp: targetComp });
    });

    // Deduplicate
    const seenIds = new Set();
    const unique = candidates.filter(c => {
        if (seenIds.has(c.id)) return false;
        seenIds.add(c.id);
        return true;
    });

    return unique; // Return all viable block candidates; overlapping resolution happens per-marker
};

/**
 * Detailed line-level analysis of a component against a specific marker.
 * Supports accumulatedShift for 'Greedy' fixes.
 */
export const checkComponentBroken = (editor, comp, markerY, options = {}) => {
    const { accumulatedShift = 0, threshold = 10 } = options;
    const el = comp.getEl();
    if (!el) return null;

    const page = editor.getWrapper().find('.visual-page')[0] || editor.getWrapper().find('#visual-page-id')[0];
    if (!page) return null;
    const pageRect = page.getEl().getBoundingClientRect();
    const frameDoc = editor.Canvas.getDocument();

    const compRect = el.getBoundingClientRect();
    const vTop = (compRect.top - pageRect.top) + accumulatedShift;
    const vBottom = (compRect.bottom - pageRect.top) + accumulatedShift;

    // Geometric short-circuit
    if (vTop > (markerY + 2) || vBottom < (markerY - threshold - 5)) return null;

    // Line-level scan
    const walker = frameDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const rects = [];
    let node;
    while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = frameDoc.createRange();
        range.selectNodeContents(node);
        const cRects = range.getClientRects();
        for (let i = 0; i < cRects.length; i++) rects.push(cRects[i]);
    }
    if (rects.length === 0) rects.push(compRect);

    const brokenLines = [];
    rects.forEach(r => {
        const rTop = (r.top - pageRect.top) + accumulatedShift;
        const rBottom = (r.bottom - pageRect.top) + accumulatedShift;
        const endsNear = rTop < markerY && rBottom >= (markerY - threshold) && rBottom <= (markerY + 2);
        const spansLine = rTop < markerY && rBottom > markerY;
        if (endsNear || spansLine) {
            brokenLines.push({ rect: r, isOverlap: spansLine, vTop: rTop, vBottom: rBottom });
        }
    });

    if (brokenLines.length === 0) return null;

    return {
        comp,
        vTop,
        vBottom,
        compHeight: compRect.height,
        brokenLines,
        isMultiLine: rects.length > 1
    };
};

/**
 * Compatibility shim for legacy UI code. Returns an array of matches with 'boxes'.
 */
export const findComponentsNearRedLines = (editor, threshold = 10) => {
    const candidates = findBlockCandidates(editor);
    const page = editor.getWrapper().find('.visual-page')[0] || editor.getWrapper().find('#visual-page-id')[0];
    if (!page) return [];
    const pageRect = page.getEl().getBoundingClientRect();

    const frameDoc = editor.Canvas.getDocument();
    const markers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
    const lineYs = markers.map(m => m.getBoundingClientRect().top - pageRect.top);

    const matches = [];
    candidates.forEach(cand => {
        const el = cand.comp.getEl();
        if (!el) return;
        const compRect = el.getBoundingClientRect();
        const top = compRect.top - pageRect.top;
        const bottom = compRect.bottom - pageRect.top;

        // Check if it's near ANY marker
        const markerY = lineYs.find(ly => top < ly && bottom > (ly - threshold - 5));
        if (markerY === undefined) return;

        const broken = checkComponentBroken(editor, cand.comp, markerY, { threshold });
        if (broken) {
            matches.push({
                id: cand.comp.getId(),
                comp: cand.comp,
                tag: cand.comp.get('tagName'),
                boxes: broken.brokenLines.map(bl => ({ rect: bl.rect, markerY, isOverlap: bl.isOverlap }))
            });
        }
    });

    return matches.sort((a, b) => a.boxes[0].rect.top - b.boxes[0].rect.top);
};


/**
 * Detects if a component has visual "shell" properties (background, border, shadow).
 * If it does, we MUST push the whole box using margins, not padding, 
 * to avoid cutting the visual container.
 */
export const isVisibleContainer = (comp) => {
    const el = comp.getEl();
    if (!el) return false;
    const style = window.getComputedStyle(el);
    const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'none';
    const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
    const hasShadow = style.boxShadow !== 'none';

    // Safety check: if the container is taller than an A4 page (e.g. ~850px), we can't treat it as indivisible
    if (el.getBoundingClientRect().height > 850) return false;

    return hasBg || hasBorder || hasShadow;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FIXER — ITERATIVE ATOMIC SETTLE (Final Robustness for 40+ Pages)
// ═══════════════════════════════════════════════════════════════════════════
export const wrapPageBreaks = (editor, threshold = 10, clearance = 25) => {
    const wrapper = editor.getWrapper();
    const pageContainer = wrapper.find('.visual-page')[0] || wrapper.find('#visual-page-id')[0];
    if (!pageContainer) return 0;

    let totalOps = 0;

    // 1. Snapshot of markers.
    const frameDoc = editor.Canvas.getDocument();
    const initialMarkers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
    const markerCount = initialMarkers.length;

    console.log(`[PB] Starting Iterative Atomic Settle for ${markerCount} pages...`);

    // Iterate through markers strictly Top-to-Bottom
    for (let i = 0; i < markerCount; i++) {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            attempts++;

            // Force a canvas refresh to get final coordinates after previous page's fixes
            editor.Canvas.refresh();
            const pageEl = pageContainer.getEl();
            const pageRect = pageEl.getBoundingClientRect();

            // Re-query markers because the DOM might have changed height/page count
            const currentMarkers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
            const marker = currentMarkers[i];
            if (!marker) break;

            const markerRect = marker.getBoundingClientRect();
            const markerTop = markerRect.top - pageRect.top;
            const markerBottom = markerRect.bottom - pageRect.top;

            if (attempts === 1) {
                console.log(`[PB] Settling Page ${i + 1} at Y: ${markerTop.toFixed(0)} (Bottom: ${markerBottom.toFixed(0)})`);
            }

            // Get all potential candidates and find those crossing this specific marker
            const candidates = findBlockCandidates(editor);

            // Step A: Find all components that are broken by this marker
            const brokenCandidates = [];
            for (const cand of candidates) {
                const broken = checkComponentBroken(editor, cand.comp, markerTop, { threshold });
                if (broken) {
                    brokenCandidates.push({ comp: cand.comp, broken });
                }
            }

            // Step B: Filter to resolve the optimal actionable targets.
            // We want the deepest broken components, UNLESS an ancestor is an `isVisibleContainer`,
            // in which case the ancestor "absorbs" the break to protect its visual shell.
            const actionableBroken = brokenCandidates.filter(match => {
                let hasVisibleBrokenAncestor = false;
                let hasBrokenDescendant = false;

                for (const other of brokenCandidates) {
                    if (other.comp.getId() === match.comp.getId()) continue;

                    // Check if 'other' is an ancestor of 'match'
                    let p = match.comp.parent();
                    let isAncestor = false;
                    while (p) {
                        if (p.getId() === other.comp.getId()) {
                            isAncestor = true;
                            break;
                        }
                        p = p.parent();
                    }

                    if (isAncestor && isVisibleContainer(other.comp)) {
                        hasVisibleBrokenAncestor = true;
                    }

                    // Check if 'other' is a descendant of 'match'
                    let pDesc = other.comp.parent();
                    let isDescendant = false;
                    while (pDesc) {
                        if (pDesc.getId() === match.comp.getId()) {
                            isDescendant = true;
                            break;
                        }
                        pDesc = pDesc.parent();
                    }

                    if (isDescendant) {
                        hasBrokenDescendant = true;
                    }
                }

                if (hasVisibleBrokenAncestor) return false; // Absorbed by a visible shell parent
                if (hasBrokenDescendant && !isVisibleContainer(match.comp)) return false; // Passed down to descendant

                return true;
            });

            let settledInThisAttempt = 0;

            for (const item of actionableBroken) {
                const { comp, broken } = item;
                let appliedShift = 0;
                const firstBroken = broken.brokenLines[0];

                // ── STRATEGY SELECTION ───────────────────────────────────────────
                const isShell = isVisibleContainer(comp);
                const distFromCompTop = firstBroken.vTop - broken.vTop;
                const shouldPad = broken.isMultiLine && distFromCompTop > 20 && !isShell;

                if (!shouldPad) {
                    // Strategy A: Margin (Full Move)
                    const shiftNeeded = (markerBottom - broken.vTop) + clearance;
                    if (shiftNeeded > 0) {
                        const existing = parseInt(comp.getStyle()['margin-top']) || 0;
                        comp.addStyle({ 'margin-top': `${existing + shiftNeeded}px` });
                        comp.setAttributes({ ...comp.getAttributes(), 'data-pb-pushed': 'margin', 'data-pb-original-margin': `${existing}px` });
                        appliedShift = shiftNeeded;
                        console.log(`   └─ Page ${i + 1} [Att ${attempts}] Margin: "${comp.get('tagName')}" +${shiftNeeded.toFixed(1)}px (Shell:${isShell})`);
                    }
                } else {
                    // Strategy B: Padding (Text Nudge)
                    const paddingNeeded = Math.ceil((markerBottom + clearance) - firstBroken.vTop);
                    if (paddingNeeded > 0) {
                        const existing = parseInt(comp.getStyle()['padding-top']) || 0;
                        const totalPadding = Math.min(existing + paddingNeeded, 350);
                        comp.addStyle({ 'padding-top': `${totalPadding}px` });
                        comp.setAttributes({ ...comp.getAttributes(), 'data-pb-pushed': 'padding', 'data-pb-original-padding': `${existing}px` });
                        appliedShift = paddingNeeded;
                        console.log(`   └─ Page ${i + 1} [Att ${attempts}] Pad: "${comp.get('tagName')}" +${paddingNeeded}px`);
                    }
                }

                if (appliedShift > 0) {
                    settledInThisAttempt++;
                    totalOps++;
                }
            }

            if (settledInThisAttempt === 0) {
                break;
            } else {
                editor.Canvas.refresh();
            }
        }

        if (attempts >= maxAttempts) {
            console.warn(`[PB] Page ${i + 1} reached max attempts. Moving to next.`);
        }
    }

    editor.refresh();
    editor.Canvas.refresh();
    console.log(`[PB] Iterative Settle Done: ${totalOps} fixed across ${markerCount} pages.`);
    return totalOps;
};

// ═══════════════════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════════════════
export const resetPageBreaks = (editor) => {
    editor.getWrapper().find('[data-pb-pushed]').forEach(comp => {
        stripFixationStyles(comp);
    });
    editor.refresh();
    console.log('[PB] Reset complete');
};

/**
 * Strips page-break specific fixation styles and attributes from a component.
 * Useful when cloning or resetting.
 */
export const stripFixationStyles = (comp) => {
    if (!comp) return;

    // Fix the component itself if it has the markers
    const attrs = comp.getAttributes();
    if (attrs['data-pb-pushed']) {
        const origM = attrs['data-pb-original-margin'] || '0px';
        const origP = attrs['data-pb-original-padding'] || '0px';
        comp.addStyle({ 'margin-top': origM, 'padding-top': origP });

        const next = { ...attrs };
        delete next['data-pb-pushed'];
        delete next['data-pb-original-margin'];
        delete next['data-pb-original-padding'];
        comp.setAttributes(next);
    }

    // Recursively handle all descendants
    comp.components().forEach(child => stripFixationStyles(child));
};


// Console helpers
if (typeof window !== 'undefined') {
    window.runMarkerCheck = (t = 10) => {
        const ed = window.editor || window.grapesjs?.editors?.[0];
        return ed ? findComponentsNearRedLines(ed, t) : console.error('Editor not found');
    };
    window.runMarkerWrap = (t = 10, c = 25) => {
        const ed = window.editor || window.grapesjs?.editors?.[0];
        return ed ? wrapPageBreaks(ed, t, c) : console.error('Editor not found');
    };
    window.resetPageBreaks = () => {
        const ed = window.editor || window.grapesjs?.editors?.[0];
        return ed ? resetPageBreaks(ed) : console.error('Editor not found');
    };
}
