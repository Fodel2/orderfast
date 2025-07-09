import { render, screen } from '@testing-library/react'
import AddItemModal from '../components/AddItemModal'

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
        categories={categories}
      />
    )
    expect(container.firstChild).toBeNull()
  })
})
