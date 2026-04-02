import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  username?: string;
  name?: string;
  role?: 'admin' | 'student';
}

export const sessionOptions: SessionOptions = {
  password: 'mentimeter-super-secret-key-32chars-min!!',
  cookieName: 'mentimeter-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
  },
};
