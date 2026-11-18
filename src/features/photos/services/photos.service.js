import { createAsyncThunk } from '@reduxjs/toolkit';
import { BulkPhotoStatus, DeletePhoto, GetPhotos, SetPhotoStatus } from '../api/photos.api';
import { toRejectValue, weddingIdFrom } from '../../../utils/thunk.utils';

export const fetchPhotos = createAsyncThunk('photos/fetch', async (_, { getState, rejectWithValue }) => {
  try {
    return await GetPhotos(weddingIdFrom(getState));
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const setPhotoStatus = createAsyncThunk('photos/setStatus', async ({ id, status }, { rejectWithValue }) => {
  try {
    return await SetPhotoStatus(id, status);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const bulkPhotoStatus = createAsyncThunk('photos/bulkStatus', async ({ ids, status }, { getState, rejectWithValue }) => {
  try {
    return await BulkPhotoStatus(weddingIdFrom(getState), ids, status);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const deletePhoto = createAsyncThunk('photos/delete', async (id, { rejectWithValue }) => {
  try {
    return await DeletePhoto(id);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
