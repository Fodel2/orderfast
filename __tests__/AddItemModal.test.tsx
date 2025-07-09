import { render, screen } from '@testing-library/react'
import AddItemModal from '../components/AddItemModal'

// Mock supabase client to avoid ESM import issues during tests
jest.mock('../utils/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(),
      update: jest.fn(),
      insert: jest.fn(),
      delete: jest.fn(),
      eq: jest.fn(),
      single: jest.fn(),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        getPublicUrl: jest.fn(() => ({ publicUrl: '' })),
      })),
    },
  },
}))

describe('AddItemModal', () => {
  const categories = [
    { id: 1, name: 'Breakfast' },
    { id: 2, name: 'Lunch' },
  ]

  it('renders when showModal is true', () => {
    render(
      <AddItemModal
        showModal={true}
        onClose={() => {}}
        onCreated={() => {}}
        categories={categories}
      />
    )
    expect(screen.getByText('Edit Item')).toBeInTheDocument()
  })

  it('does not render when showModal is false', () => {
    const { container } = render(
      <AddItemModal
        showModal={false}
        onClose={() => {}}
        onCreated={() => {}}
        categories={categories}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
