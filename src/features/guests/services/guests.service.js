import { createAsyncThunk } from '@reduxjs/toolkit';
import { CreateGuest, DeleteGuest, GetGuests, ImportGuests, UpdateGuest } from '../api/guests.api';
import { toRejectValue, weddingIdFrom } from '../../../utils/thunk.utils';

export const fetchGuests = createAsyncThunk('guests/fetch', async (_, { getState, rejectWithValue }) => {
  try {
    return await GetGuests(weddingIdFrom(getState));
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const createGuest = createAsyncThunk('guests/create', async (guest, { getState, rejectWithValue }) => {
  try {
    return await CreateGuest(weddingIdFrom(getState), guest);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const importGuests = createAsyncThunk('guests/import', async (list, { getState, rejectWithValue }) => {
  try {
    return await ImportGuests(weddingIdFrom(getState), list);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const updateGuest = createAsyncThunk('guests/update', async ({ id, ...patch }, { rejectWithValue }) => {
  try {
    return await UpdateGuest(id, patch);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const deleteGuest = createAsyncThunk('guests/delete', async (id, { rejectWithValue }) => {
  try {
    return await DeleteGuest(id);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
