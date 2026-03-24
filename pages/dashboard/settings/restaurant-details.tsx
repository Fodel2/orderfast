import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import ResponsiveSectionNav, {
  type SectionItem,
} from '../../../components/dashboard/settings/ResponsiveSectionNav';
import { supabase } from '../../../utils/supabaseClient';

const SECTION_ITEMS = [
  { key: 'branding', label: 'Branding' },
  { key: 'business-info', label: 'Business Information' },
  { key: 'website-copy', label: 'Website Copy' },
] as const satisfies readonly SectionItem[];

type DetailsSection = (typeof SECTION_ITEMS)[number]['key'];

const isValidSection = (value: string): value is DetailsSection =>
  SECTION_ITEMS.some((item) => item.key === value);

type LogoShape = 'square' | 'round' | 'rectangular';

export default function DashboardSettingsRestaurantDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [activeSection, setActiveSection] = useState<DetailsSection>('branding');

  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [websiteTitle, setWebsiteTitle] = useState('');
  const [brandPrimary, setBrandPrimary] = useState('#008080');
  const [brandSecondary, setBrandSecondary] = useState('#004c4c');
  const [logoShape, setLogoShape] = useState<LogoShape>('square');
  const [colorExtracted, setColorExtracted] = useState(false);

  const [currencyCode, setCurrencyCode] = useState('GBP');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [websiteDescription, setWebsiteDescription] = useState('');
  const [menuDescription, setMenuDescription] = useState('');

  const [savingSection, setSavingSection] = useState<DetailsSection | null>(null);

  useEffect(() => {
    const querySection = String(router.query.section || '').toLowerCase();
    if (querySection && isValidSection(querySection)) {
      setActiveSection(querySection);
    }
  }, [router.query.section]);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      setRestaurantId(membership.restaurant_id);
      const { data: rest } = await supabase
        .from('restaurants')
        .select(
          'logo_url,cover_image_url,website_title,brand_primary_color,brand_secondary_color,logo_shape,brand_color_extracted,currency_code,address,contact_number,website_description,menu_description'
        )
        .eq('id', membership.restaurant_id)
        .maybeSingle();

      if (rest) {
        setLogo(rest.logo_url || null);
        setCover(rest.cover_image_url || null);
        setWebsiteTitle(rest.website_title || '');
        setBrandPrimary(rest.brand_primary_color || '#008080');
        setBrandSecondary(rest.brand_secondary_color || '#004c4c');
        setLogoShape((rest.logo_shape as LogoShape) || 'square');
        setColorExtracted(!!rest.brand_color_extracted);
        setCurrencyCode(rest.currency_code || 'GBP');
        setAddress(rest.address || '');
        setContactNumber(rest.contact_number || '');
        setWebsiteDescription(rest.website_description || '');
        setMenuDescription(rest.menu_description || '');
      }

      setLoading(false);
    };

    load();
  }, [router]);

  const setSection = (next: string) => {
    if (!isValidSection(next)) return;
    setActiveSection(next);
    router.replace(
      {
        pathname: '/dashboard/settings/restaurant-details',
        query: { section: next },
      },
      undefined,
      { shallow: true }
    );
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  };

  const extractDominantColor = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('#000000');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve(`#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`);
      };
      img.onerror = () => resolve('#000000');
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await fileToDataUrl(file);
    setLogo(url);
    const col = await extractDominantColor(file);
    setBrandPrimary(col);
    setColorExtracted(true);
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCover(URL.createObjectURL(file));
    setCoverFile(file);
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.preventDefault();
    setCover(null);
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const persist = useCallback(
    async (payload: Record<string, unknown>, section: DetailsSection) => {
      if (!restaurantId) return;
      setSavingSection(section);
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId);
      setSavingSection(null);

      if (error) {
        setToastMessage(`Failed to save ${SECTION_ITEMS.find((s) => s.key === section)?.label?.toLowerCase()}: ${error.message}`);
      } else {
        setToastMessage(`${SECTION_ITEMS.find((s) => s.key === section)?.label} saved.`);
      }
    },
    [restaurantId]
  );

  const saveBranding = async () => {
    if (!restaurantId) return;

    let finalCover = cover;
    if (coverFile && cover && cover.startsWith('blob:')) {
      const path = `cover-images/${restaurantId}-${Date.now()}-${coverFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(path, coverFile, { upsert: true });

      if (uploadError) {
        setToastMessage(`Failed to upload cover: ${uploadError.message}`);
        return;
      }

      finalCover = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
      setCoverFile(null);
    }

    await persist(
      {
        logo_url: logo,
        cover_image_url: finalCover,
        website_title: websiteTitle,
        brand_primary_color: brandPrimary,
        brand_secondary_color: brandSecondary,
        logo_shape: logoShape,
        brand_color_extracted: colorExtracted,
      },
      'branding'
    );
  };

  const saveBusinessInfo = async () => {
    await persist(
      {
        address,
        contact_number: contactNumber,
        currency_code: currencyCode,
      },
      'business-info'
    );
  };

  const saveWebsiteCopy = async () => {
    await persist(
      {
        website_description: websiteDescription,
        menu_description: menuDescription,
      },
      'website-copy'
    );
  };

  const saveHandlerBySection = useMemo(
    () => ({
      branding: saveBranding,
      'business-info': saveBusinessInfo,
      'website-copy': saveWebsiteCopy,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      logo,
      cover,
      coverFile,
      websiteTitle,
      brandPrimary,
      brandSecondary,
      logoShape,
      colorExtracted,
      address,
      contactNumber,
      currencyCode,
      websiteDescription,
      menuDescription,
      restaurantId,
    ]
  );

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  if (!restaurantId) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-4">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Back to Settings
          </Link>
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">
            We could not find your restaurant settings right now.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <Link href="/dashboard/settings" className="text-sm text-teal-700 hover:underline">
            ← Settings Home
          </Link>
          <h1 className="text-3xl font-bold">Restaurant Details</h1>
          <p className="text-sm text-gray-600">
            Manage branding, business information and website copy used across customer experiences.
          </p>
        </div>

        <div className="space-y-4">
          <ResponsiveSectionNav
            items={SECTION_ITEMS as unknown as SectionItem[]}
            value={activeSection}
            onChange={setSection}
            ariaLabel="Restaurant details sections"
          />

          {activeSection === 'branding' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Branding</h2>
                  <p className="text-sm text-gray-500">Logo, cover, colors and public display name.</p>
                </div>
                <button
                  onClick={() => void saveHandlerBySection.branding()}
                  disabled={savingSection === 'branding'}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
                >
                  {savingSection === 'branding' ? 'Saving…' : 'Save Branding'}
                </button>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Logo</label>
                    {logo ? <img src={logo} alt="Logo" className="h-20 mb-2 rounded object-contain" /> : null}
                    <input type="file" accept="image/*" onChange={handleLogoChange} className="block w-full text-sm" />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1">Cover Image</label>
                    {cover ? (
                      <div className="mb-2">
                        <img src={cover} alt="Cover" className="h-32 w-full rounded object-cover" />
                        <button type="button" onClick={handleRemoveCover} className="mt-1 text-sm text-red-600 underline">
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="block w-full text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900">Public Display Name</label>
                    <input
                      type="text"
                      value={websiteTitle}
                      onChange={(e) => setWebsiteTitle(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Uses the current website_title field. Existing consumers continue to fallback to restaurant name.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900">Primary Color</label>
                      <input
                        type="color"
                        value={brandPrimary}
                        onChange={(e) => {
                          setBrandPrimary(e.target.value);
                          setColorExtracted(false);
                        }}
                        className="mt-1 h-10 w-full rounded border border-gray-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900">Secondary Color</label>
                      <input
                        type="color"
                        value={brandSecondary}
                        onChange={(e) => setBrandSecondary(e.target.value)}
                        className="mt-1 h-10 w-full rounded border border-gray-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900">Logo Shape</label>
                    <select
                      value={logoShape}
                      onChange={(e) => setLogoShape(e.target.value as LogoShape)}
                      className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                    >
                      <option value="square">Square</option>
                      <option value="round">Round</option>
                      <option value="rectangular">Rectangular</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'business-info' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Business Information</h2>
                  <p className="text-sm text-gray-500">Core contact and commercial details.</p>
                </div>
                <button
                  onClick={() => void saveHandlerBySection['business-info']()}
                  disabled={savingSection === 'business-info'}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
                >
                  {savingSection === 'business-info' ? 'Saving…' : 'Save Business Info'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Contact Number</label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Currency</label>
                  <select
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'website-copy' && (
            <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Website Copy</h2>
                  <p className="text-sm text-gray-500">Customer-facing descriptive copy used on public surfaces.</p>
                </div>
                <button
                  onClick={() => void saveHandlerBySection['website-copy']()}
                  disabled={savingSection === 'website-copy'}
                  className="px-3 py-2 bg-teal-600 text-white rounded-lg disabled:opacity-60"
                >
                  {savingSection === 'website-copy' ? 'Saving…' : 'Save Website Copy'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Website Description</label>
                  <textarea
                    value={websiteDescription}
                    onChange={(e) => setWebsiteDescription(e.target.value)}
                    rows={4}
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Menu Description</label>
                  <textarea
                    value={menuDescription}
                    onChange={(e) => setMenuDescription(e.target.value)}
                    rows={4}
                    className="mt-1 w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
