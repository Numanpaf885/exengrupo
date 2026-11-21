/** Row shapes of the fixed "exengrupo DB" tabs (row-1 headers are NEVER changed). */

export type UserRecord = {
  user_id: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login: string;
};

export type SpaceRecord = {
  space_id: string;
  name: string;
  join_code: string;
  channel_id: string;
  creator_id: string;
  created_at: string;
  deleted: string;
};

export type MemberRecord = {
  space_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  removed: string;
};

export type PostRecord = {
  post_id: string;
  space_id: string;
  user_id: string;
  photo_key: string;
  status: string;
  answer: string;
  models: string;
  created_at: string;
  photo_expires_at: string;
};

export const ROLE_CREATOR = 'creator';
export const ROLE_MEMBER = 'member';

export const POST_PROCESSING = 'processing';
export const POST_DONE = 'done';
export const POST_ERROR = 'error';
