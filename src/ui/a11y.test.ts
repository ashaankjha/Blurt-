import { ariaProps } from './a11y';

describe('ariaProps', () => {
  it('mirrors accessibilityState and accessibilityValue into aria-* (react-native-web reads only those)', () => {
    expect(
      ariaProps({ checked: true, selected: false, disabled: true }, { min: 1, max: 30, now: 7, text: '7' }),
    ).toEqual({
      'aria-checked': true,
      'aria-selected': false,
      'aria-disabled': true,
      'aria-valuemin': 1,
      'aria-valuemax': 30,
      'aria-valuenow': 7,
      'aria-valuetext': '7',
    });
  });

  it('omits what is not set, so it never overrides RN defaults', () => {
    expect(ariaProps(undefined, undefined)).toEqual({});
    expect(ariaProps({ checked: 'mixed' })).toEqual({ 'aria-checked': 'mixed' });
    expect(ariaProps({ checked: null as unknown as boolean })).toEqual({});
  });
});
