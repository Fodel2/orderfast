import { render, screen } from '@testing-library/react';
import TestimonialCarousel from '../components/TestimonialCarousel';

describe('TestimonialCarousel', () => {
  it('renders star icons for each rating', () => {
    render(<TestimonialCarousel />);
    const stars = screen.getAllByTestId('star');
    expect(stars.length).toBe(18);
  });
});
