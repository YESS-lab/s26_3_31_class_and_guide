import React, { useState } from "react";

interface PersonaField {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  required: boolean;
  placeholder?: string;
}

interface PersonaEditorProps {
  fields: PersonaField[];
  persona: Record<string, any>;
  onPersonaChange: (p: Record<string, any>) => void;
  accentColor: string;
}

export function PersonaEditor({
  fields,
  persona,
  onPersonaChange,
  accentColor,
}: PersonaEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFieldChange = (key: string, value: string | number) => {
    onPersonaChange({ ...persona, [key]: value });
  };

  if (fields.length === 0) return null;

  return (
    <div className="border-t border-gray-700">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span>About You</span>
        <span className="text-xs text-gray-500">{isExpanded ? "▼" : "▶"}</span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500 italic">
            Optional — helps the agent understand your context
          </p>

          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="block text-xs font-medium text-gray-400">
                {field.label}
                {field.required && (
                  <span className="ml-1" style={{ color: accentColor }}>
                    *
                  </span>
                )}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  value={persona[field.key] ?? ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-gray-800 text-white border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:border-gray-400 resize-none"
                />
              ) : (
                <input
                  type={field.type}
                  value={persona[field.key] ?? ""}
                  onChange={(e) =>
                    handleFieldChange(
                      field.key,
                      field.type === "number"
                        ? e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                        : e.target.value
                    )
                  }
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-sm bg-gray-800 text-white border border-gray-600 rounded-md placeholder-gray-500 focus:outline-none focus:border-gray-400"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
