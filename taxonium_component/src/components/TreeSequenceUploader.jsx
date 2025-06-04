import React, { useState } from 'react';
import './TreeSequenceUploader.css'; // Optional for styling
import axios from 'axios';

const TreeSequenceUploader = ({ onUploadSuccess, onUploadError, setFile, file }) => {
  
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Validate file type
    if (selectedFile && !selectedFile.name.match(/\.(trees|ts|treeseq)$/i)) {
      setError('Please upload a valid TreeSequence file (.trees, .ts, .treeseq)');
      return;
    }
    
    setError(null);
    setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // try {
    //   // Create form data
    //   const formData = new FormData();
    //   formData.append('treesFile', file);
      
    //   const response = await axios.post('http://localhost:8080/upload', formData, {
    //     headers: {
    //       'Content-Type': 'multipart/form-data'
    //     },
    //     onUploadProgress: (progressEvent) => {
    //       const progress = Math.round(
    //         (progressEvent.loaded * 100) / progressEvent.total
    //       );
    //       setUploadProgress(progress);
    //     }
    //   });

    //   if (onUploadSuccess) {
    //     console.log("response", response)
    //     onUploadSuccess(response);
    //   }
    // } catch (err) {
    //   setError(err.message);
    //   if (onUploadError) {
    //     onUploadError(err);
    //   }
    // } finally {
    //   setIsLoading(false);
    // }
  };

  return (
    <div className="tree-sequence-uploader">
      <h2>Upload TreeSequence File</h2>
      
      <div className="upload-container">
        <input
          type="file"
          id="treeSequenceFile"
          accept=".trees,.ts,.treeseq"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        
        <button 
          onClick={handleUpload}
          disabled={isLoading || !file}
        >
          {isLoading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      
      {isLoading && (
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}
      
      {file && !isLoading && (
        <div className="file-info">
          <p>Selected file: {file.name}</p>
          <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default TreeSequenceUploader;