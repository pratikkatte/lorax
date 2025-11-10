import { useState, useEffect } from "react";
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function formatNumber(num) {
  if (!num && num !== 0) return "";
  return Number(num).toLocaleString();
}

export default function EditableRange({ valueRef, onChange, genomeLength }) {
  const [start, setStart] = useState(valueRef?.current?.[0] || 0);
  const [end, setEnd] = useState(valueRef?.current?.[1] || 0);
  const [hasChanges, setHasChanges] = useState(false);

  // Keep local state in sync with prop
  useEffect(() => {
    setStart(valueRef?.current?.[0] || 0);
  }, [valueRef?.current?.[0]]);

  useEffect(() => {
    setEnd(valueRef?.current?.[1] || 0);
  }, [valueRef?.current?.[1]]);

  const handleStartChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setStart(value);
    setHasChanges(true);
  };

  const handleEndChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setEnd(value);
    setHasChanges(true);
  };

  const handleSubmit = () => {
    if (hasChanges) {
      if (start < 0) setStart(0);
      if (end > genomeLength) setEnd(genomeLength);

      if (start > end) console.log("start > end");
      else {
        console.log("changing valueRef to", [start, end]);
        onChange([start, end]);
        setHasChanges(false);
      }
      
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px",
      border: "1px solid #ddd",
      borderRadius: "6px",
      backgroundColor: "white",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      position: "relative"
    }}>
      <input
        type="number"
        value={start}
        onChange={handleStartChange}
        onKeyPress={handleKeyPress}
        style={{
          width: "50%",
          padding: "4px 6px",
          // border: "1px solid #eee",
          border: "none",
          borderRadius: "4px",
          textAlign: "center",
          fontSize: "14px",
          fontFamily: "monospace",
          outline: "none",
          backgroundColor: "white",
          height: "24px"
        }}
      />
      <span style={{ fontSize: "14px", color: "#666" }}>...</span>
      <input
        type="number"
        value={end}
        onChange={handleEndChange}
        onKeyPress={handleKeyPress}
        style={{
          width: "50%",
          padding: "4px 6px",
          // border: "1px solid #eee",
          border: "none",
          borderRadius: "4px",
          textAlign: "center",
          fontSize: "14px",
          fontFamily: "monospace",
          outline: "none",
          backgroundColor: "white",
          height: "24px"
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!hasChanges}
        style={{
          background: "none",
          border: "1px solid #eee",
          cursor: hasChanges ? "pointer" : "not-allowed",
          fontSize: "14px",
          padding: "4px 6px",
          color: hasChanges ? "#666" : "#ccc",
          borderRadius: "3px",
          // marginLeft: "2px"
        }}
        title="Submit changes"
      >
        {/* 🔍 */}
        <FontAwesomeIcon icon={faSearch} />
      </button>
    </div>
  );
}
