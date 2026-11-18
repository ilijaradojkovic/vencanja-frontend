import { combineReducers, configureStore, isRejectedWithValue } from '@reduxjs/toolkit';
import { commonSlice, showToast } from '../../features/common/store/common.store';
import { authSlice, logout } from '../../features/auth/store/auth.store';
import { weddingSlice } from '../../features/wedding/store/wedding.store';
import { guestsSlice } from '../../features/guests/store/guests.store';
import { photosSlice } from '../../features/photos/store/photos.store';
import { requestsSlice } from '../../features/requests/store/requests.store';
import { inviteSlice } from '../../features/invite/store/invite.store';

const appReducer = combineReducers({
  common: commonSlice.reducer,
  auth: authSlice.reducer,
  wedding: weddingSlice.reducer,
  guests: guestsSlice.reducer,
  photos: photosSlice.reducer,
  requests: requestsSlice.reducer,
  invite: inviteSlice.reducer,
});

// Akcije čije greške komponenta prikazuje sama (forma), pa ne treba i toast
const SILENT = ['auth/login/rejected', 'auth/restore/rejected', 'invite/fetch/rejected', 'invite/fetchWedding/rejected'];

/** Svaka API greška → toast; 401 → odjava */
const errorMiddleware = (api) => (next) => (action) => {
  if (isRejectedWithValue(action) && !SILENT.includes(action.type)) {
    if (action.payload?.status === 401) api.dispatch(logout());
    api.dispatch(showToast(action.payload?.message || 'Došlo je do greške', 'error'));
  }
  return next(action);
};

export const store = configureStore({
  reducer: appReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // FormData/File idu samo kroz argumente thunk-a, ne u state
      serializableCheck: { ignoredActionPaths: ['meta.arg.files', 'meta.arg'] },
    }).concat(errorMiddleware),
});
