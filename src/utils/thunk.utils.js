import i18n from '../app/config/i18n';

export const toRejectValue = (error) => {
  if (error?.response) {
    return {
      message: error.response.data?.message || i18n.t('common:errors.server'),
      status: error.response.status,
    };
  }
  if (error?.code === 'ERR_NETWORK') return { message: i18n.t('common:errors.network'), status: 0 };
  return { message: error?.message || i18n.t('common:errors.generic'), status: 0 };
};

export const weddingIdFrom = (getState) => {
  const id = getState().wedding.data?.id;
  if (!id) throw new Error(i18n.t('common:errors.weddingNotLoaded'));
  return id;
};
