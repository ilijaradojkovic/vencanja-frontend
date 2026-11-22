import { axiosInstance } from '../app/config/api';

export async function ResetMockData() {
  const response = await axiosInstance.post('/__mock/reset');
  return response.data;
}
