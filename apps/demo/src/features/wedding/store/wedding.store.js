import { createSlice } from '@reduxjs/toolkit';
import { fetchWedding, updateWedding } from '../services/wedding.service';
import { logout } from '../../auth/store/auth.store';
import { sendPhotoNotifications } from '../../notifications/services/notifications.service';

const initialState = { data: null, status: 'idle', saving: false, error: null };

export const weddingSlice = createSlice({
  name: 'wedding',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWedding.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWedding.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchWedding.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.message;
      })
      .addCase(updateWedding.pending, (state) => {
        state.saving = true;
      })
      .addCase(updateWedding.fulfilled, (state, action) => {
        state.saving = false;
        state.data = action.payload;
      })
      .addCase(updateWedding.rejected, (state) => {
        state.saving = false;
      })
      .addCase(sendPhotoNotifications.fulfilled, (state, action) => {
        (state.data?.photoSubscribers || []).forEach((x) => {
          if (action.payload.subscriberIds.includes(x.id)) x.sentAt = action.payload.sentAt;
        });
      })
      .addCase(logout, () => initialState);
  },
});

export const selectWedding = (state) => state.wedding.data;
