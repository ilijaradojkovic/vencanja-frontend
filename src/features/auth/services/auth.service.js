import { createAsyncThunk } from '@reduxjs/toolkit';
import { GetMe, Login, Register, UpdateMe } from '../api/auth.api';
import { clearAuthToken, getAuthToken, setAuthToken } from '../../../app/config/api';
import { toRejectValue } from '../../../utils/thunk.utils';

export const login = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const response = await Login(email, password);
    setAuthToken(response.token);
    return response;
  } catch (error) {
    clearAuthToken();
    return rejectWithValue(toRejectValue(error));
  }
});

export const register = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const response = await Register(payload);
    setAuthToken(response.token);
    return response;
  } catch (error) {
    clearAuthToken();
    return rejectWithValue(toRejectValue(error));
  }
});

export const updateMe = createAsyncThunk('auth/updateMe', async (payload, { rejectWithValue }) => {
  try {
    return (await UpdateMe(payload)).user;
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  try {
    const token = getAuthToken();
    if (!token) return null;
    const response = await GetMe();
    return { token, user: response.user };
  } catch (error) {
    clearAuthToken();
    return rejectWithValue(toRejectValue(error));
  }
});
