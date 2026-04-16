import liff from '@line/liff';

export const initializeLiff = async (liffId: string) => {
  try {
    await liff.init({ liffId });
    return liff;
  } catch (error) {
    console.error('LIFF initialization failed', error);
    throw error;
  }
};

export const getLiffProfile = async () => {
  if (!liff.isLoggedIn()) {
    throw new Error('User not logged in to LIFF');
  }
  return await liff.getProfile();
};

export const loginWithLiff = () => {
  // ダミーIDの場合はデモモードとして何もしない
  if (process.env.NEXT_PUBLIC_LINE_LIFF_ID === 'dummy_liff_id') {
    console.log('LIFF login disabled for demo mode');
    return;
  }

  if (!liff.isLoggedIn()) {
    liff.login();
  }
};

export const logoutFromLiff = () => {
  liff.logout();
};