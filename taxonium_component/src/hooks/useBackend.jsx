import useServerBackend from "./useServerBackend";
import useLocalBackend from "./useLocalBackend";

function useBackend(uploaded_data, setChangeInProcess)  {
  const localBackend = useLocalBackend(uploaded_data, setChangeInProcess);

  if (uploaded_data) {
    return localBackend;
  } else {
    window.alert(
      "TreeSeqBrowse did not receive the information it needed to launch."
    );
    return null;
  }
}
export default useBackend;
