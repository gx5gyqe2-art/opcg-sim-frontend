let currentSessionId: string = sessionStorage.getItem('opcg_session_id') || 'unknown';

export const sessionManager = {
  setSessionId: (id: string) => {
    currentSessionId = id;
    sessionStorage.setItem('opcg_session_id', id);
  },

  getSessionId: () => {
    if (currentSessionId === 'unknown') {
      const newId = crypto.randomUUID();
      sessionManager.setSessionId(newId);
    }
    return currentSessionId;
  }
};
