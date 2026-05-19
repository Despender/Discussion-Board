import { render, screen } from '@testing-library/react';
import App from './App';

test('renders home title', () => {
  render(<App />);
  expect(screen.getByText(/Дошка дискусій/i)).toBeInTheDocument();
});
