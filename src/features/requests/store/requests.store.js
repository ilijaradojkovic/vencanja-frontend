import { createSlice } from '@reduxjs/toolkit';
import { createRequest, fetchRequests } from '../services/requests.service';
import { logout } from '../../auth/store/auth.store';

const initialState = { items: [], status: 'idle', saving: false };

export const requestsSlice = createSlice({
  name: 'requests',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequests.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchRequests.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchRequests.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(createRequest.pending, (state) => {
        state.saving = true;
      })
      .addCase(createRequest.fulfilled, (state, action) => {
        state.saving = false;
        state.items.unshift(action.payload);
      })
      .addCase(createRequest.rejected, (state) => {
        state.saving = false;
      })
      .addCase(logout, () => initialState);
  },
});
