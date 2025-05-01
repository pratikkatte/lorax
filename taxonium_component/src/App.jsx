import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'
import Taxonium from './Taxonium.jsx'
import TreeSequenceUploader from './components/TreeSequenceUploader'

function App() {

    const [file, setFile] = useState(null);

    const [fileUpload, setFileUpload] = useState(false)
    const handleUploadSuccess = (result) => {
        if(result.status == 201){
          // setFileUpload(true)
        }
      };

      const handleUploadError = (error) => {
        console.error('Upload error:', error);
      };
      
  return (
    <>
    {!file ? <TreeSequenceUploader
      onUploadSuccess={handleUploadSuccess}
      onUploadError={handleUploadError}
      setFile={setFile}
      file={file}
    /> : 
      <Taxonium uploadFile={file}/>
    }
    </>
  )
}

export default App

