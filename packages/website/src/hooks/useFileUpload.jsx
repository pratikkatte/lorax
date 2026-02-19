import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLorax } from "@lorax/core";

export default function useFileUpload({
    onError,
    accept = ".trees,.tsz,.tszip,.csv",
    autoClearOnError = true,
    statusMessage,
    setStatusMessage
} = {}) {
    const navigate = useNavigate();

    const {
        loraxSid,
        isConnected,
        getProjects,
        uploadFileToBackend
    } = useLorax();

    const [projects, setProjects] = useState([]);
    const [fileUploaded, setFileUploaded] = useState(false);

    // Fetch projects once session is established and connected
    useEffect(() => {
        if (loraxSid && isConnected) {
            getProjects()
                .then(projectsData => {
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

    const allowedExtensions = useMemo(() => {
        return acceptAttr
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.startsWith("."));
    }, [acceptAttr]);

    const isFileTypeAllowed = useCallback(
        (file) => {
            if (!file?.name || allowedExtensions.length === 0) return false;
            const name = file.name.toLowerCase();
            return allowedExtensions.some((ext) => name.endsWith(ext));
        },
        [allowedExtensions]
    );

    const browse = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const _finishSuccess = useCallback(
        (resp, file) => {
            const filename = resp.filename || file.name;
            const project = file.project || "Uploads";

            // Navigate immediately to FileView - it will handle loading the config
            const params = new URLSearchParams();
            params.set('project', project);
            if (file.share_sid) params.set('sid', file.share_sid);
            navigate(`/view/${encodeURIComponent(filename)}?${params.toString()}`);
        },
        [navigate]
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
        (project) => {
            if (!project) return;

            const filename = project.file;
            const projName = project.project;

            // Set loading state for UI feedback
            setLoadingFile(filename);

            // Navigate immediately to FileView - it will handle loading the config
            const params = new URLSearchParams();
            params.set('project', projName);
            if (project.share_sid) params.set('sid', project.share_sid);
            navigate(`/view/${encodeURIComponent(filename)}?${params.toString()}`);
        },
        [navigate]
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

            const maxSize = 25 * 1024 * 1024; // 25 MB
            if (file?.size > maxSize) {
                setError(`File "${file.name}" exceeds the 25 MB limit. For larger files, please use our Python CLI tool: \`pip install lorax-arg\``);
                if (inputRef.current) inputRef.current.value = "";
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
            if (!file) return;

            if (!isFileTypeAllowed(file)) {
                const supported = allowedExtensions.join(", ");
                setError(`File "${file.name}" has an unsupported format. Supported formats: ${supported}`);
                return;
            }

            const maxSize = 25 * 1024 * 1024;
            if (file.size > maxSize) {
                setError(`File "${file.name}" exceeds the 25 MB limit. For larger files, please use our Python CLI tool: \`pip install lorax-arg\``);
                return;
            }

            await uploadFile(file);
        },
        [uploadFile, isFileTypeAllowed, allowedExtensions]
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
