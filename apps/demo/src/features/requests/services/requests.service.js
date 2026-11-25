import { createAsyncThunk } from '@reduxjs/toolkit';
import { CreateDesignRequest, GetDesignRequests } from '../api/requests.api';
import { toRejectValue, weddingIdFrom } from '../../../utils/thunk.utils';

export const fetchRequests = createAsyncThunk('requests/fetch', async (_, { getState, rejectWithValue }) => {
  try {
    return await GetDesignRequests(weddingIdFrom(getState));
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const createRequest = createAsyncThunk('requests/create', async (payload, { getState, rejectWithValue }) => {
  try {
    return await CreateDesignRequest(weddingIdFrom(getState), payload);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
