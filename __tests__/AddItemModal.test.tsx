import { render, screen } from '@testing-library/react'
import AddItemModal from '../components/AddItemModal'

describe('AddItemModal', () => {
  it('renders when showModal is true', () => {
    render(<AddItemModal showModal={true} onClose={() => {}} />)
    expect(screen.getByText('Edit Item')).toBeInTheDocument()
  })

  it('does not render when showModal is false', () => {
    const { container } = render(<AddItemModal showModal={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})
