import { createAsyncThunk } from '@reduxjs/toolkit';
import { GetCurrentWedding, UpdateWedding } from '../api/wedding.api';
import { toRejectValue, weddingIdFrom } from '../../../utils/thunk.utils';

export const fetchWedding = createAsyncThunk('wedding/fetch', async (_, { rejectWithValue }) => {
  try {
    return await GetCurrentWedding();
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const updateWedding = createAsyncThunk('wedding/update', async (patch, { getState, rejectWithValue }) => {
  try {
    return await UpdateWedding(weddingIdFrom(getState), patch);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
