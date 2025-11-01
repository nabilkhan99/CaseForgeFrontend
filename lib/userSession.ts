import { v4 as uuidv4 } from 'uuid';

export interface UserSession {
  sessionId: string;
  createdAt: string;
}

export const getUserSession = (): UserSession | null => {
  if (typeof window === 'undefined') return null;
  
  let sessionId = localStorage.getItem('user_session_id');
  let createdAt = localStorage.getItem('user_session_created');
  
  if (!sessionId) {
    sessionId = uuidv4();
    createdAt = new Date().toISOString();
    localStorage.setItem('user_session_id', sessionId);
    localStorage.setItem('user_session_created', createdAt);
  }
  
  return {
    sessionId: sessionId || '',
    createdAt: createdAt || new Date().toISOString(),
  };
};

export const clearUserSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user_session_id');
    localStorage.removeItem('user_session_created');
  }
};

