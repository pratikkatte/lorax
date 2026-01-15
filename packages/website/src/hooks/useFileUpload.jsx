import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLorax } from "@lorax/core";

export default function useFileUpload({
    onError,
    accept = ".trees,.tsz",
    autoClearOnError = true,
    statusMessage,
    setStatusMessage
} = {}) {
    const navigate = useNavigate();

    const {
        loraxSid,
        isConnected,
        getProjects,
        uploadFileToBackend,
        queryFile,
        handleConfigUpdate,
        configEnabled
    } = useLorax();

    const [projects, setProjects] = useState([]);
    const [fileUploaded, setFileUploaded] = useState(false);

    // Fetch projects once session is established and connected
    useEffect(() => {
        if (loraxSid && isConnected) {
            console.log("Session ready, fetching projects with SID:", loraxSid);
            getProjects()
                .then(projectsData => {
                    console.log("projectsData", projectsData);
                    setProjects((prev) => ({ ...prev, ...projectsData }));
                })
                .catch(error => {
                    console.error('Failed to load projects:', error);
                });
        }
    }, [loraxSid, isConnected, getProjects]);

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
        async (resp, file) => {
            const filename = resp.filename || file.name;
            const project = file.project || "Uploads";

            // If config is enabled, use the config flow (queryFile → handleConfigUpdate)
            if (configEnabled && queryFile && handleConfigUpdate) {
                try {
                    console.log("Loading file config via queryFile:", filename, project);
                    setUploadStatus("loading config...");

                    const loadResult = await queryFile({
                        project: project,
                        file: filename,
                        share_sid: file.share_sid
                    });

                    if (loadResult && loadResult.config) {
                        // Process config - updates state in useLoraxConfig
                        const value = file.genomiccoordstart && file.genomiccoordend
                            ? [file.genomiccoordstart, file.genomiccoordend]
                            : null;
                        handleConfigUpdate(loadResult.config, value, project, file.share_sid);
                        setUploadStatus("config loaded");
                        console.log("Config loaded successfully:", loadResult.config.filename);

                        // Navigate to file view
                        const params = new URLSearchParams();
                        params.set('project', project);
                        if (file.share_sid) params.set('sid', file.share_sid);
                        navigate(`/${encodeURIComponent(filename)}?${params.toString()}`);
                    }
                } catch (err) {
                    console.error("Error loading file config:", err);
                    setUploadStatus("error loading config");
                }
            } else {
                console.warn("Config not enabled or missing dependencies");
            }
        },
        [configEnabled, queryFile, handleConfigUpdate, navigate]
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
            console.log("Loading project/file:", project);

            const filename = project.file;
            const projName = project.project;

            // If config is enabled, use the config flow
            if (configEnabled && queryFile && handleConfigUpdate) {
                try {
                    setLoadingFile(filename);
                    console.log("Loading file config via queryFile:", filename, projName);

                    const loadResult = await queryFile({
                        project: projName,
                        file: filename,
                        share_sid: project.share_sid
                    });

                    if (loadResult && loadResult.config) {
                        // Process config - updates state in useLoraxConfig
                        handleConfigUpdate(loadResult.config, null, projName, project.share_sid);
                        console.log("Config loaded successfully:", loadResult.config.filename);

                        // Navigate to file view
                        const params = new URLSearchParams();
                        params.set('project', projName);
                        if (project.share_sid) params.set('sid', project.share_sid);
                        navigate(`/${encodeURIComponent(filename)}?${params.toString()}`);
                    }
                } catch (err) {
                    console.error("Error loading file config:", err);
                } finally {
                    setLoadingFile(null);
                }
            } else {
                console.warn("Config not enabled or missing dependencies");
            }
        },
        [configEnabled, queryFile, handleConfigUpdate, navigate]
    );

    const uploadFile = useCallback(
        async (file) => {
            if (!file) return;
            setSelectedFileName(file.name);
            setIsUploading(true);
            setUploadProgress(0);

            try {
                setUploadStatus("uploading file...");

                const response = await uploadFileToBackend(
                    file,
                    (evt) => {
                        const total = evt.total ?? 0;
                        const percent = total ? Math.round((evt.loaded * 100) / total) : 0;
                        setUploadProgress(percent);
                    }
                );

                if (response.status === 200) {

                    setUploadStatus("loading inferred ARG....");

                    const payload = {
                        project: "Uploads",
                        file: response?.data?.filename,
                        share_sid: response?.data?.sid
                    }
                    setFileUploaded(true);

                    // Redirect
                    _finishSuccess(response.data, payload);
                }
            } catch (err) {
                console.error("Error uploading file:", err);
                _finishError(err);
                return;
            } finally {
                setIsUploading(false);
            }
        },
        [uploadFileToBackend, _finishError, _finishSuccess]
    );

    const onInputChange = useCallback(
        async (e) => {
            const file = e?.target?.files?.[0];

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
    }, []);

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

    // Props helpers
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
        isUploading,
        uploadProgress,
        selectedFileName,
        dragOver,
        error,
        inputRef,
        browse,
        remove,
        uploadFile,
        loadFile,
        loadingFile,
        setLoadingFile,
        dismissError,
        onInputChange,
        onDrop,
        onDragEnter,
        onDragOver,
        onDragLeave,
        getInputProps,
        getDropzoneProps,
        projects,
        setProjects,
        getProjects,
        uploadStatus,
        statusMessage,
        setStatusMessage,
        isConnected,
        loraxSid
    };
}
