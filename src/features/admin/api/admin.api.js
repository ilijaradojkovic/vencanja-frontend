import { axiosInstance } from '../../../app/config/api';

export async function GetAccounts() {
  const response = await axiosInstance.get('/admin/accounts');
  return response.data;
}

export async function CreateAccount(payload) {
  const response = await axiosInstance.post('/admin/accounts', payload);
  return response.data;
}

export async function UpdateAccount(id, payload) {
  const response = await axiosInstance.patch(`/admin/accounts/${id}`, payload);
  return response.data;
}

export async function ResetAccountPassword(id, password) {
  const response = await axiosInstance.post(`/admin/accounts/${id}/password`, { password });
  return response.data;
}

export async function DeleteAccount(id) {
  const response = await axiosInstance.delete(`/admin/accounts/${id}`);
  return response.data;
}
