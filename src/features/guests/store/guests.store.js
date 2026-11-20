import { createEntityAdapter, createSelector, createSlice } from '@reduxjs/toolkit';
import { createGuest, deleteGuest, fetchGuests, importGuests, updateGuest } from '../services/guests.service';
import { logout } from '../../auth/store/auth.store';
import { RsvpStatus } from '../../../app/config/enums';
import { sendPhotoNotifications } from '../../notifications/services/notifications.service';

const adapter = createEntityAdapter({ sortComparer: (a, b) => a.name.localeCompare(b.name, 'sr') });
const initialState = adapter.getInitialState({ status: 'idle', saving: false });

export const guestsSlice = createSlice({
  name: 'guests',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGuests.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchGuests.fulfilled, (state, action) => {
        state.status = 'succeeded';
        adapter.setAll(state, action.payload);
      })
      .addCase(fetchGuests.rejected, (state) => {
        state.status = 'failed';
      })
      .addCase(createGuest.fulfilled, (state, action) => adapter.addOne(state, action.payload))
      .addCase(importGuests.fulfilled, (state, action) => adapter.addMany(state, action.payload))
      .addCase(updateGuest.fulfilled, (state, action) => adapter.upsertOne(state, action.payload))
      .addCase(deleteGuest.fulfilled, (state, action) => adapter.removeOne(state, action.payload.id))
      .addCase(sendPhotoNotifications.fulfilled, (state, action) => {
        action.payload.guestIds.forEach((id) => {
          const g = state.entities[id];
          if (g?.photoNotify) g.photoNotify.sentAt = action.payload.sentAt;
        });
      })
      .addCase(logout, () => initialState)
      .addMatcher(
        (action) => /^guests\/(create|import|update|delete)\/pending$/.test(action.type),
        (state) => {
          state.saving = true;
        },
      )
      .addMatcher(
        (action) => /^guests\/(create|import|update|delete)\/(fulfilled|rejected)$/.test(action.type),
        (state) => {
          state.saving = false;
        },
      );
  },
});

export const guestsSelectors = adapter.getSelectors((state) => state.guests);

export const selectGuestStats = createSelector(guestsSelectors.selectAll, (guests) => {
  const st = { households: guests.length, invitedPeople: 0, comingPeople: 0, waiting: 0, declined: 0, opened: 0 };
  guests.forEach((g) => {
    st.invitedPeople += g.maxPersons;
    if (g.rsvp.status === RsvpStatus.YES) st.comingPeople += g.rsvp.persons;
    if (g.rsvp.status === RsvpStatus.PENDING) st.waiting += 1;
    if (g.rsvp.status === RsvpStatus.NO) st.declined += 1;
    if (g.openedAt) st.opened += 1;
  });
  return st;
});
