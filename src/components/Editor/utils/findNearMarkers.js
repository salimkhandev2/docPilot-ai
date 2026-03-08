/**
 * Page Break Handler
 * All positions use getBoundingClientRect() for viewport-relative, zoom-safe coordinates.
 */

// Tracks shifted components for O(1) reset
let trackedPushedComponents = new Set();
let trackedSplitComponents = new Set();

const INLINE_TAGS = new Set(['span', 'a', 'i', 'b', 'em', 'strong', 'label', 'abbr', 'cite', 'font', 'br']);
const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const PAGE_ROOT_TYPES = new Set(['wrapper', 'visual-page', 'body', 'html']);
const BR_SPACER_CLASS = 'pb-br-spacer';

// ─── Helpers ───────────────────────────────────────────────────────────────

const getPageEl = (editor) => {
    const w = editor.getWrapper();
    return (w.find('.visual-page')[0] || w.find('#visual-page-id')[0])?.getEl() ?? null;
};

const vRect = (el, pageRect) => {
    if (!el || typeof el.getBoundingClientRect !== 'function') return { top: 0, bottom: 0, height: 0 };
    const r = el.getBoundingClientRect();
    return { top: r.top - pageRect.top, bottom: r.bottom - pageRect.top, height: r.height };
};

/** Returns true if tag/class/display indicates a structured multi-child layout */
const isStructuredLayout = (comp) => {
    const cls = (comp.getAttributes?.().class || '').toLowerCase();
    if (cls.includes('grid') || cls.includes('flex')) return true;
    return false;
};

/** Detects if a component has a visual shell (bg, border, shadow) under 850px tall */
export const isVisibleContainer = (comp) => {
    const el = comp.getEl();
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    if (el.getBoundingClientRect().height > 850) return false;
    const s = window.getComputedStyle(el);
    return (
        (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') ||
        (s.borderWidth !== '0px' && s.borderStyle !== 'none') ||
        s.boxShadow !== 'none'
    );
};

// ─── findBlockCandidates ───────────────────────────────────────────────────

export const findBlockCandidates = (editor) => {
    if (!editor) return [];
    const wrapper = editor.getWrapper();
    const page = wrapper.find('.visual-page')[0] || wrapper.find('#visual-page-id')[0];
    if (!page) return [];

    const candidates = [];
    const seenIds = new Set();

    wrapper.find('*').forEach(comp => {
        const el = comp.getEl();
        if (!el || typeof el.getBoundingClientRect !== 'function') return;
        if (el.closest?.('.page-break-indicator')) return;

        const type = comp.get('type');
        const id = comp.getId() || '';
        const cls = (comp.getAttributes?.().class || '').toLowerCase();
        if (PAGE_ROOT_TYPES.has(type) || id.includes('visual-page') || cls.includes('visual-page')) return;

        // Walk up from inline elements to find a block container
        let target = comp;
        let targetEl = el;
        while (targetEl?.tagName && INLINE_TAGS.has(targetEl.tagName.toLowerCase())) {
            const parent = target.parent();
            if (!parent) break;
            target = parent;
            targetEl = parent.getEl();
        }

        const cid = target.getId();
        if (!seenIds.has(cid)) {
            seenIds.add(cid);
            candidates.push({ id: cid, comp: target });
        }
    });

    return candidates;
};

// ─── checkComponentBroken ─────────────────────────────────────────────────

export const checkComponentBroken = (editor, comp, markerY, options = {}) => {
    const { accumulatedShift = 0, threshold = 10 } = options;
    const el = comp.getEl();
    if (!el) return null;

    const pageEl = getPageEl(editor);
    if (!pageEl) return null;
    const pageRect = pageEl.getBoundingClientRect();
    const frameDoc = editor.Canvas.getDocument();

    const compRect = el.getBoundingClientRect();
    const vTop = (compRect.top - pageRect.top) + accumulatedShift;
    const vBottom = (compRect.bottom - pageRect.top) + accumulatedShift;

    // Determine if this is a header-like element
    let isHeader = HEADING_TAGS.has(el.tagName?.toLowerCase());
    try {
        const s = window.getComputedStyle(el);
        const fw = parseInt(s.fontWeight) || 400;
        const fs = parseFloat(s.fontSize || '16px');
        isHeader = isHeader
            || (fw >= 600 && fs > 14)
            || (s.borderBottomWidth !== '0px' && s.borderBottomStyle !== 'none' && fs >= 12)
            || !!(comp.getAttributes()?.class?.match(/header|title/));
    } catch (_) { /* use tag-based fallback */ }

    const headerClearance = isHeader ? 100 : 0; // Updated from 80 to 100px based on user rule

    if (vTop > markerY + 2) return null;
    if (!isHeader && vBottom < markerY - threshold - 5) return null;
    if (isHeader && vBottom + headerClearance < markerY - threshold - 5) return null;

    // Collect text rects for line-level analysis — keep node reference for BR splitting
    const walker = frameDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const textData = []; // { rect, node }
    let node;
    while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = frameDoc.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) textData.push({ rect: r, node });
    }
    if (!textData.length) textData.push({ rect: compRect, node: null });

    let brokenLines = textData
        .map(({ rect: r, node }) => ({
            rect: r,
            node,
            vTop: (r.top - pageRect.top) + accumulatedShift,
            vBottom: (r.bottom - pageRect.top) + accumulatedShift,
        }))
        .filter(({ vTop: rt, vBottom: rb }) =>
            (rt < markerY && rb >= markerY - threshold && rb <= markerY + 2) ||
            (rt < markerY && rb > markerY)
        )
        .map(l => ({ ...l, isOverlap: l.vTop < markerY && l.vBottom > markerY }));

    // --- Stacked Headers Rule (Lookback Mechanism) ---
    // Rule: If this component crosses/nears the boundary AND is part of a heading stack,
    // we must push the TOP of the stack, not this individual subheading/paragraph.
    let pushTargetComp = comp;
    let pushTargetVTop = vTop;
    let isOrphaned = false;

    if (!brokenLines.length) {
        // If it isn't strictly crossing but is a header in the 100px danger zone
        if (isHeader && vBottom <= markerY && vBottom + headerClearance >= markerY - threshold) {
            isOrphaned = true;
        } else {
            return null; // Not crossing, not a danger-zone header
        }
    } else {
        // It crosses. Is it a header? If so, it might be the bottom of a stack.
        isOrphaned = isHeader;
    }

    // Attempt to look back for stacked headers visually
    const { cachedCandidates } = options;
    if ((isOrphaned || (brokenLines.length > 0 && !isHeader)) && cachedCandidates) {
        let currentLookbackVTop = vTop;
        let topMostHeaderComp = isHeader ? comp : null;
        let lastHeaderFound = topMostHeaderComp;

        const isCompHeader = (c) => {
            const tag = c?.get('tagName')?.toLowerCase();
            if (HEADING_TAGS.has(tag)) return true;
            try {
                const cel = c.getEl();
                if (!cel) return false;
                const s = window.getComputedStyle(cel);
                const fw = parseInt(s.fontWeight) || 400;
                const fs = parseFloat(s.fontSize || '16px');
                return (fw >= 600 && fs > 14) || !!(c.getAttributes()?.class?.match(/header|title/));
            } catch (e) { return false; }
        };

        let foundHigher = true;
        let stackDepth = 0;

        while (foundHigher && stackDepth < 5) {
            foundHigher = false;
            let bestCand = null;
            let bestDistance = Infinity;

            for (const cand of cachedCandidates) {
                const cEl = cand.comp.getEl();
                if (!cEl || typeof cEl.getBoundingClientRect !== 'function') continue;

                if (!isCompHeader(cand.comp)) continue;

                const cRect = cEl.getBoundingClientRect();
                const cBottom = (cRect.bottom - pageRect.top) + accumulatedShift;

                // Headers must be visually ABOVE the current element's top
                if (cBottom <= currentLookbackVTop + 5) {
                    const dist = currentLookbackVTop - cBottom;

                    // If it's within 100px visual gap, it's considered stacked (increased from 60px)
                    if (dist < 100 && dist < bestDistance) {
                        bestDistance = dist;
                        bestCand = cand.comp;
                    }
                }
            }

            if (bestCand && bestCand.getId() !== (lastHeaderFound?.getId() || comp.getId())) {
                // Validate that no non-header text block exists in the visual gap
                const bEl = bestCand.getEl();
                const bRect = bEl.getBoundingClientRect();
                const gapBottom = currentLookbackVTop;
                const gapTop = (bRect.bottom - pageRect.top) + accumulatedShift;
                let blocked = false;

                for (const cand of cachedCandidates) {
                    const candId = cand.comp.getId();
                    if (candId === bestCand.getId() || candId === (lastHeaderFound?.getId() || comp.getId())) continue;

                    const cEl = cand.comp.getEl();
                    if (!cEl || typeof cEl.getBoundingClientRect !== 'function') continue;

                    // IGNORE structural containers that contain either of the headers we are connecting
                    // This fixes the issue where a <section> or <div> wrapper sitting between H2 and H3 
                    // (because it contains H3) would incorrectly "block" the header stack detection.
                    const bEl = bestCand.getEl();
                    const startEl = comp.getEl();
                    if (cEl.contains(bEl) || cEl.contains(startEl) || bEl.contains(cEl) || startEl.contains(cEl)) continue;

                    const cRect = cEl.getBoundingClientRect();
                    const cTop = (cRect.top - pageRect.top) + accumulatedShift;
                    const cBottom = (cRect.bottom - pageRect.top) + accumulatedShift;

                    // If visual text block is wedged inside the gap, stack is broken
                    if (cTop >= gapTop - 5 && cBottom <= gapBottom + 5) {
                        if (!isCompHeader(cand.comp) && cEl.textContent.trim().length > 0 && cRect.height > 5) {
                            blocked = true;
                            break;
                        }
                    }
                }

                if (!blocked) {
                    topMostHeaderComp = bestCand;
                    lastHeaderFound = bestCand;
                    currentLookbackVTop = (bRect.top - pageRect.top) + accumulatedShift;
                    foundHigher = true;
                    stackDepth++;
                } else {
                    if (!isHeader && topMostHeaderComp) isOrphaned = true;
                }
            } else {
                if (!isHeader && topMostHeaderComp) isOrphaned = true;
            }
        }

        if (topMostHeaderComp && topMostHeaderComp.getId() !== comp.getId()) {
            // We found a higher header in the stack! Switch the target.
            pushTargetComp = topMostHeaderComp;
            const targetEl = pushTargetComp.getEl();
            if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
                const rect = targetEl.getBoundingClientRect();
                pushTargetVTop = (rect.top - pageRect.top) + accumulatedShift;
            }

            // Rebuild broken lines for the top stack item so `wrapPageBreaks` pushes IT
            brokenLines = [{
                rect: targetEl ? targetEl.getBoundingClientRect() : compRect,
                isOverlap: true,
                vTop: pushTargetVTop,
                vBottom: pushTargetVTop + 10, // arbitrary small height to force a push
                isOrphanedHeader: true,
            }];
        }
    }

    if (isOrphaned && brokenLines.length === 0) {
        // Single orphaned header fallback (from original logic)
        brokenLines.push({
            rect: compRect,
            isOverlap: true,
            vTop: vTop,
            vBottom: vBottom + headerClearance,
            isOrphanedHeader: true,
        });
    }

    return { comp: pushTargetComp, vTop: pushTargetVTop, vBottom, compHeight: compRect.height, brokenLines, isMultiLine: textData.length > 1 };
};

// ─── findComponentsNearRedLines (legacy shim) ──────────────────────────────

export const findComponentsNearRedLines = (editor, threshold = 10) => {
    const candidates = findBlockCandidates(editor);
    const pageEl = getPageEl(editor);
    if (!pageEl) return [];
    const pageRect = pageEl.getBoundingClientRect();
    const markers = Array.from(editor.Canvas.getDocument().querySelectorAll('.page-break-indicator'));
    const lineYs = markers.map(m => m.getBoundingClientRect().top - pageRect.top);

    return candidates
        .reduce((acc, cand) => {
            const el = cand.comp.getEl();
            if (!el) return acc;
            const r = el.getBoundingClientRect();
            const top = r.top - pageRect.top;
            const bottom = r.bottom - pageRect.top;
            const markerY = lineYs.find(ly => top < ly && bottom > ly - threshold - 5);
            if (markerY === undefined) return acc;
            const broken = checkComponentBroken(editor, cand.comp, markerY, { threshold, cachedCandidates: candidates });
            if (!broken) return acc;
            acc.push({
                id: cand.comp.getId(), comp: cand.comp, tag: cand.comp.get('tagName'),
                boxes: broken.brokenLines.map(bl => ({ rect: bl.rect, markerY, isOverlap: bl.isOverlap })),
            });
            return acc;
        }, [])
        .sort((a, b) => a.boxes[0].rect.top - b.boxes[0].rect.top);
};

// ─── applyPush helpers ─────────────────────────────────────────────────────

const applyMarginPush = (comp, amount) => {
    const style = { ...comp.getStyle() };
    const existing = parseInt(style['margin-top']) || 0;
    if (!style['--pb-orig-mt']) style['--pb-orig-mt'] = style['margin-top'] || '0px';
    style['--pb-mt-active'] = 'true';
    style['margin-top'] = `${existing + amount}px`;
    style['--pb-applied-mt'] = style['margin-top'];
    comp.setStyle(style);
    const attrs = { ...comp.getAttributes() };
    if (!attrs['data-pb-pushed']) { attrs['data-pb-pushed'] = 'true'; comp.setAttributes(attrs); }
    trackedPushedComponents.add(comp);
};

// ─── trySplitLargeElement ──────────────────────────────────────────────────
// Finds the child closest to the page-break and pushes just that child.
// Works for CSS grids and generic containers.

const trySplitLargeElement = (targetComp, markerBottom, clearance, pageRect, currentMarkers, markerIndex, passShiftedIds) => {
    let children = [];
    try { children = targetComp.components(); } catch (_) { return false; }
    if (!children?.length) return false;

    let targetChild = null;
    let bestBottom = -Infinity;

    for (let i = 0; i < children.length; i++) {
        const child = children.at(i);
        const el = child.getEl();
        if (!el) continue;
        const { top: ct, bottom: cb } = vRect(el, pageRect);

        // Exact straddler wins immediately
        if (ct < markerBottom && cb > markerBottom) { targetChild = child; bestBottom = cb; break; }
        // Otherwise track the one ending closest before the marker
        if (cb <= markerBottom && cb > bestBottom) { targetChild = child; bestBottom = cb; }
    }

    // Fallback: first child just after the marker
    if (!targetChild) {
        for (let i = 0; i < children.length; i++) {
            const child = children.at(i);
            const el = child.getEl();
            if (!el) continue;
            const { top: ct } = vRect(el, pageRect);
            if (ct >= markerBottom && ct < markerBottom + clearance + 20) { targetChild = child; bestBottom = ct; break; }
        }
    }

    if (!targetChild) return false;
    // Proximity guard: if further than 100px before the marker, not a genuine crossing
    if (bestBottom < markerBottom - 100) return false;

    let push = Math.max(clearance, Math.ceil((markerBottom + clearance) - bestBottom));

    // Waterfall guard: don't push past the next marker
    const nextMarker = currentMarkers[markerIndex + 1];
    if (nextMarker) {
        const nextTop = nextMarker.getBoundingClientRect().top - pageRect.top;
        if (markerBottom + push > nextTop - 50) push = Math.max(0, (nextTop - 50) - (markerBottom - clearance));
    }
    if (push <= 0) return false;

    applyMarginPush(targetChild, push);

    passShiftedIds.add(targetChild.getId());
    return true;
};

// ─── findCohesivePushTarget ────────────────────────────────────────────────
// Climbs up the tree to find a heading/container that should move WITH the element.

const findCohesivePushTarget = (comp, pageTop) => {
    const getVTop = (c) => {
        const el = c.getEl();
        return el ? el.getBoundingClientRect().top - pageTop : 0;
    };

    const startVTop = getVTop(comp);
    let current = comp;
    let pushTarget = comp;
    let childToGuard = null;
    let fallbackContainer = null;
    let isClimbingCollapse = false;

    for (let depth = 0; depth < 5; depth++) {
        const parent = current.parent();
        if (!parent) break;

        // Safety Guard 1: Don't climb to an element that starts at the very top of the document
        // This prevents the "First Page Gap" bug.
        const pVTop = getVTop(parent);
        if (pVTop < 5) break;

        // Safety Guard 2: Don't climb if the parent's top is too far from the original break
        // This keeps the push localized to the section.
        if (Math.abs(startVTop - pVTop) > 400) break;

        const pTag = (parent.get('tagName') || '').toLowerCase();
        const pType = parent.get('type') || '';
        if (PAGE_ROOT_TYPES.has(pTag) || PAGE_ROOT_TYPES.has(pType)) break;

        const siblings = parent.components();
        let myIndex = -1;
        let visCount = 0;
        for (let i = 0; i < siblings.length; i++) {
            const s = siblings.at(i);
            if (s.getId() === current.getId()) { myIndex = visCount; break; }
            const sTag = (s.get('tagName') || '').toLowerCase();
            const sEl = s.getEl();
            const sH = (sEl && typeof sEl.getBoundingClientRect === 'function') ? sEl.getBoundingClientRect().height : 0;
            if (!['br', 'script', 'style'].includes(sTag) && s.getStyle().display !== 'none' && sH > 2) visCount++;
        }

        // Scan siblings for structured layouts (grid/flex)
        let hasStructuredSibling = false;
        for (let k = 0; k < siblings.length; k++) {
            if (k === myIndex) continue;
            if (isStructuredLayout(siblings.at(k))) { hasStructuredSibling = true; break; }
        }

        // Case A: I am a structured layout preceded by a heading → push that heading
        if (myIndex > 0 && isStructuredLayout(current)) {
            const prev = siblings.at(myIndex - 1);
            if (HEADING_TAGS.has((prev.get('tagName') || '').toLowerCase())) {
                pushTarget = prev;
                childToGuard = current.getId();
                fallbackContainer = current;
                break;
            }
        }

        // Case B: Container whose first child is a heading and contains a structured layout
        if ((hasStructuredSibling || isStructuredLayout(current)) && siblings.length <= 20) {
            const first = siblings.at(0);
            const fTag = (first.get('tagName') || '').toLowerCase();
            const fCls = (first.getAttributes()?.class || '').toLowerCase();
            const fStyle = first.getStyle();
            const fIsHeader = HEADING_TAGS.has(fTag) || fCls.match(/header|title/) ||
                parseInt(fStyle['font-weight']) >= 600 || fStyle['font-weight'] === 'bold';
            if (fIsHeader) {
                pushTarget = parent;
                childToGuard = first.getId();
                fallbackContainer = parent;
                break;
            }
        }

        // Case D: Margin collapse guard — first child heading climbs up
        const curTag = (current.get('tagName') || '').toLowerCase();
        const curCls = (current.getAttributes()?.class || '').toLowerCase();
        const isH = HEADING_TAGS.has(curTag) || curCls.includes('header');
        if (myIndex === 0 && (isH || isClimbingCollapse)) {
            pushTarget = parent;
            isClimbingCollapse = true;
        }

        current = parent;
    }

    return { pushTarget, childToGuard, fallbackContainer };
};

/**
 * Finds the text node crossing markerY, inserts <br> spacers after the crossing
 * word, then syncs back to GrapesJS by rebuilding the component's children.
 */
const trySplitTextWithBR = (editor, comp, markerY, pageRect) => {
    const el = comp.getEl();
    if (!el) return false;

    const frameDoc = el.ownerDocument || editor.Canvas.getDocument();
    const viewportY = markerY + pageRect.top; // absolute viewport Y of the red line

    // ── Step 1: Walk text nodes to find the one that straddles the red line ──
    const walker = frameDoc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let targetNode = null;
    let targetOffset = 0;
    let node;

    while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const range = frameDoc.createRange();
        range.selectNodeContents(node);
        const lineRects = Array.from(range.getClientRects());

        // Find the rect that actually crosses the boundary
        const crossingRect = lineRects.find(r => r.top < viewportY && r.bottom > viewportY);
        if (!crossingRect) continue;

        // ── Step 2: Binary search for exact character offset ──
        targetNode = node;
        let low = 0, high = node.textContent.length;
        targetOffset = high; // default: after the whole node

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const r = frameDoc.createRange();
            r.setStart(node, 0);
            r.setEnd(node, mid);
            const midRects = r.getClientRects();
            if (midRects.length > 0 && midRects[midRects.length - 1].bottom > viewportY) {
                targetOffset = mid;
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        break; // found our node
    }

    if (!targetNode) {
        console.warn('[PB-Split] No crossing text node found.');
        return false;
    }

    console.log(`[PB-Split] Splitting at offset ${targetOffset} in: "${targetNode.textContent.substring(0, 40)}..."`);

    try {
        // ── Step 3: Mutate the live DOM to get the right innerHTML ──
        if (targetOffset < targetNode.textContent.length) {
            targetNode.splitText(targetOffset);
        }
        // Insert spacer BRs right after the split point
        const insertAfter = targetNode.nextSibling;
        for (let i = 0; i < 3; i++) {
            const br = frameDoc.createElement('br');
            br.className = BR_SPACER_CLASS;
            if (insertAfter) {
                targetNode.parentNode.insertBefore(br, insertAfter);
            } else {
                targetNode.parentNode.appendChild(br);
            }
        }

        // Capture the mutated HTML
        const newHtml = el.innerHTML;

        // ── Step 4: Revert DOM so GrapesJS owns rendering ──
        el.querySelectorAll(`.${BR_SPACER_CLASS}`).forEach(b => b.remove());
        el.normalize();

        // ── Step 5: Push HTML into the GrapesJS model ──
        // Use components().reset() – the correct API for rebuilding children from HTML
        comp.components().reset(newHtml);
        trackedSplitComponents.add(comp);

        console.log('[PB-Split] SUCCESS');
        return true;
    } catch (e) {
        console.error('[PB-Split] Error:', e);
        el.normalize();
        return false;
    }
};


// ─── wrapPageBreaks ────────────────────────────────────────────────────────

export const wrapPageBreaks = (editor, threshold = 10, clearance = 10) => {
    const wrapper = editor.getWrapper();
    const pageContainer = wrapper.find('.visual-page')[0] || wrapper.find('#visual-page-id')[0];
    if (!pageContainer) return 0;

    const frameDoc = editor.Canvas.getDocument();
    const markers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
    const markerCount = markers.length;

    // --- IDEMPOTENCY CHECK: Is the document already correct? ---
    // If the user clicks Format and the document is already perfect, do nothing.
    editor.Canvas.refresh();
    const initialCandidates = findBlockCandidates(editor);
    const initialPageEl = pageContainer.getEl();
    if (!initialPageEl) return 0;
    const initialPageRect = initialPageEl.getBoundingClientRect();

    let isAlreadyValid = true;
    for (const marker of markers) {
        const markerTop = marker.getBoundingClientRect().top - initialPageRect.top;
        if (initialCandidates.some(cand => checkComponentBroken(editor, cand.comp, markerTop, { threshold, cachedCandidates: initialCandidates }))) {
            isAlreadyValid = false;
            break;
        }
    }

    if (isAlreadyValid) {
        console.log("[PB-Format] Document is already in a valid state. Skipping.");
        return 0;
    }
    // ------------------------------------------------------------

    resetPageBreaks(editor);
    let totalOps = 0;

    // We don't use a fixed marker count anymore. We loop until no markers report issues,
    // working strictly top-down. We allow a maximum of 50 total operations to prevent absolute infinite loops.

    let globalOps = 0;
    let anyBreaksFixedInIteration = true;

    while (anyBreaksFixedInIteration && globalOps < 50) {
        anyBreaksFixedInIteration = false;
        editor.Canvas.refresh();
        const currentMarkers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));

        for (let i = 0; i < currentMarkers.length; i++) {
            const passShiftedIds = new Set();
            let attempts = 0;
            let breakForLoop = false;

            while (attempts++ < 10) {
                editor.Canvas.refresh();
                // Re-discover candidates every attempt so BR splits and margin pushes
                // made on earlier pages are reflected before processing this marker.
                const cachedCandidates = findBlockCandidates(editor);
                const pageEl = pageContainer.getEl();
                if (!pageEl || typeof pageEl.getBoundingClientRect !== 'function') break;

                const pageRect = pageEl.getBoundingClientRect();
                // Re-fetch markers as the DOM might have changed height
                const latestMarkers = Array.from(frameDoc.querySelectorAll('.page-break-indicator'));
                const marker = latestMarkers[i];
                if (!marker || typeof marker.getBoundingClientRect !== 'function') break;

                const markerTop = marker.getBoundingClientRect().top - pageRect.top;
                const markerBottom = marker.getBoundingClientRect().bottom - pageRect.top;

                // Find broken candidates near this marker (skip components far away)
                const brokenCandidates = [];
                for (const cand of cachedCandidates) {
                    const el = cand.comp.getEl();
                    if (el) {
                        const { top: vt, bottom: vb } = vRect(el, pageRect);
                        if (vt > markerTop + 800 || vb < markerTop - 800) continue;
                    }
                    const broken = checkComponentBroken(editor, cand.comp, markerTop, { threshold, cachedCandidates });
                    if (broken) brokenCandidates.push({ comp: cand.comp, broken });
                }

                // Filter: prefer deepest broken, unless ancestor is a visible shell
                const actionable = brokenCandidates
                    .filter(({ comp }) => {
                        if (passShiftedIds.has(comp.getId())) return false;
                        for (const other of brokenCandidates) {
                            if (other.comp.getId() === comp.getId()) continue;
                            // other is ancestor of comp?
                            let p = comp.parent();
                            while (p) {
                                if (p.getId() === other.comp.getId()) {
                                    if (isVisibleContainer(other.comp)) return false; // shell absorbs
                                    break;
                                }
                                p = p.parent();
                            }
                            // other is descendant of comp?
                            let d = other.comp.parent();
                            while (d) {
                                if (d.getId() === comp.getId()) return false; // push descendant instead
                                d = d.parent();
                            }
                        }
                        return true;
                    })
                    .sort((a, b) => a.broken.vTop - b.broken.vTop);

                if (!actionable.length) break;

                const { comp: originalComp, broken } = actionable[0];
                // The lookback scanner might have identified a stacked header (H2) that needs to be pushed 
                // instead of the original component (H3). We must redirect all operations to it.
                const comp = broken.topMostHeaderComp || originalComp;

                const firstBroken = broken.brokenLines[0];
                let appliedShift = 0;

                const compEl = comp.getEl();
                const compHeight = compEl && typeof compEl.getBoundingClientRect === 'function' ? compEl.getBoundingClientRect().height : 0;

                // Priority 1: Direct Surgical Split (with BRs for text)
                let split = trySplitTextWithBR(editor, comp, markerTop, pageRect);

                // Priority 2: Structured Large Element Split (Grid/Flex blocks)
                if (!split && compHeight > 150) {
                    split = trySplitLargeElement(comp, markerBottom, clearance, pageRect, latestMarkers, i, passShiftedIds);
                }

                if (split) {
                    appliedShift = 1;
                    totalOps++;
                } else {
                    // Priority 3: Simple Margin Push Fallback
                    let shift = Math.max(0, (markerBottom - broken.vTop) + clearance);

                    // SAFETY: Cap shift to avoid massive gaps/loops
                    if (shift > 800) shift = 0;

                    const nextMarker = latestMarkers[i + 1];
                    if (nextMarker) {
                        const nextTop = nextMarker.getBoundingClientRect().top - pageRect.top;
                        if (broken.vTop + shift > nextTop - 50) shift = Math.max(0, (nextTop - 50) - broken.vTop);
                    }

                    if (shift > 0) {
                        applyMarginPush(comp, shift);
                        passShiftedIds.add(comp.getId());

                        // Guard immediate next sibling from double-shifting
                        const par = comp.parent();
                        if (par) {
                            const sibs = par.components();
                            let myIdx = -1;
                            for (let si = 0; si < sibs.length; si++) {
                                if (sibs.at(si).getId() === comp.getId()) { myIdx = si; break; }
                            }
                            if (myIdx >= 0 && myIdx + 1 < sibs.length) {
                                passShiftedIds.add(sibs.at(myIdx + 1).getId());
                            }
                        }
                        appliedShift = shift;
                    }
                }

                if (appliedShift > 0) {
                    totalOps++;
                    globalOps++;
                    anyBreaksFixedInIteration = true;
                    editor.Canvas.refresh();
                    // BREAK out of the current marker attempt loop so the outer `while` triggers a fresh 
                    // top-to-bottom re-evaluation of all markers, ensuring cascading layout changes are respected.
                    breakForLoop = true;
                    break;
                } else {
                    break;
                }
            }
            if (attempts >= 10) {
                console.warn(`[PB-Format] Marker ${i + 1} reached max attempts (10). Possible layout conflict.`);
            }

            if (breakForLoop) break;
        }
    }

    editor.refresh();
    editor.Canvas.refresh();
    return totalOps;
};

// ─── resetPageBreaks ───────────────────────────────────────────────────────

export const resetPageBreaks = (editor) => {
    const wrapper = editor.getWrapper();
    if (!wrapper) return;

    if (trackedSplitComponents.size > 0) {
        trackedSplitComponents.forEach(c => {
            const html = c.get('content');
            if (typeof html === 'string') {
                c.set('content', html.replace(new RegExp(`<br[^>]*class="${BR_SPACER_CLASS}"[^>]*>`, 'gi'), ''));
            }
            const children = c.components();
            if (children && children.length > 0) {
                const toRemove = [];
                for (let i = 0; i < children.length; i++) {
                    const child = children.at(i);
                    if ((child.getAttributes()?.class || '').includes(BR_SPACER_CLASS)) {
                        toRemove.push(child);
                    }
                }
                toRemove.forEach(b => b.remove());
            }
        });
        trackedSplitComponents.clear();
    }

    // Backup: Global clean-up of BR spacers (if Set tracking failed or after a reload)
    wrapper.find(`.${BR_SPACER_CLASS}`).forEach(b => b.remove());

    // Original Pushed Logic
    if (trackedPushedComponents.size > 0) {
        trackedPushedComponents.forEach(c => stripFixationStyles(c, false));
        trackedPushedComponents.clear();
    } else {
        stripFixationStyles(wrapper, true);
    }

    wrapper.find('[data-pb-pushed]').forEach(c => stripFixationStyles(c, false));
    editor.refresh();
};

// ─── stripFixationStyles ───────────────────────────────────────────────────

export const stripFixationStyles = (comp, recurse = true) => {
    if (!comp) return;
    const style = { ...comp.getStyle() };
    const attrs = { ...comp.getAttributes() };
    let sc = false, ac = false;

    if (style['--pb-mt-active']) {
        const applied = style['--pb-applied-mt'];
        const current = comp.getEl()?.style.marginTop || style['margin-top'] || '0px';
        if (applied && current !== applied) style['--pb-orig-mt'] = current;
        const orig = style['--pb-orig-mt'];
        style['margin-top'] = (!orig || orig === '0px' || orig === 'unset') ? '' : orig;
        delete style['--pb-orig-mt']; delete style['--pb-mt-active']; delete style['--pb-applied-mt'];
        sc = true;
    }

    if (style['--pb-pt-active']) {
        const applied = style['--pb-applied-pt'];
        const current = comp.getEl()?.style.paddingTop || style['padding-top'] || '0px';
        if (applied && current !== applied) style['--pb-orig-pt'] = current;
        const orig = style['--pb-orig-pt'];
        style['padding-top'] = (!orig || orig === '0px' || orig === 'unset') ? '' : orig;
        delete style['--pb-orig-pt']; delete style['--pb-pt-active']; delete style['--pb-applied-pt'];
        sc = true;
    }

    // Legacy cleanup
    if (attrs['data-pb-pushed']) {
        const origM = attrs['data-pb-original-margin'] || '';
        const origP = attrs['data-pb-original-padding'] || '';
        style['margin-top'] = (origM && origM !== '0px') ? origM : '';
        style['padding-top'] = (origP && origP !== '0px') ? origP : '';
        delete attrs['data-pb-pushed']; delete attrs['data-pb-original-margin']; delete attrs['data-pb-original-padding'];
        sc = true; ac = true;
    }

    if (sc) comp.setStyle(style);
    if (ac) comp.setAttributes(attrs);
    if (recurse && typeof comp.components === 'function') comp.components().forEach(c => stripFixationStyles(c, true));
};

// ─── Console helpers ───────────────────────────────────────────────────────

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
