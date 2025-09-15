import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../../components/DashboardLayout';
import Toast from '../../../components/Toast';
import CustomPagesSection from '../../../components/CustomPagesSection';
import SlidesManager from '../../../components/SlidesManager';
import SlideModal from '../../../components/SlideModal';
import type { SlideRow } from '../../../components/customer/home/SlidesContainer';
import { supabase } from '../../../utils/supabaseClient';

export default function WebsitePage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [menuDescription, setMenuDescription] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [description, setDescription] = useState('');
  const [brandPrimary, setBrandPrimary] = useState('#008080');
  const [brandSecondary, setBrandSecondary] = useState('#004c4c');
  const [logoShape, setLogoShape] = useState<'square' | 'round' | 'rectangular'>('square');
  const [colorExtracted, setColorExtracted] = useState(false);

  const [contactEnabled, setContactEnabled] = useState(true);
  const [contactEmail, setContactEmail] = useState('');
  const [contactFields, setContactFields] = useState<{ name: boolean; phone: boolean; message: boolean }>({
    name: true,
    phone: false,
    message: true,
  });

  const [editingSlide, setEditingSlide] = useState<SlideRow | null>(null);
  const [refreshSlides, setRefreshSlides] = useState(0);

  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: ru } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (ru?.restaurant_id) {
        setRestaurantId(ru.restaurant_id);
        const { data: rest } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', ru.restaurant_id)
          .single();
        if (rest) {
          setLogo(rest.logo_url || null);
          setCover(rest.cover_image_url || null);
          setWebsiteTitle(rest.website_title || '');
          setMenuDescription(rest.menu_description || '');
          setSubdomain(rest.subdomain || '');
          setCustomDomain(rest.custom_domain || '');
          setAddress(rest.address || '');
          setContactNumber(rest.contact_number || '');
          setDescription(rest.website_description || '');
          setBrandPrimary(rest.brand_primary_color || '#008080');
          setBrandSecondary(rest.brand_secondary_color || '#004c4c');
          setLogoShape(rest.logo_shape || 'square');
          setColorExtracted(!!rest.brand_color_extracted);
        }
        const { data: contact } = await supabase
          .from('website_contact_settings')
          .select('*')
          .eq('restaurant_id', ru.restaurant_id)
          .maybeSingle();
        if (contact) {
          setContactEnabled(contact.enabled);
          setContactEmail(contact.recipient_email || '');
          setContactFields(contact.fields || { name: true, phone: false, message: true });
        }
      }
      setLoading(false);
    };
    load();
  }, [router]);

  useEffect(() => {
    if (!subdomain) {
      setSubdomainAvailable(null);
      return;
    }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id')
        .eq('subdomain', subdomain)
        .maybeSingle();
      if (!error) {
        if (!data || data.id === restaurantId) {
          setSubdomainAvailable(true);
        } else {
          setSubdomainAvailable(false);
        }
      }
    }, 500);
    return () => clearTimeout(t);
  }, [subdomain, restaurantId]);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject('failed');
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
        if (!ctx) return resolve('#000000');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);
        resolve('#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join(''));
      };
    });
  };

  function handleEditSlide(row: SlideRow) {
    setEditingSlide(row);
  }

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await fileToDataUrl(file);
      setLogo(url);
      const col = await extractDominantColor(file);
      setBrandPrimary(col);
      setColorExtracted(true);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCover(URL.createObjectURL(file));
      setCoverFile(file);
    }
  };

  const handleRemoveCover = (e: React.MouseEvent) => {
    e.preventDefault();
    setCover(null);
    setCoverFile(null);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    if (subdomain && subdomainAvailable === false) {
      setToastMessage('Subdomain is not available');
      return;
    }
    let finalCover = cover;
    if (coverFile && cover && cover.startsWith('blob:')) {
      const path = `cover-images/${restaurantId}-${Date.now()}-${coverFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(path, coverFile, { upsert: true });
      if (uploadError) {
        setToastMessage('Failed to upload cover: ' + uploadError.message);
        return;
      }
      finalCover = supabase.storage
        .from('menu-images')
        .getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase
      .from('restaurants')
      .update({
        logo_url: logo,
        cover_image_url: finalCover,
        website_title: websiteTitle,
        menu_description: menuDescription,
        logo_shape: logoShape,
        brand_primary_color: brandPrimary,
        brand_secondary_color: brandSecondary,
        brand_color_extracted: colorExtracted,
        subdomain,
        custom_domain: customDomain,
        address,
        contact_number: contactNumber,
        website_description: description,
      })
      .eq('id', restaurantId);
    const { error: contactErr } = await supabase
      .from('website_contact_settings')
      .upsert(
        {
          restaurant_id: restaurantId,
          enabled: contactEnabled,
          recipient_email: contactEmail,
          fields: contactFields,
        },
        { onConflict: 'restaurant_id' }
      );
    if (error || contactErr) {
      setToastMessage('Failed to save: ' + (error?.message || contactErr?.message));
    } else {
      setToastMessage('Website settings saved');
    }
  };

  if (loading) return <DashboardLayout>Loading...</DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Website Settings</h1>
        <div className="bg-white p-6 rounded-lg shadow">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block font-semibold mb-1">Logo</label>
              {logo && (
                <img src={logo} alt="Logo" className="h-20 mb-2 object-contain" />
              )}
              <input type="file" accept="image/*" onChange={handleLogoChange} />
            </div>
            <div>
              <label className="block font-semibold mb-1">Cover Image</label>
              {cover && (
                <div className="mb-2">
                  <img
                    src={cover}
                    alt="Cover"
                    className="h-32 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveCover}
                    className="mt-1 text-sm text-red-600 underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
              />
            </div>
            <div>
              <label className="block font-semibold">Website Title</label>
              <input
                type="text"
                value={websiteTitle}
                onChange={(e) => setWebsiteTitle(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label className="block font-semibold">Subdomain</label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
              {subdomain && subdomainAvailable === false && (
                <p className="text-red-600 text-sm mt-1">Not available</p>
              )}
              {subdomain && subdomainAvailable === true && (
                <p className="text-green-600 text-sm mt-1">Available</p>
              )}
            </div>
            <div>
              <label className="block font-semibold">Custom Domain</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block font-semibold">Primary Color</label>
                <input
                  type="color"
                  value={brandPrimary}
                  onChange={(e) => {
                    setBrandPrimary(e.target.value);
                    setColorExtracted(false);
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="block font-semibold">Secondary Color</label>
                <input
                  type="color"
                  value={brandSecondary}
                  onChange={(e) => setBrandSecondary(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold">Logo Shape</label>
              <select
                value={logoShape}
                onChange={(e) => setLogoShape(e.target.value as any)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              >
                <option value="square">Square</option>
                <option value="round">Round</option>
                <option value="rectangular">Rectangular</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label className="block font-semibold">Contact Number</label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label className="block font-semibold">Website Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div>
              <label className="block font-semibold">Menu Description</label>
              <textarea
                value={menuDescription}
                onChange={(e) => setMenuDescription(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded p-2"
              />
            </div>
            <div className="border-t pt-4 mt-4">
              <h2 className="text-xl font-semibold mb-2">Contact Form</h2>
              <label className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={contactEnabled}
                  onChange={(e) => setContactEnabled(e.target.checked)}
                />
                <span>Enable contact form</span>
              </label>
              {contactEnabled && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold">Recipient Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded p-2"
                    />
                  </div>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.name}
                        onChange={(e) => setContactFields({ ...contactFields, name: e.target.checked })}
                      />
                      <span>Name</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.phone}
                        onChange={(e) => setContactFields({ ...contactFields, phone: e.target.checked })}
                      />
                      <span>Phone</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={contactFields.message}
                        onChange={(e) => setContactFields({ ...contactFields, message: e.target.checked })}
                      />
                      <span>Message</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <div className="text-right">
              <button
                type="submit"
                className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
      {restaurantId && (
        <>
          <SlidesManager restaurantId={restaurantId} onEdit={handleEditSlide} refreshKey={refreshSlides} />
          {editingSlide && (
            <SlideModal
              slide={editingSlide}
              cfg={editingSlide.config_json}
              onClose={() => setEditingSlide(null)}
              onSave={() => {
                setEditingSlide(null);
                setRefreshSlides((k) => k + 1);
              }}
            />
          )}
        </>
      )}
      {restaurantId && <CustomPagesSection restaurantId={restaurantId} />}
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
