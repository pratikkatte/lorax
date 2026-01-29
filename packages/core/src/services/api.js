import axios from "axios";

export const getProjects = async (API_BASE) => {
  try {
    const response = await axios.get(`${API_BASE}/projects`, { withCredentials: true });
    return response.data.projects;
  } catch (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
};

export const initSession = async (API_BASE) => {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(
        `${API_BASE}/init-session`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );
      return response?.data?.sid;
    } catch (error) {
      const isNetworkError = !error?.response;
      if (!isNetworkError || attempt === maxAttempts) {
        console.error("Error initializing session:", error);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  return null;
};

export const uploadFileToBackend = async (API_BASE, file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await axios.post(`${API_BASE}/upload`, formData, {
    withCredentials: true,
    maxRedirects: 0,
    onUploadProgress,
  });
  return response;
};
