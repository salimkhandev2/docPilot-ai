export const convertToPixels = (cssValue, frameDoc) => {
    if (!frameDoc) return 0;
    const testEl = frameDoc.createElement("div");
    testEl.style.cssText = `position: absolute; visibility: hidden; height: ${cssValue}; `;
    frameDoc.body.appendChild(testEl);
    const pixels = testEl.offsetHeight;
    frameDoc.body.removeChild(testEl);
    return pixels;
};

export const decodeHtmlEntities = (html) => {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    return textarea.value;
};

export const containsUrduOrArabic = (text) => {
    if (!text || typeof text !== "string") return false;
    const urduArabicPattern =
        /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return urduArabicPattern.test(text);
};

export const extractComponentText = (component) => {
    if (!component) return "";
    let textContent = "";
    const content = component.get("content");
    if (typeof content === "string") {
        textContent += content;
    } else if (Array.isArray(content)) {
        content.forEach((item) => {
            if (typeof item === "string") {
                textContent += item;
            } else if (item && typeof item === "object") {
                if (item.get && typeof item.get === "function") {
                    textContent += extractComponentText(item);
                } else if (item.content) {
                    textContent +=
                        typeof item.content === "string"
                            ? item.content
                            : extractComponentText(item);
                }
            }
        });
    }
    try {
        const view = component.getView?.();
        if (view && view.el) {
            const viewText = view.el.textContent || view.el.innerText || "";
            if (viewText.trim()) textContent += viewText;
        }
    } catch (e) { }
    try {
        const children = component.components?.();
        if (children && Array.isArray(children)) {
            children.forEach((child) => {
                textContent += extractComponentText(child);
            });
        }
    } catch (e) { }
    return textContent;
};

export const applyRTLIfNeeded = (component) => {
    try {
        if (!component) return;
        const textContent = extractComponentText(component);
        if (containsUrduOrArabic(textContent)) {
            const currentDirection = component.getStyle("direction");
            if (!currentDirection || currentDirection === "ltr") {
                component.addStyle({
                    direction: "rtl",
                    "text-align": "right",
                    "unicode-bidi": "embed",
                });
            }
            component.setAttributes({ dir: "rtl" });
        } else {
            try {
                const children = component.components?.();
                if (!children || children.length === 0) {
                    // don't auto-remove user-set RTL
                }
            } catch (e) { }
        }
    } catch (error) {
        console.warn("Error applying RTL:", error);
    }
};

export const generateRandomClass = () => {
    const prefix = "resize-";
    const randomId = Math.random().toString(36).substring(2, 9);
    return `${prefix}${randomId}`;
};
