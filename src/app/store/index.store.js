import { combineReducers, configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import { authSlice, logout } from '../../features/auth/store/auth.store';
import { weddingSlice } from '../../features/wedding/store/wedding.store';
import { guestsSlice } from '../../features/guests/store/guests.store';
import { photosSlice } from '../../features/photos/store/photos.store';
import { requestsSlice } from '../../features/requests/store/requests.store';
import { inviteSlice } from '../../features/invite/store/invite.store';

const appReducer = combineReducers({
  auth: authSlice.reducer,
  wedding: weddingSlice.reducer,
  guests: guestsSlice.reducer,
  photos: photosSlice.reducer,
  requests: requestsSlice.reducer,
  invite: inviteSlice.reducer,
});

const SILENT = ['auth/login/rejected', 'auth/restore/rejected', 'invite/fetch/rejected', 'invite/fetchWedding/rejected'];

const errorMiddleware = (api) => (next) => (action) => {
  if (isRejectedWithValue(action) && !SILENT.includes(action.type)) {
    if (action.payload?.status === 401) api.dispatch(logout());
    toast.error(action.payload?.message || 'Došlo je do greške');
  }
  return next(action);
};

export const store = configureStore({
  reducer: appReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActionPaths: ['meta.arg.files', 'meta.arg'] },
    }).concat(errorMiddleware),
});
