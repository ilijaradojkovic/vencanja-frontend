import { axiosInstance } from '../../../app/config/api';

export async function GetGuests(weddingId) {
  const response = await axiosInstance.get(`/weddings/${weddingId}/guests`);
  return response.data;
}

export async function CreateGuest(weddingId, guest) {
  const response = await axiosInstance.post(`/weddings/${weddingId}/guests`, guest);
  return response.data;
}

export async function ImportGuests(weddingId, guests) {
  const response = await axiosInstance.post(`/weddings/${weddingId}/guests/import`, { guests });
  return response.data;
}

export async function UpdateGuest(guestId, patch) {
  const response = await axiosInstance.patch(`/guests/${guestId}`, patch);
  return response.data;
}

export async function DeleteGuest(guestId) {
  const response = await axiosInstance.delete(`/guests/${guestId}`);
  return response.data;
}
