import { OPENROUTER_MODELS } from "../utils/editorConstants";

/**
 * Modal form for the AI Regenerate feature.
 * Receives modalData / setModalData so it can update fields without
 * exposing complex state to the parent.
 */
export default function AiRegenerateModal({ modalData, setModalData }) {
    const handleSubmit = (e) => {
        e.preventDefault();
        modalData.onSubmit?.(
            modalData.userRequest,
            modalData.imageFile,
            modalData.imageUrl,
            modalData.aiProvider,
            modalData.openRouterModel,
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-4">AI Regenerate Component</h2>

                    <form onSubmit={handleSubmit}>
                        {/* AI Provider */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</label>
                            <select
                                value={modalData.aiProvider}
                                onChange={(e) => setModalData({ ...modalData, aiProvider: e.target.value, imageFile: null, imageUrl: "", imagePreview: null })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="gemini">🔮 Gemini (supports images)</option>
                                <option value="openrouter">🌐 OpenRouter (text only)</option>
                            </select>
                        </div>

                        {/* OpenRouter model */}
                        {modalData.aiProvider === "openrouter" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">OpenRouter Model</label>
                                <select
                                    value={modalData.openRouterModel}
                                    onChange={(e) => setModalData({ ...modalData, openRouterModel: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                >
                                    {OPENROUTER_MODELS.map((m) => (<option key={m} value={m}>{m}</option>))}
                                </select>
                                <p className="mt-1 text-xs text-gray-500">{OPENROUTER_MODELS.length} free models available</p>
                            </div>
                        )}

                        {/* Prompt */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">What would you like to change?</label>
                            <textarea
                                value={modalData.userRequest}
                                onChange={(e) => setModalData({ ...modalData, userRequest: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        modalData.onSubmit?.(modalData.userRequest, modalData.imageFile, modalData.imageUrl, modalData.aiProvider, modalData.openRouterModel);
                                    }
                                }}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder='e.g., "make it a hero section", "add a button", "change colors to blue"'
                                required
                            />
                        </div>

                        {/* Image URL – Gemini only */}
                        {modalData.aiProvider === "gemini" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL (Optional)</label>
                                <input
                                    type="url" value={modalData.imageUrl}
                                    onChange={(e) => { const url = e.target.value; setModalData({ ...modalData, imageUrl: url, imageFile: null, imagePreview: url || null }); }}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="mt-1 text-xs text-gray-500">Enter an image URL or upload a file below</p>
                            </div>
                        )}

                        {/* Divider – Gemini only */}
                        {modalData.aiProvider === "gemini" && (
                            <div className="mb-4 flex items-center">
                                <div className="flex-1 border-t border-gray-300" />
                                <span className="px-2 text-sm text-gray-500">OR</span>
                                <div className="flex-1 border-t border-gray-300" />
                            </div>
                        )}

                        {/* Image Upload – Gemini only */}
                        {modalData.aiProvider === "gemini" && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Image (Optional)</label>
                                <input
                                    type="file" accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
                                            const reader = new FileReader();
                                            reader.onloadend = () => { setModalData({ ...modalData, imageFile: file, imageUrl: "", imagePreview: reader.result }); };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                />
                                {modalData.imagePreview && (
                                    <div className="mt-4">
                                        <img src={modalData.imagePreview} alt="Preview" className="max-w-full h-auto max-h-48 rounded-lg border border-gray-300" />
                                        <button type="button" onClick={() => setModalData({ ...modalData, imageFile: null, imageUrl: "", imagePreview: null })} className="mt-2 text-sm text-red-600 hover:text-red-800">Remove Image</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* OpenRouter info */}
                        {modalData.aiProvider === "openrouter" && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-700">🌐 <strong>OpenRouter</strong> uses free models for text-based HTML generation. Image support is not available with this provider.</p>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex gap-4 justify-end">
                            <button type="button" onClick={() => modalData.onCancel?.()}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors">
                                Cancel
                            </button>
                            <button type="submit"
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                                Generate
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
