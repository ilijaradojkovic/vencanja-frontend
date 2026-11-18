import { axiosInstance } from '../../../app/config/api';

/** Javni endpointi – bez prijave, gost se identifikuje tokenom iz linka */

export async function GetInvitation(token) {
  const response = await axiosInstance.get(`/public/invitations/${token}`);
  return response.data;
}

export async function MarkInvitationOpened(token) {
  const response = await axiosInstance.post(`/public/invitations/${token}/opened`);
  return response.data;
}

export async function SubmitRsvp(token, payload) {
  const response = await axiosInstance.post(`/public/invitations/${token}/rsvp`, payload);
  return response.data;
}

export async function GetPublicWedding(slug) {
  const response = await axiosInstance.get(`/public/weddings/${slug}`);
  return response.data;
}

/**
 * @param {{token?: string, slug?: string}} target  lični link gosta ili opšti (QR) link venčanja
 * @param {FormData} formData  files[], category, senderName, message
 * @param {(percent: number) => void} [onProgress]  napredak upload-a 0–100
 */
export async function UploadPhotos(target, formData, onProgress) {
  const url = target.token ? `/public/invitations/${target.token}/photos` : `/public/weddings/${target.slug}/photos`;
  const response = await axiosInstance.post(url, formData, {
    // bez ovoga axios bi FormData pretvorio u JSON (instanca podrazumeva application/json)
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / (e.total || e.loaded || 1)) * 100)),
  });
  return response.data;
}
