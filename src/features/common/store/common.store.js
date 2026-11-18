import { createSlice, nanoid } from '@reduxjs/toolkit';

/** Zajedničko UI stanje (toast poruke) */
export const commonSlice = createSlice({
  name: 'common',
  initialState: { toasts: [] },
  reducers: {
    showToast: {
      reducer(state, action) {
        state.toasts.push(action.payload);
      },
      prepare: (message, type = 'success') => ({ payload: { id: nanoid(), message, type } }),
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { showToast, dismissToast } = commonSlice.actions;
