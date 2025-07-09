import { render, screen } from '@testing-library/react'
import AddItemModal from '../components/AddItemModal'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'

jest.mock('../utils/supabaseClient', () => {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(async () => ({ data: [], error: null })),
    insert: jest.fn(() => chain),
    update: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(async () => ({ data: {}, error: null })),
  };
  return { supabase: { from: jest.fn(() => chain) } };
});

describe('AddItemModal', () => {
  it('renders when showModal is true', () => {
    render(
      <AddItemModal showModal={true} onClose={() => {}} restaurantId={1} />
    )
    expect(screen.getByText('Edit Item')).toBeInTheDocument()
  })

  it('does not render when showModal is false', () => {
    const { container } = render(
      <AddItemModal showModal={false} onClose={() => {}} restaurantId={1} />
    )
    expect(container.firstChild).toBeNull()
  })
})
