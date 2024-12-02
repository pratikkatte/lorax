import React, { useState } from "react";
import "./App.css";
import Chatbot from "./Components/Chatbot";
import Visualization from "./Components/visualization";
function App() {

  const [userName, setUserName] = useState("");

  return (
    <div className="app-container">
    <div class="not-supported-message">
      <p>This view is not supported on mobile devices. Please enable desktop mode.</p>
    </div>
        <div className="right-container">
          <Chatbot userName={userName} />
        </div>
        {/* <div className="left-container">
            <Visualization/>
        </div> */}
    </div>
  );
}

export default App;
