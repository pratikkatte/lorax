import React, { useState } from 'react';
import axios from "axios";

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperclip, faSpinner } from '@fortawesome/free-solid-svg-icons';

const API_BASE_URL = "http://localhost:8000";


const FileUploadInput = () => {

  const [selectedFileName, setSelectedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
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
        } catch (error) {
            console.error('Error uploading file:', error);
        } finally {
            setIsUploading(false);
        }
    }
  };
  const handleFileRemove = (event) => {
    console.log("remove file")
    setSelectedFileName("");
  }

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
        onClick={() => document.getElementById('fileInput').click()}
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
      id="fileInput"
      type="file"
      style={{ display: 'none' }}
      onChange={handleFileChange}
      disabled={isUploading}
    />
  </div>
)};

export default FileUploadInput; 