
import './App.css'
import { useState } from 'react'

import Chatbot from "./components/chatbot/Chatbot";
import Visualization from './components/chatbot/visualization';

import Taxonium from './Taxonium'
import TreeSequenceUploader from './components/TreeSequenceUploader'


function App() {


  const [fileUpload, setFileUpload] = useState(false)

  const handleUploadSuccess = (result) => {
    if(result.status == 201){
      setFileUpload(true)
    }
    // Handle the uploaded data (e.g., pass to visualization component)
  };

  const handleUploadError = (error) => {
    console.error('Upload error:', error);
  };


  const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);`;
  // const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);((A:0.1,B:0.50):0.3,(C:0.4,D:0.5):0.6);`;
  // const nwk = `((A:0.1,B:0.2):0.3,((C:0.2,D:0.3):0.4,(E:0.3,F:0.2):0.5):0.2,((G:0.2,H:0.3):0.1,(I:0.4,J:0.3):0.2):0.3);`
  // const nwk = `((A:0.1,B:0.2):0.3,((C:0.2,D:0.3):0.4,(E:0.3,F:0.2):0.5):0.2,((G:0.2,H:0.3):0.1,(I:0.4,J:0.3):0.2):0.3);(((A:0.2,B:0.3):0.4,(C:0.5,D:0.2):0.3):0.2,((E:0.3,F:0.4):0.2,(G:0.2,H:0.3):0.4):0.3,(I:0.5,J:0.2):0.4);`

  const sourceData = {
    status: "loaded",
    filename: "test.nwk",
    data: nwk,
    filetype: "nwk",
    mutationtypeEnabled: true,
  };

  const timestamp = Date.now();

  const [userName, setUserName] = useState("");

  return (
  <>

    {/*  */}

    {!fileUpload ? <TreeSequenceUploader
      onUploadSuccess={handleUploadSuccess}
      onUploadError={handleUploadError}
    /> : <Taxonium backendUrl="http://localhost:8080" /> 
    }

  </>
  );
}

export default App
