import { useCallback } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prismjs/themes/prism-tomorrow.css";

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minHeight?: string;
  placeholder?: string;
}

export function JsonEditor({
  value,
  onChange,
  disabled = false,
  minHeight = "400px",
  placeholder = "Enter JSON...",
}: JsonEditorProps) {
  const highlight = useCallback((code: string) => {
    return Prism.highlight(code, Prism.languages.json, "json");
  }, []);

  return (
    <div
      className="rounded-lg border bg-[#2d2d2d] overflow-auto"
      style={{ minHeight }}
    >
      <Editor
        value={value}
        onValueChange={onChange}
        highlight={highlight}
        disabled={disabled}
        placeholder={placeholder}
        padding={16}
        style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 13,
          minHeight,
          lineHeight: 1.5,
        }}
        className="json-editor-textarea"
        textareaClassName="focus:outline-none"
      />
    </div>
  );
}
