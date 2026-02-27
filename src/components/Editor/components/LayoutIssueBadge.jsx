/**
 * Floating badge that appears when GrapesJS detects components
 * crossing page-break lines. Clicking it auto-fixes all issues.
 */
export default function LayoutIssueBadge({ layoutIssues, onFixAll }) {
    if (layoutIssues === 0) return null;

    return (
        <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-red-600 text-white px-4 py-2 rounded-full shadow-2xl animate-bounce hover:animate-none group cursor-pointer border-2 border-white/20 transition-all active:scale-95"
            onClick={onFixAll}
            title="Click to fix all page break issues"
        >
            <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                </span>
                <span className="font-bold text-sm tracking-wide uppercase">
                    {layoutIssues} PAGE BREAK {layoutIssues === 1 ? "ISSUE" : "ISSUES"} DETECTED
                </span>
            </div>
            <button className="bg-white text-red-600 px-3 py-0.5 rounded-full text-xs font-black uppercase group-hover:bg-red-50 transition-colors shadow-sm">
                Fix All
            </button>
        </div>
    );
}
