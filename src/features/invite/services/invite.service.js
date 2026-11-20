import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { GetInvitation, GetPublicWedding, MarkInvitationOpened, SubmitRsvp, UploadPhotos } from '../api/invite.api';
import { toRejectValue } from '../../../utils/thunk.utils';

export const uploadProgress = createAction('invite/uploadProgress');

export const fetchInvitation = createAsyncThunk('invite/fetch', async (token, { rejectWithValue }) => {
  try {
    const response = await GetInvitation(token);
    MarkInvitationOpened(token).catch(() => {});
    return response;
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const fetchPublicWedding = createAsyncThunk('invite/fetchWedding', async (slug, { rejectWithValue }) => {
  try {
    return { guest: null, wedding: await GetPublicWedding(slug) };
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const submitRsvp = createAsyncThunk('invite/rsvp', async ({ token, ...payload }, { rejectWithValue }) => {
  try {
    return await SubmitRsvp(token, payload);
  } catch (error) {
    return rejectWithValue(toRejectValue(error));
  }
});

export const uploadPhotos = createAsyncThunk(
  'invite/upload',
  async ({ token, slug, files, category, senderName, message }, { dispatch, rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('category', category);
      formData.append('senderName', senderName || '');
      formData.append('message', message || '');
      return await UploadPhotos({ token, slug }, formData, (pct) => dispatch(uploadProgress(pct)));
    } catch (error) {
      return rejectWithValue(toRejectValue(error));
    }
  },
);
