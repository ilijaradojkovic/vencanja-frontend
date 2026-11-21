import { createAsyncThunk } from '@reduxjs/toolkit';
import { CreateAccount, DeleteAccount, GetAccounts, ResetAccountPassword, UpdateAccount } from '../api/admin.api';
import { toRejectValue } from '../../../utils/thunk.utils';

export const fetchAccounts = createAsyncThunk('admin/fetchAccounts', async (_, { rejectWithValue }) => {
  try {
    return await GetAccounts();
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const createAccount = createAsyncThunk('admin/createAccount', async (payload, { rejectWithValue }) => {
  try {
    return await CreateAccount(payload);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const updateAccount = createAsyncThunk('admin/updateAccount', async ({ id, ...payload }, { rejectWithValue }) => {
  try {
    return await UpdateAccount(id, payload);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const resetAccountPassword = createAsyncThunk('admin/resetPassword', async ({ id, password }, { rejectWithValue }) => {
  try {
    return await ResetAccountPassword(id, password);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const deleteAccount = createAsyncThunk('admin/deleteAccount', async (id, { rejectWithValue }) => {
  try {
    await DeleteAccount(id);
    return id;
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
