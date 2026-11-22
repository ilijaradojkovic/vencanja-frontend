import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { logout } from '../../auth/store/auth.store';
import { createAccount, deleteAccount, fetchAccounts, resetAccountPassword, updateAccount } from '../services/admin.service';

const initialState = { accounts: [], status: 'idle', saving: false };

const mutations = [createAccount, updateAccount, resetAccountPassword, deleteAccount];

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.accounts = action.payload;
      })
      .addCase(fetchAccounts.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(createAccount.fulfilled, (state, action) => {
        state.accounts.unshift(action.payload.account);
      })
      .addCase(updateAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.map((a) => (a.id === action.payload.id ? action.payload : a));
      })
      .addCase(deleteAccount.fulfilled, (state, action) => {
        state.accounts = state.accounts.filter((a) => a.id !== action.payload);
      })
      .addCase(logout, () => initialState)
      .addMatcher(isAnyOf(...mutations.map((m) => m.pending)), (state) => {
        state.saving = true;
      })
      .addMatcher(isAnyOf(...mutations.flatMap((m) => [m.fulfilled, m.rejected])), (state) => {
        state.saving = false;
      });
  },
});
