export const OPENROUTER_MODELS = [
    "z-ai/glm-4.5-air:free",
    "arcee-ai/trinity-mini:free",
    "kwaipilot/kat-coder-pro:free",
    "tngtech/deepseek-r1t2-chimera:free",
    "mistralai/devstral-2512:free",
    "nvidia/nemotron-nano-12b-v2-vl:free",
    "amazon/nova-2-lite-v1:free",
    "openai/gpt-oss-20b:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nex-agi/deepseek-v3.1-nex-n1:free",
    "alibaba/tongyi-deepresearch-30b-a3b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "nvidia/nemotron-nano-9b-v2:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "qwen/qwen3-4b:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3n-e2b-it:free",
    "google/gemma-3-4b-it:free",
];

export const PAGE_SIZES = {
    A4: {
        portrait: { width: "210mm", height: "297mm" },
        landscape: { width: "297mm", height: "210mm" },
    },
    LETTER: {
        portrait: { width: "8.5in", height: "11in" },
        landscape: { width: "11in", height: "8.5in" },
    },
    A5: {
        portrait: { width: "148mm", height: "210mm" },
        landscape: { width: "210mm", height: "148mm" },
    },
    CUSTOM: {
        portrait: { width: "210mm", height: "297mm" },
        landscape: { width: "297mm", height: "210mm" },
    },
};

export const DOCUMENT_STRICT_STYLES = `
  /* Force everything to stay within boundaries */
  * {
      box-sizing: border-box !important;
      max-width: 100% !important;
      word-break: normal;
      overflow-wrap: normal;
      word-wrap: normal;
      hyphens: none !important;
      white-space: normal !important;
      scrollbar-width: none !important;
      min-width: 0 !important;
      line-height: normal !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
  }
  *::-webkit-scrollbar {
      display: none !important;
  }
  table {
      width: 100% !important;
      table-layout: fixed !important;
  }
  td, th {
      word-break: normal !important;
      white-space: normal !important;
  }
  .visual-page {
      overflow: hidden !important; 
  }
`;

export const WEBGL_INTERCEPTOR_SCRIPT = `
(function() {
  var originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, attributes) {
    if (type && (type === "webgl" || type === "webgl2" || type === "experimental-webgl")) {
      attributes = attributes || {};
      attributes.preserveDrawingBuffer = true;
    }
    return originalGetContext.call(this, type, attributes);
  };
})();
`;

// Lazily computed so btoa() runs in browser context, not at module parse time
export function getCanvasScripts() {
    return [
        "data:text/javascript;base64," + btoa(WEBGL_INTERCEPTOR_SCRIPT),
        "https://cdn.tailwindcss.com",
    ];
}

// Alias kept for backwards compatibility with any existing imports
export const CANVAS_SCRIPTS = typeof btoa !== "undefined"
    ? ["data:text/javascript;base64," + btoa(WEBGL_INTERCEPTOR_SCRIPT), "https://cdn.tailwindcss.com"]
    : ["https://cdn.tailwindcss.com"];

export const CANVAS_STYLES = [
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
];
