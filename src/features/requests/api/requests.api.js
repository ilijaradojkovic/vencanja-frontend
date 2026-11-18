import { axiosInstance } from '../../../app/config/api';

export async function GetDesignRequests(weddingId) {
  const response = await axiosInstance.get(`/weddings/${weddingId}/design-requests`);
  return response.data;
}

export async function CreateDesignRequest(weddingId, payload) {
  const response = await axiosInstance.post(`/weddings/${weddingId}/design-requests`, payload);
  return response.data;
}
