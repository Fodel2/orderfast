import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  ExclamationCircleIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import DashboardLayout from '@/components/DashboardLayout';
import { supabase } from '@/utils/supabaseClient';

type MessageStatus = 'new' | 'read' | 'resolved';
type MessageFilter = MessageStatus | 'all';

type ContactMessageRow = {
  id: string;
  restaurant_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const FILTERS: { label: string; value: MessageFilter }[] = [
  { label: 'New', value: 'new' },
  { label: 'Read', value: 'read' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'All', value: 'all' },
];

const normalizeStatus = (status: string | null | undefined): MessageStatus => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'read') return 'read';
  if (normalized === 'resolved') return 'resolved';
  return 'new';
};

const statusChipClasses: Record<MessageStatus, string> = {
  new: 'bg-teal-50 text-teal-700 ring-teal-200',
  read: 'bg-slate-100 text-slate-700 ring-slate-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

const formatDateTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const buildPreview = (body: string | null) => {
  const text = (body || '').trim();
  if (!text) return 'No message provided.';
  return text.length > 96 ? `${text.slice(0, 96)}…` : text;
};

export default function DashboardMessagesPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [activeFilter, setActiveFilter] = useState<MessageFilter>('new');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<MessageStatus | null>(null);

  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from('restaurant_users')
        .select('restaurant_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (membershipError || !membership?.restaurant_id) {
        setError('Unable to find your restaurant profile.');
        setLoading(false);
        return;
      }

      const scopedRestaurantId = membership.restaurant_id;
      setRestaurantId(scopedRestaurantId);

      const { data, error: messagesError } = await supabase
        .from('contact_messages')
        .select('id, restaurant_id, name, phone, email, message, status, created_at, updated_at')
        .eq('restaurant_id', scopedRestaurantId)
        .order('created_at', { ascending: false });

      if (messagesError) {
        setError(`Unable to load messages right now: ${messagesError.message}`);
        setLoading(false);
        return;
      }

      const rows = (data || []) as ContactMessageRow[];
      setMessages(rows);
      setSelectedMessageId(rows[0]?.id || null);
      setLoading(false);
    };

    loadMessages();
  }, [router]);

  const filteredMessages = useMemo(() => {
    if (activeFilter === 'all') return messages;
    return messages.filter((message) => normalizeStatus(message.status) === activeFilter);
  }, [messages, activeFilter]);

  const selectedMessage =
    messages.find((message) => message.id === selectedMessageId) || filteredMessages[0] || null;

  const setMessageStatus = async (nextStatus: MessageStatus) => {
    if (!selectedMessage || !restaurantId) return;

    setSavingStatus(nextStatus);
    setError(null);

    const { data, error: updateError } = await supabase
      .from('contact_messages')
      .update({ status: nextStatus })
      .eq('id', selectedMessage.id)
      .eq('restaurant_id', restaurantId)
      .select('id, restaurant_id, name, phone, email, message, status, created_at, updated_at')
      .single();

    if (updateError) {
      setError(`Unable to update message status: ${updateError.message}`);
      setSavingStatus(null);
      return;
    }

    const updatedRow = data as ContactMessageRow;
    setMessages((current) =>
      current.map((message) => (message.id === updatedRow.id ? updatedRow : message))
    );
    setSavingStatus(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Inbox</h1>
            <p className="mt-1 text-sm text-gray-500">
              View and manage incoming contact requests from your website.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow-sm">
            <FunnelIcon className="h-4 w-4" />
            {messages.length} total message{messages.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Message status filters">
          {FILTERS.map((filter) => {
            const active = activeFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveFilter(filter.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <ExclamationCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
                <EnvelopeIcon className="h-12 w-12 text-gray-300" />
                <h2 className="mt-4 text-lg font-semibold text-gray-900">No messages yet</h2>
                <p className="mt-2 max-w-sm text-sm text-gray-500">
                  New contact requests will appear here. Try switching filters if you expected to
                  see older activity.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredMessages.map((message) => {
                  const status = normalizeStatus(message.status);
                  const isSelected = selectedMessage?.id === message.id;
                  const isNew = status === 'new';

                  return (
                    <li key={message.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMessageId(message.id);
                          setIsModalOpen(true);
                        }}
                        className={`w-full px-4 py-4 text-left transition sm:px-5 ${
                          isSelected ? 'bg-teal-50/60' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  isNew ? 'text-gray-900' : 'text-gray-800'
                                }`}
                              >
                                {message.name?.trim() || 'No name'}
                              </p>
                              {isNew && <span className="h-2 w-2 rounded-full bg-teal-500" />}
                            </div>
                            <p className="truncate text-sm text-gray-500">
                              {buildPreview(message.message)}
                            </p>
                            <p className="text-xs text-gray-400">{formatDateTime(message.created_at)}</p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusChipClasses[status]}`}
                          >
                            {status[0].toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:block">
            {selectedMessage ? (
              <MessageDetail
                message={selectedMessage}
                savingStatus={savingStatus}
                onUpdateStatus={setMessageStatus}
              />
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <EnvelopeIcon className="h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm text-gray-500">Select a message to view details.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {isModalOpen && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-0 sm:items-center sm:justify-center sm:p-4 lg:hidden">
          <div className="max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white p-5 sm:max-w-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Message details</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close message details"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <MessageDetail
              message={selectedMessage}
              savingStatus={savingStatus}
              onUpdateStatus={setMessageStatus}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function MessageDetail({
  message,
  onUpdateStatus,
  savingStatus,
}: {
  message: ContactMessageRow;
  onUpdateStatus: (status: MessageStatus) => Promise<void>;
  savingStatus: MessageStatus | null;
}) {
  const status = normalizeStatus(message.status);
  const details = [
    { label: 'Name', value: message.name?.trim() || 'No name' },
    { label: 'Phone', value: message.phone?.trim() || 'Not provided' },
    { label: 'Email', value: message.email?.trim() || 'Not provided' },
    { label: 'Received', value: formatDateTime(message.created_at) },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">Contact submission</h3>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusChipClasses[status]}`}
          >
            {status[0].toUpperCase() + status.slice(1)}
          </span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="rounded-xl bg-gray-50 px-3 py-2">
              <dt className="text-xs uppercase tracking-wide text-gray-400">{item.label}</dt>
              <dd className="mt-1 break-words text-sm text-gray-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
          {(message.message || '').trim() || 'No message provided.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={savingStatus !== null || status === 'read'}
          onClick={() => onUpdateStatus('read')}
          className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircleIcon className="mr-2 h-4 w-4" />
          {savingStatus === 'read' ? 'Saving…' : 'Mark as read'}
        </button>
        <button
          type="button"
          disabled={savingStatus !== null || status === 'resolved'}
          onClick={() => onUpdateStatus('resolved')}
          className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircleIcon className="mr-2 h-4 w-4" />
          {savingStatus === 'resolved' ? 'Saving…' : 'Mark as resolved'}
        </button>
        {status === 'resolved' && (
          <button
            type="button"
            disabled={savingStatus !== null}
            onClick={() => onUpdateStatus('read')}
            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-300 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reopen as read
          </button>
        )}
      </div>
    </div>
  );
}
