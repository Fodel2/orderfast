import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import SettingsSectionSwitcher from '../../../components/dashboard/settings/SettingsSectionSwitcher';
import { supabase } from '../../../utils/supabaseClient';

type RestaurantDetailsSection = 'branding' | 'business' | 'copy' | 'socials';

type RestaurantDetailsRow = {
  id: string;
  logo_url: string | null;
  cover_image_url: string | null;
  website_title: string | null;
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  logo_shape: 'square' | 'round' | 'rectangular' | null;
  address: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county_state: string | null;
  postcode: string | null;
  country_code: string | null;
  contact_number: string | null;
  website_description: string | null;
  menu_description: string | null;
  currency_code: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
};

const SECTION_ITEMS: { key: RestaurantDetailsSection; label: string }[] = [
  { key: 'branding', label: 'Branding' },
  { key: 'business', label: 'Business Information' },
  { key: 'copy', label: 'Website Copy' },
  { key: 'socials', label: 'Socials' },
];

const DEFAULT_PRIMARY = '#0f766e';
const DEFAULT_SECONDARY = '#115e59';

const normalizeSocialUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const buildLegacyAddress = (parts: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  countyState: string;
  postcode: string;
  countryCode: string;
}) => {
  const line1 = parts.addressLine1.trim();
  const line2 = parts.addressLine2.trim();
  const locality = [parts.city.trim(), parts.countyState.trim(), parts.postcode.trim()]
    .filter(Boolean)
    .join(', ');
  const country = parts.countryCode.trim();
  return [line1, line2, locality, country].filter(Boolean).join('\n');
};

export default function DashboardSettingsRestaurantDetailsPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<RestaurantDetailsSection>('branding');
  const [toastMessage, setToastMessage] = useState('');

  const [logoUrl, setLogoUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [logoShape, setLogoShape] = useState<'square' | 'round' | 'rectangular'>('square');

  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [countyState, setCountyState] = useState('');
  const [postcode, setPostcode] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [currencyCode, setCurrencyCode] = useState('GBP');

  const [websiteDescription, setWebsiteDescription] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const [brandingSaving, setBrandingSaving] = useState(false);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [copySaving, setCopySaving] = useState(false);
  const [socialsSaving, setSocialsSaving] = useState(false);

  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membershipError || !membership?.restaurant_id) {
        setToastMessage('Unable to load restaurant context.');
        setLoading(false);
        return;
      }

      const nextRestaurantId = membership.restaurant_id;
      setRestaurantId(nextRestaurantId);

      const { data: row, error: rowError } = await supabase
        .from('restaurants')
        .select(
          'id,logo_url,cover_image_url,website_title,brand_primary_color,brand_secondary_color,logo_shape,address,address_line_1,address_line_2,city,county_state,postcode,country_code,contact_number,website_description,menu_description,currency_code,instagram_url,facebook_url,tiktok_url,x_url,youtube_url'
        )
        .eq('id', nextRestaurantId)
        .maybeSingle();

      if (rowError) {
        setToastMessage(`Failed to load settings: ${rowError.message}`);
        setLoading(false);
        return;
      }

      if (row) {
        const safeRow = row as RestaurantDetailsRow;
        setLogoUrl(safeRow.logo_url || '');
        setCoverImageUrl(safeRow.cover_image_url || '');
        setWebsiteTitle(safeRow.website_title || '');
        setPrimaryColor(safeRow.brand_primary_color || DEFAULT_PRIMARY);
        setSecondaryColor(safeRow.brand_secondary_color || DEFAULT_SECONDARY);
        setLogoShape(safeRow.logo_shape || 'square');
        setAddressLine1(safeRow.address_line_1 || '');
        setAddressLine2(safeRow.address_line_2 || '');
        setCity(safeRow.city || '');
        setCountyState(safeRow.county_state || '');
        setPostcode(safeRow.postcode || '');
        setCountryCode(safeRow.country_code || '');
        setContactNumber(safeRow.contact_number || '');
        setWebsiteDescription(safeRow.website_description || '');
        setMenuDescription(safeRow.menu_description || '');
        setCurrencyCode(safeRow.currency_code || 'GBP');
        setInstagramUrl(safeRow.instagram_url || '');
        setFacebookUrl(safeRow.facebook_url || '');
        setTiktokUrl(safeRow.tiktok_url || '');
        setXUrl(safeRow.x_url || '');
        setYoutubeUrl(safeRow.youtube_url || '');
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const canSaveBranding = useMemo(
    () => Boolean(restaurantId) && !brandingSaving && !logoUploading && !coverUploading,
    [brandingSaving, coverUploading, logoUploading, restaurantId]
  );

  const updateRestaurant = async (payload: Partial<RestaurantDetailsRow>, successMessage: string) => {
    if (!restaurantId) return;
    const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId);
    if (error) {
      setToastMessage(`Failed to save: ${error.message}`);
      return;
    }
    setToastMessage(successMessage);
  };

  const uploadImage = async (file: File, folder: 'logos' | 'cover-images') => {
    if (!restaurantId) return null;
    const extension = file.name.split('.').pop() || 'png';
    const path = `${folder}/${restaurantId}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true });
    if (uploadError) {
      setToastMessage(`Upload failed: ${uploadError.message}`);
      return null;
    }
    return supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
  };

  const onLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const uploaded = await uploadImage(file, 'logos');
    if (uploaded) {
      setLogoUrl(uploaded);
      setToastMessage('Logo uploaded. Save Branding to apply.');
    }
    setLogoUploading(false);
  };

  const onCoverFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    const uploaded = await uploadImage(file, 'cover-images');
    if (uploaded) {
      setCoverImageUrl(uploaded);
      setToastMessage('Cover uploaded. Save Branding to apply.');
    }
    setCoverUploading(false);
  };

  const saveBranding = async () => {
    setBrandingSaving(true);
    await updateRestaurant(
      {
        logo_url: logoUrl || null,
        cover_image_url: coverImageUrl || null,
        website_title: websiteTitle.trim() || null,
        brand_primary_color: primaryColor,
        brand_secondary_color: secondaryColor,
        logo_shape: logoShape,
      },
      'Branding saved.'
    );
    setBrandingSaving(false);
  };

  const saveBusiness = async () => {
    setBusinessSaving(true);
    const joinedAddress = buildLegacyAddress({
      addressLine1,
      addressLine2,
      city,
      countyState,
      postcode,
      countryCode,
    });
    await updateRestaurant(
      {
        address_line_1: addressLine1.trim() || null,
        address_line_2: addressLine2.trim() || null,
        city: city.trim() || null,
        county_state: countyState.trim() || null,
        postcode: postcode.trim() || null,
        country_code: countryCode.trim() || null,
        address: joinedAddress || null,
        contact_number: contactNumber.trim() || null,
        currency_code: currencyCode,
      },
      'Business information saved.'
    );
    setBusinessSaving(false);
  };

  const saveCopy = async () => {
    setCopySaving(true);
    await updateRestaurant(
      {
        website_description: websiteDescription.trim() || null,
        menu_description: menuDescription.trim() || null,
      },
      'Website copy saved.'
    );
    setCopySaving(false);
  };

  const saveSocials = async () => {
    setSocialsSaving(true);
    await updateRestaurant(
      {
        instagram_url: normalizeSocialUrl(instagramUrl),
        facebook_url: normalizeSocialUrl(facebookUrl),
        tiktok_url: normalizeSocialUrl(tiktokUrl),
        x_url: normalizeSocialUrl(xUrl),
        youtube_url: normalizeSocialUrl(youtubeUrl),
      },
      'Social links saved.'
    );
    setSocialsSaving(false);
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurantId) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-4">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
            We could not find your restaurant settings right now.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <h1 className="text-3xl font-bold">Restaurant Details</h1>
          <p className="text-sm text-gray-600">Manage branding, business info, website copy, and social links with reliable section-level saves.</p>
        </header>

        <SettingsSectionSwitcher
          label="Restaurant details sections"
          items={SECTION_ITEMS}
          value={activeSection}
          onChange={(next) => setActiveSection(next as RestaurantDetailsSection)}
        />

        {activeSection === 'branding' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Branding</h2>
                <p className="text-sm text-gray-500">Logo, cover, colors, shape and public title.</p>
              </div>
              <button
                type="button"
                onClick={saveBranding}
                disabled={!canSaveBranding}
                className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {brandingSaving ? 'Saving…' : 'Save Branding'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Website title</span>
                <input
                  value={websiteTitle}
                  onChange={(event) => setWebsiteTitle(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Logo shape</span>
                <select
                  value={logoShape}
                  onChange={(event) => setLogoShape(event.target.value as 'square' | 'round' | 'rectangular')}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                  <option value="rectangular">Rectangular</option>
                </select>
              </label>

              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">Logo</p>
                {logoUrl ? <img src={logoUrl} alt="Logo preview" className="mt-2 h-20 w-20 rounded-lg object-cover" /> : <p className="mt-2 text-xs text-gray-500">No logo yet.</p>}
                <input type="file" accept="image/*" onChange={onLogoFileChange} className="mt-3 block w-full text-xs" />
                {logoUploading ? <p className="mt-2 text-xs text-gray-500">Uploading logo…</p> : null}
              </div>

              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-medium text-gray-700">Cover image</p>
                {coverImageUrl ? <img src={coverImageUrl} alt="Cover preview" className="mt-2 h-24 w-full rounded-lg object-cover" /> : <p className="mt-2 text-xs text-gray-500">No cover yet.</p>}
                <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverFileChange} className="mt-3 block w-full text-xs" />
                {coverImageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl('');
                      if (coverInputRef.current) coverInputRef.current.value = '';
                    }}
                    className="mt-2 text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove cover
                  </button>
                ) : null}
                {coverUploading ? <p className="mt-2 text-xs text-gray-500">Uploading cover…</p> : null}
              </div>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Primary brand color</span>
                <input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="h-10 w-full rounded-xl border border-gray-300 p-1" />
              </label>

              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Secondary brand color</span>
                <input type="color" value={secondaryColor} onChange={(event) => setSecondaryColor(event.target.value)} className="h-10 w-full rounded-xl border border-gray-300 p-1" />
              </label>
            </div>
          </section>
        )}

        {activeSection === 'business' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Business Information</h2>
                <p className="text-sm text-gray-500">Address, phone and currency code.</p>
              </div>
              <button
                type="button"
                onClick={saveBusiness}
                disabled={!restaurantId || businessSaving}
                className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {businessSaving ? 'Saving…' : 'Save Business Info'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Address line 1</span>
                <input
                  value={addressLine1}
                  onChange={(event) => setAddressLine1(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Address line 2</span>
                <input
                  value={addressLine2}
                  onChange={(event) => setAddressLine2(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">City</span>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">County / State</span>
                <input
                  value={countyState}
                  onChange={(event) => setCountyState(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Postcode / ZIP</span>
                <input
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Country</span>
                <input
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Contact number</span>
                <input
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Currency</span>
                <select
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </label>
            </div>
          </section>
        )}

        {activeSection === 'copy' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Website Copy</h2>
                <p className="text-sm text-gray-500">Customer-facing text shown on homepage and menu.</p>
              </div>
              <button
                type="button"
                onClick={saveCopy}
                disabled={!restaurantId || copySaving}
                className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {copySaving ? 'Saving…' : 'Save Website Copy'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Website description</span>
                <textarea
                  value={websiteDescription}
                  onChange={(event) => setWebsiteDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Menu description</span>
                <textarea
                  value={menuDescription}
                  onChange={(event) => setMenuDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
          </section>
        )}

        {activeSection === 'socials' && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Socials</h2>
                <p className="text-sm text-gray-500">Optional links shown on the customer More page only when present.</p>
              </div>
              <button
                type="button"
                onClick={saveSocials}
                disabled={!restaurantId || socialsSaving}
                className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-teal-300"
              >
                {socialsSaving ? 'Saving…' : 'Save Socials'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Instagram URL</span>
                <input
                  value={instagramUrl}
                  onChange={(event) => setInstagramUrl(event.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">Facebook URL</span>
                <input
                  value={facebookUrl}
                  onChange={(event) => setFacebookUrl(event.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">TikTok URL</span>
                <input
                  value={tiktokUrl}
                  onChange={(event) => setTiktokUrl(event.target.value)}
                  placeholder="https://tiktok.com/@yourhandle"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm font-medium text-gray-700">X URL</span>
                <input
                  value={xUrl}
                  onChange={(event) => setXUrl(event.target.value)}
                  placeholder="https://x.com/yourhandle"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-sm font-medium text-gray-700">YouTube URL</span>
                <input
                  value={youtubeUrl}
                  onChange={(event) => setYoutubeUrl(event.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>
          </section>
        )}
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
