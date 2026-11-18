import { axiosInstance } from '../../../app/config/api';

export async function Login(email, password) {
  const response = await axiosInstance.post('/auth/login', { email, password });
  return response.data;
}

export async function Register(payload) {
  const response = await axiosInstance.post('/auth/register', payload);
  return response.data;
}

/** izmena naloga: { name?, phone? } */
export async function UpdateMe(payload) {
  const response = await axiosInstance.patch('/auth/me', payload);
  return response.data;
}

export async function GetMe() {
  const response = await axiosInstance.get('/auth/me');
  return response.data;
}
