import { axiosInstance } from '../../../app/config/api';

export async function SendPhotoNotifications(weddingId) {
  const response = await axiosInstance.post(`/weddings/${weddingId}/photo-notifications`);
  return response.data;
}
