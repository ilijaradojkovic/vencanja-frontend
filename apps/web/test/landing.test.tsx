import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import LandingPage from '../app/page';

describe('landing page', () => {
  it('renders the product name and the Serbian tagline', () => {
    render(<LandingPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Uspomena' })).toBeInTheDocument();
    expect(screen.getByText('Digitalne pozivnice i album venčanja.')).toBeInTheDocument();
  });
});
