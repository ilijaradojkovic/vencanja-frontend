import { createSlice } from '@reduxjs/toolkit';
import { fetchInvitation, fetchPublicWedding, submitRsvp, uploadPhotos, uploadProgress } from '../services/invite.service';

const idleUpload = { status: 'idle', progress: 0, result: null };

/** Javni deo – pozivnica gosta (po tokenu) ili opšta stranica venčanja (po slug-u za QR kod) */
export const inviteSlice = createSlice({
  name: 'invite',
  initialState: {
    guest: null,
    wedding: null,
    status: 'idle',
    error: null,
    rsvpSaving: false,
    upload: idleUpload,
  },
  reducers: {
    resetUpload(state) {
      state.upload = idleUpload;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.status = 'loading';
      state.error = null;
    };
    const fulfilled = (state, action) => {
      state.status = 'succeeded';
      state.guest = action.payload.guest;
      state.wedding = action.payload.wedding;
    };
    const rejected = (state, action) => {
      state.status = 'failed';
      state.error = action.payload?.message;
    };
    builder
      .addCase(fetchInvitation.pending, pending)
      .addCase(fetchInvitation.fulfilled, fulfilled)
      .addCase(fetchInvitation.rejected, rejected)
      .addCase(fetchPublicWedding.pending, pending)
      .addCase(fetchPublicWedding.fulfilled, fulfilled)
      .addCase(fetchPublicWedding.rejected, rejected)
      .addCase(submitRsvp.pending, (state) => {
        state.rsvpSaving = true;
      })
      .addCase(submitRsvp.fulfilled, (state, action) => {
        state.rsvpSaving = false;
        if (state.guest) state.guest.rsvp = action.payload.rsvp;
      })
      .addCase(submitRsvp.rejected, (state) => {
        state.rsvpSaving = false;
      })
      .addCase(uploadProgress, (state, action) => {
        state.upload.progress = action.payload;
      })
      .addCase(uploadPhotos.pending, (state) => {
        state.upload = { status: 'loading', progress: 0, result: null };
      })
      .addCase(uploadPhotos.fulfilled, (state, action) => {
        state.upload = { status: 'succeeded', progress: 100, result: action.payload };
      })
      .addCase(uploadPhotos.rejected, (state) => {
        state.upload.status = 'failed';
      });
  },
});

export const { resetUpload } = inviteSlice.actions;
