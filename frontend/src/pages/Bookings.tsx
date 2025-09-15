import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import axios from '../services/axios';
import useAuthStore from '../store/authStore';
import { 
  CalendarDaysIcon, 
  PlusIcon, 
  TrashIcon,
  XMarkIcon,
  ClockIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';

interface Booking {
  id: number;
  name: string;
  phone: string;
  start_date: string;
  end_date: string;
  scope: string;
  status: string;
  created_at: string;
}

const Bookings = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingType, setBookingType] = useState<'single' | 'range'>('single');
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    purpose: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get('/bookings');
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // For single day bookings, ensure end_date equals start_date
      const submitData = {
        ...formData,
        end_date: bookingType === 'single' ? formData.start_date : formData.end_date
      };
      
      console.log('Submitting booking data:', submitData);
      await axios.post('/bookings', submitData);
      setIsModalOpen(false);
      setFormData({ start_date: '', end_date: '', purpose: '' });
      setBookingType('single');
      fetchBookings();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Error creating booking');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to cancel the booking for ${name}?`)) {
      try {
        await axios.delete(`/bookings/${id}`);
        fetchBookings();
      } catch (error: any) {
        alert(error.response?.data?.error || 'Error canceling booking');
      }
    }
  };

  const canDelete = (booking: Booking) => {
    return user?.role === 'admin' || booking.phone === user?.phone;
  };

  const getStatusBadge = (booking: Booking) => {
    const now = new Date();
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);

    if (booking.status === 'anulata') {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Anulată</span>;
    }
    if (now < start) {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Viitoare</span>;
    }
    if (now >= start && now <= end) {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Activă</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Încheiată</span>;
  };

  // Group bookings by month
  const groupedBookings = bookings.reduce((groups: { [key: string]: Booking[] }, booking) => {
    const month = format(new Date(booking.start_date), 'MMMM yyyy', { locale: ro });
    if (!groups[month]) {
      groups[month] = [];
    }
    groups[month].push(booking);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Van Bookings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage bookings for the church van
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => {
              setIsModalOpen(true);
              setFormData({ start_date: '', end_date: '', purpose: '' });
              setBookingType('single');
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            New Booking
          </button>
        </div>
      </div>

      {/* Bookings List */}
      {Object.keys(groupedBookings).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedBookings).map(([month, monthBookings]) => (
            <div key={month}>
              <h2 className="text-lg font-medium text-gray-900 mb-4 capitalize">{month}</h2>
              <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <ul className="divide-y divide-gray-200">
                  {monthBookings.map((booking) => (
                    <li key={booking.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <CalendarDaysIcon className="h-6 w-6 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{booking.name}</p>
                                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                  <div className="flex items-center">
                                    <ClockIcon className="mr-1 h-4 w-4" />
                                    {format(parseISO(booking.start_date), 'd MMM HH:mm', { locale: ro })} - 
                                    {format(parseISO(booking.end_date), 'd MMM HH:mm', { locale: ro })}
                                  </div>
                                  <div className="flex items-center">
                                    <PhoneIcon className="mr-1 h-4 w-4" />
                                    {booking.phone}
                                  </div>
                                </div>
                                {booking.scope && (
                                  <p className="mt-1 text-sm text-gray-600">{booking.scope}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(booking)}
                              {canDelete(booking) && (
                                <button
                                  onClick={() => handleDelete(booking.id, booking.name)}
                                  className="p-1 text-red-600 hover:text-red-800"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6 text-center">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start by creating a new booking for the van.
            </p>
            <div className="mt-6">
              <button
                onClick={() => {
                  setIsModalOpen(true);
                  setFormData({ start_date: '', end_date: '', purpose: '' });
                  setBookingType('single');
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="mr-2 h-5 w-5" />
                New Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      <Transition.Root show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setIsModalOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={() => setIsModalOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                      <CalendarDaysIcon className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        New Booking
                      </Dialog.Title>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {/* Booking Type Selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking type
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="single"
                            checked={bookingType === 'single'}
                            onChange={(e) => setBookingType(e.target.value as 'single' | 'range')}
                            className="mr-2"
                          />
                          <span className="text-sm">O zi</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="range"
                            checked={bookingType === 'range'}
                            onChange={(e) => setBookingType(e.target.value as 'single' | 'range')}
                            className="mr-2"
                          />
                          <span className="text-sm">Interval de zile</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                        {bookingType === 'single' ? 'Data și ora' : 'Data și ora început'}
                      </label>
                      <input
                        type="datetime-local"
                        id="start_date"
                        required
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>

                    {bookingType === 'range' && (
                      <div>
                        <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                          Data și ora sfârșit
                        </label>
                        <input
                          type="datetime-local"
                          id="end_date"
                          required={bookingType === 'range'}
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor="purpose" className="block text-sm font-medium text-gray-700">
                        Scopul călătoriei (opțional)
                      </label>
                      <textarea
                        id="purpose"
                        rows={3}
                        value={formData.purpose}
                        onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ex: Transport pentru tabără de tineret"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
                        {error}
                      </div>
                    )}

                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submitting ? 'Creating...' : 'Create Booking'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default Bookings;