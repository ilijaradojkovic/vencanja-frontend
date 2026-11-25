import { createAsyncThunk } from '@reduxjs/toolkit';
import { SendPhotoNotifications } from '../api/notifications.api';
import { toRejectValue, weddingIdFrom } from '../../../utils/thunk.utils';

export const sendPhotoNotifications = createAsyncThunk('notifications/sendPhotos', async (_, { getState, rejectWithValue }) => {
  try {
    return await SendPhotoNotifications(weddingIdFrom(getState));
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});
