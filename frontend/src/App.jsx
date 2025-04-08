
import './App.css'
import { useState } from 'react'

import Chatbot from "./components/chatbot/Chatbot";
import Visualization from './components/chatbot/visualization';

import Taxonium from './Taxonium'


function App() {

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
    
      {/* <div className="app-container">
        <div className="not-supported-message">
          <p>This view is not supported on mobile devices. Please enable desktop mode.</p>
        </div>
        <div className="right-container">
          <Chatbot userName={userName} />
        </div>
        <div className="left-container">
            <Visualization/>
        </div>  
      </div> */}
      <Taxonium backendUrl="http://localhost:8080" />
      {/* <Taxonium backendUrl="https://api.cov2tree.org" />; */}

      {/* <Taxonium 
      key={timestamp} 
      // sourceData={sourceData}
      backendUrl={`http://localhost:8080/`}
      />; */}
    </>
  );
}

export default App
