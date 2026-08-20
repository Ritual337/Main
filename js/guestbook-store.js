(function (global) {
    'use strict';
  
    const GuestbookStore = {
      async getAll() {
        const res = await fetch('/api/guestbook');
        if (!res.ok) throw new Error('Failed to fetch entries');
        return res.json();
      },
  
      async add({ name, message }) {
        const res = await fetch('/api/guestbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, message }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to add entry');
        }
        return res.json();
      },
  
      async remove(id) {
        const sessionData = sessionStorage.getItem('ritual_admin_session_v1');
        const token = sessionData ? JSON.parse(sessionData).token : null;
        const res = await fetch(`/api/guestbook/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to delete entry');
        }
        return true;
      },
  
      async clear() {
        const sessionData = sessionStorage.getItem('ritual_admin_session_v1');
        const token = sessionData ? JSON.parse(sessionData).token : null;
        const res = await fetch('/api/guestbook', {
          method: 'DELETE',
          headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to clear entries');
        }
        return true;
      },
  
      async count() {
        const entries = await this.getAll();
        return entries.length;
      },
    };
  
    global.GuestbookStore = GuestbookStore;
  })(window);