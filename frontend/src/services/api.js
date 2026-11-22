import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export const analyzeAudio = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const fetchHistory = async () => {
  const response = await axios.get(`${API_BASE_URL}/history`);
  return response.data;
};

export const fetchMetrics = async () => {
  const response = await axios.get(`${API_BASE_URL}/metrics`);
  return response.data;
};