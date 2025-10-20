import { useCallback, useMemo, useRef, useState } from "react";
import axios from "axios";
import useLoraxConfig from "../globalconfig.js";
import { useNavigate } from "react-router-dom";

/**
 * useFileUpload
 * A reusable hook that encapsulates file-upload behavior for the Lorax app.
 *
 * Features:
 * - Hidden <input type="file"> management via ref
 * - Click-to-browse, drag & drop, remove/reset
 * - Upload with progress to `${API_BASE}/upload`
 * - Pluggable callbacks for success/error, optional setConfig wiring
 *
 * @param {Object} options
 * @param {(cfg:any)=>void} [options.setConfig] - If provided, setConfig will be called with `{...config, file: file.name}` or with the value returned by `mapResponseToConfig`.
 * @param {any} [options.config] - Current config (if you want us to mutate it after upload).
 * @param {(resp:any, file:File)=>any} [options.mapResponseToConfig] - Convert upload response -> config object. Defaults to `(resp)=>({...config, file: file.name})`.
 * @param {(resp:any, file:File)=>void} [options.onUploaded] - Called after successful upload.
 * @param {(err:any)=>void} [options.onError] - Called on error.
 * @param {string|string[]} [options.accept] - Accept string(s) for input. Default covers .trees / newick / BED / bigBed / json.
 * @param {boolean} [options.autoClearOnError=true] - Clear <input> if upload fails.
 * @returns helpers and state for wiring inputs and dropzones
 */
export default function useFileUpload({
  config,
  mapResponseToConfig,
  onError,
  accept = ".trees,.ts,.tree,.newick,.nwk,.json,.bb,.bed,.bed.gz",
  autoClearOnError = true,
  setProject,
} = {}) {
  const { API_BASE } = useLoraxConfig();
  const navigate = useNavigate(); 

  const {tsconfig, setConfig} = config;
  const [loadingFile, setLoadingFile] = useState(null);


  const inputRef = useRef(null);
  const loadingRequestRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  const acceptAttr = useMemo(() => (Array.isArray(accept) ? accept.join(",") : accept), [accept]);

  const browse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const _finishSuccess = useCallback(
    (resp, file) => {
      try {
        console.log("resp", resp, file);
        if (typeof setConfig === "function") {
          const cfg = typeof mapResponseToConfig === "function"
            ? mapResponseToConfig(resp, file, config)
            : { ...(config ?? {}), file: file?.name };
        }
        if (file?.name) {

          setProject(file.project);

          navigate(`/${encodeURIComponent(file.name)}`);
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
  
      try {
        const url = `${API_BASE}/load_file`;
        const payload = project;
        console.log("payload", payload);
        const res = await axios.post(url, payload);
        _finishSuccess(res?.data, { name: project.file, project: project.project });
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
        const response = await axios.post(`${API_BASE}/upload`, formData, {
          maxRedirects: 0,
          onUploadProgress: (evt) => {
            const total = evt.total ?? 0;
            const percent = total ? Math.round((evt.loaded * 100) / total) : 0;
            setUploadProgress(percent);
          },
        });
        _finishSuccess(response?.data, file);
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
      if (file) await uploadFile(file);
    },
    [uploadFile]
  );

  const onDragEnter = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const onDragOver = useCallback((e) => { e.preventDefault(); }, []);
  const onDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);

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
  };
}
