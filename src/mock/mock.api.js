import { axiosInstance } from '../app/config/api';

/** Postoji samo u mock režimu – vraća demo podatke na početno stanje */
export async function ResetMockData() {
  const response = await axiosInstance.post('/__mock/reset');
  return response.data;
}
