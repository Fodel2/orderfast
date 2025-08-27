export const toast = {
  success: (msg: string) => {
    if (typeof window !== 'undefined') {
      window.alert(msg);
    } else {
      console.log('toast success:', msg);
    }
  },
  error: (msg: string) => {
    if (typeof window !== 'undefined') {
      window.alert(msg);
    } else {
      console.error('toast error:', msg);
    }
  },
};
