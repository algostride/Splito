/**
 * Transient success and failure messages.
 *
 * Nothing in the app confirmed a mutation before this. Deleting a bill, settling
 * up and accepting an invite all completed silently, so a user who was not
 * watching the right row had no way to tell it had worked.
 *
 * Failures are deliberately *not* duplicated here. Most are already surfaced in
 * place, next to the control that caused them -- inside the delete confirmation,
 * beside the settle form, under the invite form. A toast repeating a message
 * already on screen is noise. This carries the cases with nowhere else to go: a
 * create that has no form left to render into, and a success with nothing to
 * confirm it.
 *
 * Announcements come from the region in ToastRegion, not from here.
 */

import { createSlice, nanoid } from '@reduxjs/toolkit';

const DISMISS_AFTER_MS = 4000;
const MAX_VISIBLE = 3;

const toastSlice = createSlice({
    name: 'toast',
    initialState: { items: [] },
    reducers: {
        /**
         * @param payload {id: string, message: string, tone: 'pos'|'neg'}
         */
        notify(state, action) {
            state.items.push(action.payload);
            // Cap the stack: a burst of failures should not fill the screen,
            // and the oldest is the least relevant.
            if (state.items.length > MAX_VISIBLE) {
                state.items.splice(0, state.items.length - MAX_VISIBLE);
            }
        },
        dismiss(state, action) {
            state.items = state.items.filter((t) => t.id !== action.payload);
        },
        dismissAll(state) {
            state.items = [];
        },
    },
});

export const { dismiss, dismissAll } = toastSlice.actions;

/** Fire a toast and clear it after a delay. The id is made here so the same one
 *  can be handed to `dismiss`; generating it inside the reducer would mean the
 *  caller never learns which entry to remove. */
export const notify = (message, tone = 'pos') => (dispatch) => {
    const id = nanoid();
    dispatch(toastSlice.actions.notify({ id, message, tone }));
    setTimeout(() => dispatch(dismiss(id)), DISMISS_AFTER_MS);
    return id;
};

export default toastSlice.reducer;
