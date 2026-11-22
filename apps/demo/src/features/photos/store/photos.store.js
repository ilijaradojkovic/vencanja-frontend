import { createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';
import { bulkPhotoStatus, deletePhoto, fetchPhotos, setPhotoStatus } from '../services/photos.service';
import { logout } from '../../auth/store/auth.store';
import { PhotoStatus } from '../../../app/config/enums';

const adapter = createEntityAdapter({ sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt) });
const initialState = adapter.getInitialState({ status: 'idle' });

export const photosSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPhotos.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchPhotos.fulfilled, (state, action) => {
        state.status = 'succeeded';
        adapter.setAll(state, action.payload);
      })
      .addCase(fetchPhotos.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(setPhotoStatus.pending, (state, action) => {
        const p = state.entities[action.meta.arg.id];
        if (p) {
          p.prevStatus = p.status;
          p.status = action.meta.arg.status;
        }
      })
      .addCase(setPhotoStatus.fulfilled, (state, action) => adapter.upsertOne(state, action.payload))
      .addCase(setPhotoStatus.rejected, (state, action) => {
        const p = state.entities[action.meta.arg.id];
        if (p?.prevStatus) p.status = p.prevStatus;
      })
      .addCase(bulkPhotoStatus.fulfilled, (state, action) => adapter.upsertMany(state, action.payload))
      .addCase(deletePhoto.fulfilled, (state, action) => adapter.removeOne(state, action.payload.id))
      .addCase(logout, () => initialState);
  },
});

export const photosSelectors = adapter.getSelectors((state) => state.photos);
export const selectApprovedPhotos = createSelector(photosSelectors.selectAll, (all) => all.filter((p) => p.status === PhotoStatus.APPROVED));
export const selectPhotoCounts = createSelector(photosSelectors.selectAll, (all) => ({
  all: all.length,
  pending: all.filter((p) => p.status === PhotoStatus.PENDING).length,
  approved: all.filter((p) => p.status === PhotoStatus.APPROVED).length,
  hidden: all.filter((p) => p.status === PhotoStatus.HIDDEN).length,
}));
