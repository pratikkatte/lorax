import useLocalBackend from "./useLocalBackend";

function useBackend(backend_url, sid, url_on_fail, uploaded_data) {
  
  const localBackend = useLocalBackend(uploaded_data);

  if (uploaded_data) {
    return localBackend;
  } else {
    window.alert(
      "Taxonium did not receive the information it needed to launch."
    );
    return null;
  }
}
export default useBackend;
