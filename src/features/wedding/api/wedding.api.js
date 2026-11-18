import { axiosInstance } from '../../../app/config/api';

export async function GetCurrentWedding() {
  const response = await axiosInstance.get('/weddings/current');
  return response.data;
}

/** patch: bilo koji podskup polja venčanja, npr. { invitation: {...} } ili { settings: {...} } */
export async function UpdateWedding(weddingId, patch) {
  const response = await axiosInstance.patch(`/weddings/${weddingId}`, patch);
  return response.data;
}
