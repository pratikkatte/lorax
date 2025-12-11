import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import axios from "axios";
import useLoraxConfig from "../globalconfig.js";
import LoraxMessage from "../components/loraxMessage.jsx";

export default function useFileUpload({
  config,
  mapResponseToConfig,
  onError,
  accept = ".trees,.tsz",
  autoClearOnError = true,
  setProject,
  backend,
  statusMessage,
  setStatusMessage
} = {}) {
  const { API_BASE } = useLoraxConfig();

  const {queryFile, isConnected} = backend;

  const [projects, setProjects] = useState([]);

  const [fileUploaded, setFileUploaded] = useState(false);
  

  useEffect(() => {
    if((isConnected && fileUploaded) || (isConnected && projects.length === 0)) {
      getProjects(API_BASE).then(projectsData => {
        console.log("projectsData", projectsData);
        setProjects((prev) => ({...prev, ...projectsData}));
      })
      .catch(error => {
        console.error('Failed to load projects:', error);
      });

      setFileUploaded(false);

      return () => {
        console.log("cleanup projects");
        // setProjects([]);
      };
    }
  },[API_BASE, isConnected, fileUploaded])

  const {tsconfig, setConfig, handleConfigUpdate} = config;
  const [loadingFile, setLoadingFile] = useState(null);

  const inputRef = useRef(null);
  const loadingRequestRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);


  const acceptAttr = useMemo(() => (Array.isArray(accept) ? accept.join(",") : accept), [accept]);

  const browse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const _finishSuccess = useCallback(
    (resp, file) => {
      try {    
        if (resp.filename) {

          setProject(file.project);

          // Use share_sid if available (for shared links), otherwise use owner_sid from response
          const sid = file.project === "Uploads" ? (file.share_sid || resp.owner_sid) : null;
          let value = null;
          if (file.genomiccoordstart && file.genomiccoordend) {
            value = [file.genomiccoordstart, file.genomiccoordend];
          } else if (file.value) {
            value = file.value;
          }
          handleConfigUpdate(resp.config, value, file.project, sid);
          
        }
      } catch (e) {
        console.error("Post-upload handling failed:", e);
      }
    },
    [config, mapResponseToConfig, setConfig]
  );

  const _finishError = useCallback(
    (err) => {
      if (typeof onError === "function") onError(err);
      if (autoClearOnError && inputRef.current) inputRef.current.value = "";
      setIsUploading(false);
      setLoadingFile(null);
      try {
        const apiMessage = err?.response?.data?.error || err?.response?.data?.message;
        const status = err?.response?.status;
        const message = apiMessage || err?.message || "Unexpected error";
        setError(status ? `${message} (HTTP ${status})` : message);
      } catch (_) {
        setError("Unexpected error");
      }
    },
    [autoClearOnError, onError]
  );

  const loadFile = useCallback(
    async (project) => {
      if (!project) return;
      if (loadingRequestRef.current) return;
      loadingRequestRef.current = true;
  
      // console.log("in loadFile", project);
      try {

        const start = performance.now();
        const url = `${API_BASE}/load_file`;
        const payload = project;
        // console.log("payload", payload);

        const res = await queryFile(payload);

        // const res = await axios.post(url, payload, {
        //   withCredentials: true,
        //   headers: {
        //     "Content-Type": "application/json",
        //   },
        // });
        const end = performance.now();
        console.log(`loadFile response time: ${((end - start) / 1000).toFixed(2)}s`);
        
        _finishSuccess(res, { name: project.file, project: project.project, value: project.value, genomiccoordstart: project.genomiccoordstart, genomiccoordend: project.genomiccoordend, share_sid: project.share_sid });
      } catch (err) {
        console.log("err", err);
        _finishError(err);
      } finally {
        setLoadingFile(null);
        loadingRequestRef.current = false;
      }
    },
    [API_BASE, _finishSuccess, _finishError]
  );

  const uploadFile = useCallback(
    async (file) => {
      if (!file) return;
      setSelectedFileName(file.name);
      setIsUploading(true);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      try {

        setUploadStatus("uploading file...");
        const response = await axios.post(`${API_BASE}/upload`, formData, {
          withCredentials: true,
          maxRedirects: 0,
          onUploadProgress: (evt) => {
            const total = evt.total ?? 0;
            const percent = total ? Math.round((evt.loaded * 100) / total) : 0;
            setUploadProgress(percent);
          },
        });

        if (response.status === 200) {

          setUploadStatus("loading inferred ARG....");

          const payload = {
            project: "Uploads",
            file: response?.data?.filename,
            share_sid: response?.data?.sid  // Pass the uploader's sid so the URL can be shared
          }
          setFileUploaded(true);
          await loadFile(payload);
        }
      } catch (err) {
        console.error("Error uploading file:", err);
        _finishError(err);
        return; // bail early; finally will still run to reset isUploading
      } finally {
        setIsUploading(false);
      }
    },
    [API_BASE, _finishError, _finishSuccess]
  );

  const onInputChange = useCallback(
    async (e) => {
      const file = e?.target?.files?.[0];
  
      // setStatusMessage({status: "ERROR", message: "uploading file..."});

      const maxSize = 50 * 1024 * 1024; // 50 MB
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds 50 MB limit.`);
        return;
      }
      await uploadFile(file);
    },
    [uploadFile]
  );

  const remove = useCallback(() => {
    setSelectedFileName("");
    setUploadProgress(0);
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (typeof setConfig === "function") setConfig(null);
  }, [setConfig]);

  // -------- Drag & Drop helpers --------
  const onDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds 50 MB limit.`);
        return;
      }
      if (file) await uploadFile(file);
    },
    [uploadFile]
  );

  const onDragEnter = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);

  const getProjects = useCallback((API_BASE) => {
    return axios.get(`${API_BASE}/projects`, { withCredentials: true })
      .then(response => {
        return response.data.projects;
      })
      .catch(error => {
        console.error('Error fetching projects:', error);
        return [];
      });
  }, []);

  // Props helpers (optional convenience)
  const getInputProps = useCallback(() => ({
    ref: inputRef,
    type: "file",
    accept: acceptAttr,
    onChange: onInputChange,
    style: { display: "none" },
    disabled: isUploading,
  }), [acceptAttr, isUploading, onInputChange]);

  const getDropzoneProps = useCallback(() => ({
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
  }), [onDragEnter, onDragLeave, onDragOver, onDrop]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    // state
    isUploading,
    uploadProgress,
    selectedFileName,
    dragOver,
    error,

    // refs
    inputRef,

    // core actions
    browse,
    remove,
    uploadFile,
    loadFile,
    loadingFile,
    setLoadingFile,
    dismissError,

    // event handlers
    onInputChange,
    onDrop,
    onDragEnter,
    onDragOver,
    onDragLeave,

    // convenience prop getters
    getInputProps,
    getDropzoneProps,
    projects,
    setProjects,
    getProjects,
    uploadStatus,
    statusMessage,
    setStatusMessage
  };
}
