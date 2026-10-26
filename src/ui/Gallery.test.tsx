import { fireEvent, render, screen } from '@testing-library/react-native';

import { Gallery } from './Gallery';
import { palette } from './tokens';

describe('Gallery', () => {
  it('renders every component in both light and dark', async () => {
    await render(<Gallery />);
    expect(screen.getByTestId('gallery-light')).toHaveStyle({ backgroundColor: palette.light.background });
    expect(screen.getByTestId('gallery-dark')).toHaveStyle({ backgroundColor: palette.dark.background });
    // A sample of components from each sheet.
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.getAllByText('Pizza')).toHaveLength(2);
  });

  it('switches to a single scheme', async () => {
    await render(<Gallery />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));
    expect(screen.queryByTestId('gallery-light')).not.toBeOnTheScreen();
    expect(screen.getByTestId('gallery-dark')).toBeOnTheScreen();
  });

  it('demo interactions work (next phrase, celebrate)', async () => {
    await render(<Gallery initialScheme="light" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Next phrase' }));
    expect(screen.getByText('Hot air balloon')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Celebrate' }));
  });
});
