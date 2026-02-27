export function getProblematicClassReplacement(cls, heightStr, widthStr) {
    const map = {
        "h-screen": `min-h-[${heightStr}]`,
        "min-h-screen": `min-h-[${heightStr}]`,
        "max-h-screen": `max-h-[${heightStr}]`,
        "h-full": "h-auto",
        "min-h-full": `min-h-[${heightStr}]`,
        "w-screen": `w-[${widthStr}]`,
        "min-w-screen": `w-[${widthStr}]`,
    };
    return map[cls];
}

export function sanitizeA4Styles(html, physH = "297mm", physW = "210mm") {
    if (!html || typeof html !== "string") return html;

    const parsePhys = (str) => {
        const m = str.match(/^([\d.]+)([a-z%]+)$/i);
        return m ? { val: parseFloat(m[1]), unit: m[2] } : { val: 0, unit: "px" };
    };

    const h = parsePhys(physH);
    const w = parsePhys(physW);

    return html
        .replace(/class="([^"]*)"/g, (match, classList) => {
            if (!classList) return match;
            const cleaned = classList
                .split(/\s+/)
                .map((cls) => {
                    if (!cls) return "";

                    // 1. Collapse breakpoints (sm:flex → flex) to ensure PDF-like static layout
                    const colonIdx = cls.indexOf(":");
                    if (colonIdx !== -1) {
                        const prefix = cls.substring(0, colonIdx);
                        if (["sm", "md", "lg", "xl", "2xl"].includes(prefix)) {
                            cls = cls.substring(colonIdx + 1);
                        }
                    }

                    // 2. Replace known problematic viewport-based classes
                    const replacement = getProblematicClassReplacement(cls, physH, physW);
                    if (replacement) return replacement;

                    // 3. Convert JIT viewport values inside brackets [100vh] -> [1123px]
                    if (cls.includes("[") && /[0-9.]v[hw]/i.test(cls)) {
                        return cls.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
                            const base = unit.toLowerCase() === "h" ? h : w;
                            const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
                            return `${finalVal}${base.unit}`;
                        });
                    }

                    // 4. Convert embedded physical dimensions inside brackets to match current page size
                    if (cls.includes("[")) {
                        return cls
                            .replace(/297\s*mm|29\.7\s*cm|11\s*in/gi, physH)
                            .replace(/210\s*mm|21\s*cm|8\.5\s*in/gi, physW);
                    }

                    return cls;
                })
                .filter(Boolean)
                .join(" ");
            return `class="${cleaned.trim()}"`;
        })
        // 5. Convert viewport units in inline styles (e.g. style="height: 50vh")
        .replace(/style="([^"]*)"/gi, (match, styles) => {
            if (!styles.toLowerCase().includes("vh") && !styles.toLowerCase().includes("vw")) return match;
            const cleaned = styles.replace(/(\d+(?:\.\d+)?)v([hw])/gi, (_, num, unit) => {
                const base = unit.toLowerCase() === "h" ? h : w;
                const finalVal = ((parseFloat(num) / 100) * base.val).toFixed(2);
                return `${finalVal}${base.unit}`;
            });
            return `style="${cleaned}"`;
        });
}

export function cleanAIResponse(html, physH, physW) {
    let cleaned = html.trim();
    // Remove markdown code fences
    cleaned = cleaned.replace(/^```html\s*/i, "");
    cleaned = cleaned.replace(/^```\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
    // Remove HTML document wrappers
    cleaned = cleaned.replace(/^<!DOCTYPE[^>]*>/i, "");
    cleaned = cleaned.replace(/^<html[^>]*>/i, "").replace(/<\/html>\s*$/i, "");
    cleaned = cleaned.replace(/<head[^>]*>.*?<\/head>/is, "");
    cleaned = cleaned.replace(/^<body[^>]*>/i, "").replace(/<\/body>\s*$/i, "");
    // Strip breakpoints and viewport units
    cleaned = sanitizeA4Styles(cleaned, physH, physW);
    return cleaned.trim();
}

export function validateAIResponse(aiHTML) {
    const trimmed = aiHTML.trim();
    if (!trimmed) { console.error("❌ AI response is empty"); return false; }
    if (!trimmed.startsWith("<")) { console.error("❌ AI response doesn't start with HTML tag"); return false; }
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, "text/html");
        if (!doc.body.firstElementChild) { console.error("❌ AI response doesn't contain valid HTML elements"); return false; }
        const parserError = doc.querySelector("parsererror");
        if (parserError) { console.error("❌ HTML parsing error:", parserError.textContent); return false; }
    } catch (parseError) { console.error("❌ Failed to parse AI response:", parseError); return false; }
    console.log("✅ AI response validation passed");
    return true;
}

/** Strips partial tags and markdown from a streaming HTML string. */
export function cleanStreamingHTML(html) {
    const firstTag = html.indexOf("<");
    if (firstTag === -1) return "";
    let result = html.substring(firstTag);
    const lastOpen = result.lastIndexOf("<");
    const lastClose = result.lastIndexOf(">");
    if (lastOpen > lastClose) result = result.substring(0, lastOpen);
    return result.replace(/```\s*$/i, "").trim();
}

/** Minimal recursive DOM syncing to prevent flickering. */
export function syncDOMNodes(src, dest) {
    const sNodes = src.childNodes;
    const dNodes = dest.childNodes;
    for (let i = 0; i < sNodes.length; i++) {
        const s = sNodes[i];
        const d = dNodes[i];
        if (!d) {
            dest.appendChild(s.cloneNode(true));
        } else if (s.nodeType !== d.nodeType || s.nodeName !== d.nodeName) {
            dest.replaceChild(s.cloneNode(true), d);
        } else if (s.nodeType === 1) { // ELEMENT_NODE
            // Sync attributes (Crucial for styles/classes)
            const sAttrs = s.attributes;
            const dAttrs = d.attributes;
            // Add/Update attributes from source
            // We DON'T remove attributes that only exist in destination (e.g., data-gjs-*, id)
            // to preserve editor state and component identity.
            for (let j = 0; j < sAttrs.length; j++) {
                const attr = sAttrs[j];
                if (d.getAttribute(attr.name) !== attr.value) {
                    d.setAttribute(attr.name, attr.value);
                }
            }

            // Recurse if content differs
            if (s.innerHTML !== d.innerHTML) {
                if (i === sNodes.length - 1 || s.children.length < 10) {
                    syncDOMNodes(s, d);
                } else {
                    dest.replaceChild(s.cloneNode(true), d);
                }
            }
        } else if (s.nodeType === 3) { // TEXT_NODE
            if (d.nodeValue !== s.nodeValue) d.nodeValue = s.nodeValue;
        }
    }
    while (dest.childNodes.length > sNodes.length) dest.removeChild(dest.lastChild);
}
