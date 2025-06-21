import React, { useState, useCallback, useRef } from 'react';
import axios from "axios";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faSpinner } from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = "http://localhost:8000";

const FileUploadInput = ({config,setConfig}) => {
  
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null); // Use ref instead of getElementById

  const handleFileChange = useCallback(async (event) => {
    
    console.log("handleFileChange");
    const file = event.target.files[0];
    if (file) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        console.log('File uploaded successfully:', response.data);
        setSelectedFileName(file.name);
        setConfig({...config, file: file.name});
      } catch (error) {
        console.error('Error uploading file:', error);
        // Clear the input on error so user can retry with same file
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } finally {
        setIsUploading(false);
      }
    }
  }, []);

  const handleFileRemove = useCallback(() => {
    console.log("remove file");
    setSelectedFileName("");
    setIsUploading(false);
    setConfig(null);
    
    // ✅ CLEAR THE FILE INPUT VALUE - This fixes the issue!
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  return (
    <div className="attachment">
      {selectedFileName ? (
        <div className="file-display">
          <span className="file-name">{selectedFileName}</span>
          <button className="remove-file" onClick={handleFileRemove}>
            <span>x</span>
          </button>
        </div>
      ) : (
        <button
          className="upload-file"
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span style={{ marginLeft: '8px' }}>Uploading...</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faPaperclip} />
              <span style={{ marginLeft: '8px' }}>Attach File</span>
            </>
          )}
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={isUploading}
      />
    </div>
  );
};

export default FileUploadInput;