/**
 * Cached reads for the spaces screens: a screen first shows what it showed last
 * time (instant), then refreshes. Touching a space in the list starts loading
 * it before the finger lifts.
 */
import { memo } from '@/lib/memo';
import type { PostView } from '@/lib/photo/upload';
import type { Person } from '@/lib/spaces/people';
import { type SpaceDetail, type SpaceSummary, spacesApi } from './api';

export const keys = {
  spaces: 'spaces',
  canCreate: 'spaces:canCreate',
  people: 'people',
  space: (id: string) => `space:${id}`,
  posts: (id: string) => `posts:${id}`,
};

export const cachedSpaces = () => memo.get<SpaceSummary[]>(keys.spaces);
/** May this user create spaces? (last answer from the server; false until known). */
export const cachedCanCreate = () => memo.get<boolean>(keys.canCreate) ?? false;
export const cachedPeople = () => memo.get<Person[]>(keys.people);
export const cachedSpace = (id: string) =>
  memo.get<SpaceDetail>(keys.space(id)) ?? cachedSpaces()?.find((s) => s.space_id === id);
export const cachedPosts = (id: string) => memo.get<PostView[]>(keys.posts(id));

export async function loadSpaces(token: string) {
  const res = await memo.dedupe(keys.spaces, () => spacesApi.list(token));
  if (res.ok) {
    memo.set(keys.spaces, res.data.spaces);
    memo.set(keys.canCreate, res.data.can_create === true);
  }
  return res;
}

export async function loadSpace(token: string, id: string) {
  const res = await memo.dedupe(keys.space(id), () => spacesApi.get(token, id));
  if (res.ok) memo.set(keys.space(id), res.data.space);
  return res;
}

export async function loadPosts(token: string, id: string) {
  const res = await memo.dedupe(keys.posts(id), () => spacesApi.posts(token, id));
  if (res.ok) memo.set(keys.posts(id), res.data.posts);
  return res;
}

export async function loadPeople(token: string) {
  const res = await memo.dedupe(keys.people, () => spacesApi.people(token));
  if (res.ok) memo.set(keys.people, res.data.people);
  return res;
}

export const rememberPosts = (id: string, posts: PostView[]) => memo.set(keys.posts(id), posts);

/** Start loading a space (detail + feed) early, e.g. on touch-down. */
export function prefetchSpace(token: string, id: string): void {
  void loadSpace(token, id);
  void loadPosts(token, id);
}
