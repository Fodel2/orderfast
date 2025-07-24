import { render, screen } from '@testing-library/react';
import TestimonialsSection from '../components/TestimonialsSection';

describe('TestimonialsSection', () => {
  it('renders star icons for each rating', () => {
    render(<TestimonialsSection />);
    const stars = screen.getAllByTestId('star');
    expect(stars.length).toBe(18);
  });
});
