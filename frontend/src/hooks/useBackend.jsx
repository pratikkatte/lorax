import { useEffect, useRef } from "react";
import useServerBackend from "./useServerBackend";
import useLocalBackend from "./useLocalBackend";

function useBackend(socketRef)  {
  const localBackend = useLocalBackend(socketRef);
  return localBackend;
}
export default useBackend;
