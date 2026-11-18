import { axiosInstance } from '../../../app/config/api';

export async function GetPhotos(weddingId) {
  const response = await axiosInstance.get(`/weddings/${weddingId}/photos`);
  return response.data;
}

export async function SetPhotoStatus(photoId, status) {
  const response = await axiosInstance.patch(`/photos/${photoId}`, { status });
  return response.data;
}

export async function BulkPhotoStatus(weddingId, ids, status) {
  const response = await axiosInstance.post(`/weddings/${weddingId}/photos/bulk-status`, { ids, status });
  return response.data;
}

export async function DeletePhoto(photoId) {
  const response = await axiosInstance.delete(`/photos/${photoId}`);
  return response.data;
}
