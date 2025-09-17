import { useState } from "react";
const useHoverDetails = () => {
    
  const [hoveredInfo, setHoveredInfo] = useState(null);

  return { hoveredInfo, setHoveredInfo };
}

export default useHoverDetails;