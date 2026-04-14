import React, { useRef, useState } from "react";

interface FileUploadProps {
  sessionId: string | null;
  onFileUploaded: (file: { originalName: string; storedPath: string }) => void;
}

const ACCEPTED_TYPES = ".txt,.md,.json,.csv,.png,.jpg,.jpeg,.gif,.pdf";

export function FileUpload({ sessionId, onFileUploaded }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;

    setIsUploading(true);

    try {
      const res = await fetch(`/api/upload/${sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": file.name,
        },
        body: file,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const result = await res.json();
      onFileUploaded({
        originalName: result.originalName,
        storedPath: result.storedPath,
      });
    } catch (error) {
      console.error("File upload error:", error);
    } finally {
      setIsUploading(false);
      // Reset input so the same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={!sessionId || isUploading}
        title="Attach a file"
        className="px-3 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? (
          <span className="text-sm animate-pulse">...</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>
    </>
  );
}
