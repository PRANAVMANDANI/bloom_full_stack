import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CrisisDisclaimer from './CrisisDisclaimer';
import { CRISIS_RESOURCES } from '../utils/constants';

describe('CrisisDisclaimer', () => {
  it('renders the crisis disclaimer text as an alert', () => {
    render(<CrisisDisclaimer />);
    const alert = screen.getByRole('alert', { name: /crisis support information/i });
    expect(alert).toHaveTextContent(CRISIS_RESOURCES.disclaimer);
  });
});
