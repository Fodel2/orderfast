import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardLayout from '../../components/DashboardLayout';
import Toast from '../../components/Toast';
import { supabase } from '../../utils/supabaseClient';

export default function WebsitePage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [logo, setLogo] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [subdomain, setSubdomain] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [description, setDescription] = useState('');

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
          setSubdomain(rest.subdomain || '');
          setCustomDomain(rest.custom_domain || '');
          setAddress(rest.address || '');
          setContactNumber(rest.contact_number || '');
          setDescription(rest.website_description || '');
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await fileToDataUrl(file);
      setLogo(url);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await fileToDataUrl(file);
      setCover(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    if (subdomain && subdomainAvailable === false) {
      setToastMessage('Subdomain is not available');
      return;
    }
    const { error } = await supabase
      .from('restaurants')
      .update({
        logo_url: logo,
        cover_image_url: cover,
        subdomain,
        custom_domain: customDomain,
        address,
        contact_number: contactNumber,
        website_description: description,
      })
      .eq('id', restaurantId);
    if (error) {
      setToastMessage('Failed to save: ' + error.message);
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
                <img
                  src={cover}
                  alt="Cover"
                  className="h-32 w-full mb-2 object-cover"
                />
              )}
              <input type="file" accept="image/*" onChange={handleCoverChange} />
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
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </DashboardLayout>
  );
}
