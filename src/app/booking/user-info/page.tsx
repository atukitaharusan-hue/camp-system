'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBookingDraftStore } from '@/stores/bookingDraftStore';
import { supabase } from '@/lib/supabase';

const POSTAL_CODE_REGEX = /^\d{3}-?\d{4}$/;

const GENDER_OPTIONS = ['男性', '女性', 'その他', '回答しない'] as const;

const REFERRAL_OPTIONS = ['検索エンジン', 'Instagram', 'X / Twitter', '紹介', 'チラシ', 'リピーター', 'その他'] as const;

type ZipCloudResponse = {
  results?: Array<{
    address1: string;
    address2: string;
    address3: string;
  }>;
  message?: string | null;
};

export default function BookingUserInfoPage() {
  const router = useRouter();

  const userInfo = useBookingDraftStore((s) => s.userInfo);
  const lineProfile = useBookingDraftStore((s) => s.lineProfile);
  const site = useBookingDraftStore((s) => s.site);
  const setUserInfo = useBookingDraftStore((s) => s.setUserInfo);

  const [gender, setGender] = useState(userInfo.gender ?? '');
  const [occupation, setOccupation] = useState(userInfo.occupation ?? '');
  const [phone, setPhone] = useState(userInfo.phone ?? '');
  const [email, setEmail] = useState(userInfo.email ?? '');
  const [postalCode, setPostalCode] = useState('');
  const [prefecture, setPrefecture] = useState('');
  const [city, setCity] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [referralSource, setReferralSource] = useState(userInfo.referralSource ?? '');
  const [loaded, setLoaded] = useState(false);
  const [postalMessage, setPostalMessage] = useState('');
  const [isLookingUpPostal, setIsLookingUpPostal] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (userInfo.phone || userInfo.email) {
      setLoaded(true);
      return;
    }

    const userId = lineProfile.userId;
    if (!userId) {
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from('guest_reservations')
        .select('user_gender, user_occupation, user_phone, user_email, user_address, user_referral_source, special_requests')
        .eq('user_identifier', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        if (data.user_gender) setGender(data.user_gender);
        if (data.user_occupation) setOccupation(data.user_occupation);
        if (data.user_phone) setPhone(data.user_phone);
        if (data.user_email) setEmail(data.user_email);
        if (data.user_referral_source) setReferralSource(data.user_referral_source);
        if (data.user_address) {
          setAddressLine(data.user_address);
        }
      }
      setLoaded(true);
    })();
  }, [lineProfile.userId, loaded, userInfo.phone, userInfo.email]);

  const isValid =
    gender !== '' &&
    phone.trim() !== '' &&
    email.trim() !== '' &&
    postalCode.trim() !== '' &&
    POSTAL_CODE_REGEX.test(postalCode) &&
    prefecture.trim() !== '' &&
    city.trim() !== '' &&
    addressLine.trim() !== '';

  const handlePostalLookup = useCallback(async () => {
    if (!POSTAL_CODE_REGEX.test(postalCode)) {
      setPostalMessage('郵便番号は 123-4567 形式で入力してください。');
      return;
    }

    setIsLookingUpPostal(true);
    setPostalMessage('');

    try {
      const zipcode = postalCode.replace('-', '');
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipcode}`);
      const data = (await response.json()) as ZipCloudResponse;
      const result = data.results?.[0];

      if (!result) {
        setPostalMessage(data.message || '該当する住所が見つかりませんでした。');
        return;
      }

      setPrefecture(result.address1);
      setCity(`${result.address2}${result.address3}`);
      setPostalMessage('住所を自動入力しました。');
    } catch {
      setPostalMessage('郵便番号から住所を取得できませんでした。');
    } finally {
      setIsLookingUpPostal(false);
    }
  }, [postalCode]);

  const handleNext = useCallback(() => {
    if (!isValid) return;
    setUserInfo({
      gender,
      occupation: occupation || null,
      phone: phone.trim(),
      email: email.trim(),
      address: `${prefecture}${city}${addressLine}${buildingName ? ` ${buildingName}` : ''}`,
      referralSource: referralSource || null,
    });
    router.push('/booking/terms-payment');
  }, [isValid, gender, occupation, phone, email, prefecture, city, addressLine, buildingName, referralSource, setUserInfo, router]);

  if (!site.siteId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-emerald-50/30 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-4 font-semibold text-gray-700">先にサイトを選択してください</p>
          <Link href="/booking/sites" className="inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            サイト選択に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-emerald-50/30 py-8 pb-28">
      <div className="container mx-auto max-w-2xl px-4">
        <div className="mb-10 text-center">
          <Link href="/booking/options" className="inline-block text-sm text-emerald-700 hover:text-emerald-800 transition-colors">
            オプション選択に戻る
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">お客様情報の入力</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 sm:text-base">予約確定に必要な情報を入力してください。</p>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="mb-3 block text-sm font-bold text-gray-800">性別 <span className="ml-1 text-xs text-red-500">必須</span></label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                    gender === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <InputSection label="電話番号" required>
            <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ''))} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </InputSection>

          <InputSection label="メールアドレス" required>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </InputSection>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="mb-3 block text-sm font-bold text-gray-800">郵便番号 <span className="ml-1 text-xs text-red-500">必須</span></label>
            <div className="flex gap-3">
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value.replace(/[^\d-]/g, ''))}
                placeholder="123-4567"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button type="button" onClick={handlePostalLookup} disabled={isLookingUpPostal} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-300">
                {isLookingUpPostal ? '検索中' : '住所検索'}
              </button>
            </div>
            {postalMessage && <p className="mt-2 text-xs text-gray-500">{postalMessage}</p>}
          </section>

          <div className="grid gap-6 sm:grid-cols-2">
            <InputSection label="都道府県" required>
              <input value={prefecture} onChange={(event) => setPrefecture(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </InputSection>
            <InputSection label="市区町村" required>
              <input value={city} onChange={(event) => setCity(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </InputSection>
          </div>

          <InputSection label="番地" required>
            <input value={addressLine} onChange={(event) => setAddressLine(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </InputSection>

          <InputSection label="建物名">
            <input value={buildingName} onChange={(event) => setBuildingName(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </InputSection>

          <InputSection label="職業">
            <input value={occupation} onChange={(event) => setOccupation(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
          </InputSection>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <label className="mb-3 block text-sm font-bold text-gray-800">きっかけ</label>
            <div className="flex flex-wrap gap-2">
              {REFERRAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setReferralSource(referralSource === option ? '' : option)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                    referralSource === option ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-sm safe-area-pb">
        <div className="mx-auto flex max-w-2xl gap-3">
          <Link href="/booking/options" className="flex-1 rounded-xl border border-gray-300 py-3 text-center text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50">
            戻る
          </Link>
          <button
            type="button"
            disabled={!isValid}
            onClick={handleNext}
            className={`flex-[2] rounded-xl py-3 text-center text-sm font-bold transition-all ${
              isValid ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-[0.98]' : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            確認画面へ進む
          </button>
        </div>
      </div>
    </div>
  );
}

function InputSection({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <label className="mb-3 block text-sm font-bold text-gray-800">
        {label} {required && <span className="ml-1 text-xs text-red-500">必須</span>}
      </label>
      {children}
    </section>
  );
}
