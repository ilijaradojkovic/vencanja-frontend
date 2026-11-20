import { axiosInstance } from '../../../app/config/api';

export async function GetCurrentWedding() {
  const response = await axiosInstance.get('/weddings/current');
  return response.data;
}

export async function UpdateWedding(weddingId, patch) {
  const response = await axiosInstance.patch(`/weddings/${weddingId}`, patch);
  return response.data;
}
