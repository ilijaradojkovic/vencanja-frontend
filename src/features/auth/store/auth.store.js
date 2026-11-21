import { createSlice } from '@reduxjs/toolkit';
import { clearAuthToken } from '../../../app/config/api';
import { login, restoreSession, updateMe } from '../services/auth.service';

const initialState = { user: null, token: null, status: 'idle', error: null, restored: false, savingMe: false };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      clearAuthToken();
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message;
      })
      .addCase(updateMe.pending, (state) => {
        state.savingMe = true;
      })
      .addCase(updateMe.fulfilled, (state, action) => {
        state.savingMe = false;
        state.user = action.payload;
      })
      .addCase(updateMe.rejected, (state) => {
        state.savingMe = false;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.restored = true;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.restored = true;
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
