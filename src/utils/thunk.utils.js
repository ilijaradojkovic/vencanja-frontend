/** Greška iz API-ja → payload za rejectWithValue (poruka za toast + status za 401 → odjava) */
export const toRejectValue = (error) => {
  // axios: odgovor servera je u error.response; bez njega zahtev nije ni stigao do BE
  if (error?.response) {
    return {
      message: error.response.data?.message || 'Greška na serveru',
      status: error.response.status,
    };
  }
  if (error?.code === 'ERR_NETWORK') return { message: 'Nema konekcije sa serverom', status: 0 };
  return { message: error?.message || 'Došlo je do greške', status: 0 };
};

export const weddingIdFrom = (getState) => {
  const id = getState().wedding.data?.id;
  if (!id) throw new Error('Venčanje nije učitano');
  return id;
};
