'use client'
import { useEffect, useRef, useState } from 'react';

/**
 * Simple React component to upload image and get AI analysis
 * Uses FormData to send image file to /api/editor/ai-regenerate
 */
export default function ImageAnalysisUpload() {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('Describe this image in detail, including objects, colors, style, composition, and any notable features.');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const responseEndRef = useRef(null);

  // Handle image file selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setImageFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!imageFile) {
      setError('Please select an image file');
      return;
    }

    if (!customPrompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsLoading(true);
    setIsStreaming(false);
    setError(null);
    setResponse('');

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('customPrompt', customPrompt);

      // Send request to API
      const response = await fetch('/api/editor/ai-regenerate', {
        method: 'POST',
        body: formData, // FormData automatically sets Content-Type with boundary
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to process request' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Handle streaming response (Server-Sent Events)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      setIsStreaming(true);
      setIsLoading(false); // Switch to streaming mode

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.chunk) {
                accumulatedText += data.chunk;
                setResponse(accumulatedText);
                // Auto-scroll to bottom as content streams in
                setTimeout(() => {
                  responseEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 0);
              }

              if (data.isComplete) {
                setIsStreaming(false);
                return;
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              if (parseError.message !== 'Unexpected end of JSON input') {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      }

      setIsStreaming(false);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to process image');
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setImageFile(null);
    setImagePreview(null);
    setResponse('');
    setError(null);
    setIsLoading(false);
    setIsStreaming(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Auto-scroll effect when response updates
  useEffect(() => {
    if (isStreaming && responseEndRef.current) {
      responseEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [response, isStreaming]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">
        Image Analysis with AI
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Upload Image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              cursor-pointer"
          />
          
          {/* Image Preview */}
          {imagePreview && (
            <div className="mt-4">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-w-full h-auto max-h-64 rounded-lg border border-gray-300"
              />
            </div>
          )}
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Custom Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your prompt here..."
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isLoading || !imageFile}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md
              hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-400 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? 'Processing...' : 'Analyze Image'}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md
              hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500
              transition-colors"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Response Display */}
      {(response || isStreaming) && (
        <div className="mt-8 space-y-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            AI Response:
            {isStreaming && (
              <span className="text-sm font-normal text-blue-600 flex items-center gap-1">
                <span className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                Streaming...
              </span>
            )}
          </h2>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md
            max-h-96 overflow-y-auto">
            <p className="whitespace-pre-wrap text-gray-800">{response}</p>
            {isStreaming && (
              <span 
                ref={responseEndRef}
                className="inline-block w-2 h-4 bg-blue-600 ml-1 animate-pulse"
                aria-hidden="true"
              ></span>
            )}
            {!isStreaming && response && (
              <div ref={responseEndRef} />
            )}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && !response && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Processing image...</p>
        </div>
      )}
    </div>
  );
}

