import { useEffect, useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from '../services/axios';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore, differenceInDays, startOfDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import VersionButton from '../components/VersionButton';
import {
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
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

interface User {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: string;
  created_at: string;
}

interface MaintenanceItem {
  id: number;
  type: string;
  expiry_date: string;
  status: string;
  notes?: string;
}

interface AccessLogEntry {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  role: string;
  timestamp: string;
  ip: string;
  device?: string;
  browser?: string;
  device_model?: string;
  user_agent?: string;
}

interface Issue {
  id: number;
  name: string;
  phone: string;
  description: string;
  status: string;
  created_at: string;
}

const MainApp = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'bookings' | 'history' | 'documents' | 'issues'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateRange, setSelectedDateRange] = useState<{start: Date | null, end: Date | null}>({
    start: null,
    end: null
  });
  
  // Add booking modal
  const [showAddBooking, setShowAddBooking] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    start_date: '',
    end_date: '',
    scope: ''
  });
  
  // Checkout calendar modal
  const [showCheckoutCalendar, setShowCheckoutCalendar] = useState(false);
  const [checkoutMonth, setCheckoutMonth] = useState(new Date());

  // Add user modal (admin only)
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'driver'
  });

  // Users modal (admin only)
  const [showUsers, setShowUsers] = useState(false);
  // Access Log modal (admin only)
  const [showAccessLog, setShowAccessLog] = useState(false);
  const [accessLogs, setAccessLogs] = useState<AccessLogEntry[]>([]);
  // Drivers modal (for drivers role)
  const [showDrivers, setShowDrivers] = useState(false);

  // Add issue modal
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [issueForm, setIssueForm] = useState({
    description: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'bookings':
        case 'history':
          const bookingsRes = await axios.get('/bookings');
          setBookings(bookingsRes.data);
          break;
        case 'documents':
          const maintenanceRes = await axios.get('/maintenance/status');
          setMaintenance(maintenanceRes.data);
          break;
        case 'issues':
          const issuesRes = await axios.get('/issues');
          setIssues(issuesRes.data);
          break;
      }
      
      if ((user?.role === 'admin' || user?.role === 'driver') && users.length === 0) {
        const usersRes = await axios.get('/users');
        setUsers(usersRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isDateInPast = (date: Date) => {
    // Allow current day and future days, only block previous days
    const today = startOfDay(new Date());
    const checkDate = startOfDay(date);
    return isBefore(checkDate, today);
  };

  // Split bookings into active and history
  const activeBookings = bookings
    .filter(b => {
      const endDate = new Date(b.end_date);
      return !isDateInPast(endDate) && b.status !== 'cancelled';
    })
    .sort((a, b) => {
      // Sort by start_date ascending (closest dates first)
      const dateA = new Date(a.start_date);
      const dateB = new Date(b.start_date);
      return dateA.getTime() - dateB.getTime();
    });

  const historyBookings = bookings
    .filter(b => {
      const endDate = new Date(b.end_date);
      return isDateInPast(endDate) || b.status === 'cancelled';
    })
    .sort((a, b) => {
      // Sort by end_date descending (most recent dates first)
      const dateA = new Date(a.end_date);
      const dateB = new Date(b.end_date);
      return dateB.getTime() - dateA.getTime();
    });

  // Document update modal state  
  const [showUpdateDocument, setShowUpdateDocument] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<MaintenanceItem | null>(null);
  const [documentForm, setDocumentForm] = useState({
    type: '',
    expiry_date: '',
    notes: ''
  });

  // Filter documents from maintenance
  const documents = maintenance.filter(m => 
    ['ITP', 'RCA', 'Rovigneta', 'CASCO', 'Licenta Transport'].includes(m.type)
  );


  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    // Add empty cells for days before the first day of the month
    const startDayOfWeek = (start.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0 format
    const emptyDays = Array(startDayOfWeek).fill(null);
    
    return [...emptyDays, ...days];
  };

  const isDateBooked = (date: Date) => {
    return bookings.some(booking => {
      if (booking.status === 'cancelled') return false;
      const startDate = new Date(booking.start_date);
      const endDate = new Date(booking.end_date);
      return (isSameDay(date, startDate) || isSameDay(date, endDate) ||
        (isAfter(date, startDate) && isBefore(date, endDate)));
    });
  };

  const handleDateClick = (date: Date) => {
    if (isDateBooked(date) || isDateInPast(date)) return;
    
    // Select check-in date and go to booking form
    setSelectedDateRange({ start: date, end: null });
    setBookingForm({
      ...bookingForm,
      start_date: format(date, 'yyyy-MM-dd'),
      end_date: '' // Will be selected in the booking form
    });
    setShowCalendar(false);
    setShowAddBooking(true);
  };

  const handleCheckoutDateClick = (date: Date) => {
    if (isDateBooked(date) || isDateInPast(date)) return;
    
    const checkInDate = new Date(bookingForm.start_date);
    if (isBefore(date, checkInDate) && !isSameDay(date, checkInDate)) {
      alert('Data de sfârșit nu poate fi înainte de data de început!');
      return;
    }
    
    // Check if there are any bookings between start and end dates
    const daysInRange = eachDayOfInterval({ start: checkInDate, end: date });
    const hasBookedDay = daysInRange.some(day => isDateBooked(day));
    
    if (hasBookedDay) {
      alert('There are already booked days in the selected period!');
      return;
    }
    
    setSelectedDateRange({ start: checkInDate, end: date });
    setBookingForm({
      ...bookingForm,
      end_date: format(date, 'yyyy-MM-dd')
    });
    setShowCheckoutCalendar(false);
  };

  const handleAddBooking = async () => {
    try {
      await axios.post('/bookings', {
        start_date: bookingForm.start_date,
        end_date: bookingForm.end_date,
        purpose: bookingForm.scope,
        name: user?.name,
        phone: user?.phone
      });
      setShowAddBooking(false);
      setBookingForm({ start_date: '', end_date: '', scope: '' });
      setSelectedDateRange({ start: null, end: null });
      loadData();
    } catch (error) {
      console.error('Error adding booking:', error);
    }
  };

  const handleDeleteBooking = async (id: number) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      try {
        await axios.delete(`/bookings/${id}`);
        loadData();
      } catch (error) {
        console.error('Error deleting booking:', error);
      }
    }
  };

  const handleAddUser = async () => {
    try {
      const formattedPhone = userForm.phone.startsWith('+40') 
        ? userForm.phone 
        : userForm.phone.startsWith('0') 
          ? `+40${userForm.phone.slice(1)}`
          : `+40${userForm.phone}`;

      await axios.post('/users', {
        ...userForm,
        phone: formattedPhone
      });
      
      setShowAddUser(false);
      setUserForm({ name: '', phone: '', email: '', role: 'driver' });
      loadData();
    } catch (error) {
      console.error('Error adding user:', error);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (confirm('Sigur vrei să ștergi acest utilizator?')) {
      try {
        await axios.delete(`/users/${id}`);
        const usersRes = await axios.get('/users');
        setUsers(usersRes.data);
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const loadAccessLogs = async () => {
    try {
      const response = await axios.get('/admin/access-logs');
      setAccessLogs(response.data.logs);
    } catch (error) {
      console.error('Error loading access logs:', error);
      alert('Eroare la încărcarea jurnalului de acces');
    }
  };

  const handleAddIssue = async () => {
    try {
      await axios.post('/issues', {
        title: 'Problemă raportată de utilizator',
        description: issueForm.description,
        severity: 'medium',
        location: 'nespecificat'
      });
      setShowAddIssue(false);
      setIssueForm({ description: '' });
      loadData();
    } catch (error) {
      console.error('Error adding issue:', error);
    }
  };

  const handleResolveIssue = async (id: number) => {
    try {
      await axios.patch(`/issues/${id}`, { status: 'resolved' });
      loadData();
    } catch (error) {
      console.error('Error resolving issue:', error);
    }
  };

  const handleReopenIssue = async (id: number) => {
    try {
      await axios.patch(`/issues/${id}`, { status: 'reported' });
      loadData();
    } catch (error) {
      console.error('Error reopening issue:', error);
    }
  };

  const handleDeleteIssue = async (id: number) => {
    if (confirm('Sigur vrei să ștergi această problemă?')) {
      try {
        await axios.delete(`/issues/${id}`);
        loadData();
      } catch (error) {
        console.error('Error deleting issue:', error);
        alert('Nu s-a putut șterge problema.');
      }
    }
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;
    
    try {
      await axios.patch(`/maintenance/update`, {
        id: selectedDocument.id,
        ...documentForm
      });
      setShowUpdateDocument(false);
      setSelectedDocument(null);
      setDocumentForm({ type: '', expiry_date: '', notes: '' });
      loadData();
    } catch (error) {
      console.error('Error updating document:', error);
    }
  };

  const getStatusColor = (item: MaintenanceItem) => {
    const expiryDate = new Date(item.expiry_date);
    const daysUntilExpiry = differenceInDays(expiryDate, new Date());
    
    if (daysUntilExpiry < 0) return 'bg-red-100 text-red-700 border-red-300';
    if (daysUntilExpiry <= 30) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  const getDaysUntilExpiry = (date: string) => {
    const days = differenceInDays(new Date(date), new Date());
    if (days < 0) return `Expirat de ${Math.abs(days)} zile`;
    if (days === 0) return 'Expiră azi';
    if (days === 1) return 'Expiră mâine';
    return `Expiră în ${days} zile`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-3xl mr-3">🚐</span>
              <div>
                <h1 className="text-xl font-bold">Church Van Booking</h1>
                <p className="text-xs text-indigo-100">Nicolina Church</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm text-indigo-100">
              Bună, {user?.name}!
            </span>
            {user?.role === 'admin' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowUsers(true)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Utilizatori
                </button>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  + Utilizator
                </button>
                <button
                  onClick={() => {
                    setShowAccessLog(true);
                    loadAccessLogs();
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Access Log
                </button>
              </div>
            )}
            {user?.role === 'driver' && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowDrivers(true)}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                >
                  Șoferi
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Action Button */}
      <div className="px-4 py-4 bg-gray-50">
        <button
          onClick={() => setShowCalendar(true)}
          className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 shadow-lg transition-all transform hover:scale-[1.02]"
        >
          <CalendarDaysIcon className="h-6 w-6 mr-2" />
          <span className="text-lg font-semibold">Book Van</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 shadow-sm overflow-x-auto scrollbar-hide">
        <div className="flex min-w-full px-2 py-2 space-x-1">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-shrink-0 px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'bookings'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="block text-lg mb-0.5">📅</span>
            <span>Bookings</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-shrink-0 px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="block text-lg mb-0.5">📋</span>
            <span>Istoric</span>
          </button>
          {/* Vehicle tab hidden for future feature */}
          {/* <button
            onClick={() => setActiveTab('vehicle')}
            className={`flex-shrink-0 px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'vehicle'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="block text-lg mb-0.5">🔧</span>
            <span>Vehicul</span>
          </button> */}
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-shrink-0 px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'documents'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="block text-lg mb-0.5">📄</span>
            <span>Documente</span>
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`flex-shrink-0 px-3 py-2.5 rounded-lg font-medium text-xs transition-all ${
              activeTab === 'issues'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="block text-lg mb-0.5">⚠️</span>
            <span>Probleme</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {/* Active Bookings */}
            {activeTab === 'bookings' && (
              <div className="space-y-3">
                {activeBookings.length > 0 ? (
                  activeBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{booking.name}</h3>
                        {(user?.role === 'admin' || user?.phone === booking.phone) && (
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <CalendarDaysIcon className="h-4 w-4 mr-2 text-gray-400" />
                          {format(new Date(booking.start_date), 'dd MMM', { locale: ro })} - 
                          {format(new Date(booking.end_date), 'dd MMM yyyy', { locale: ro })}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                          Booked on {format(new Date(booking.created_at), 'dd MMM yyyy', { locale: enUS })}
                        </div>
                        <div className="mt-2 pt-2 border-t text-gray-700">
                          <span className="font-medium">Scop:</span> {booking.scope}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active bookings
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                {historyBookings.length > 0 ? (
                  historyBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 opacity-75">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-gray-900">{booking.name}</h3>
                        {booking.status === 'cancelled' && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            Anulat
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center">
                          <CalendarDaysIcon className="h-4 w-4 mr-2 text-gray-400" />
                          {format(new Date(booking.start_date), 'dd MMM', { locale: ro })} - 
                          {format(new Date(booking.end_date), 'dd MMM yyyy', { locale: ro })}
                        </div>
                        <div className="mt-2 text-gray-700">
                          <span className="font-medium">Scop:</span> {booking.scope}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No bookings in history
                  </div>
                )}
              </div>
            )}

            {/* Vehicle Status - Hidden for future feature */}
            {/* {activeTab === 'vehicle' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <TruckIcon className="h-5 w-5 mr-2 text-indigo-600" />
                    Mentenanță Vehicul
                  </h3>
                  {vehicleMaintenance.length > 0 ? (
                    <div className="space-y-3">
                      {vehicleMaintenance.map((item) => (
                        <div key={item.id} className={`p-4 rounded-lg border-2 ${getStatusColor(item)}`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="font-medium text-base">{item.type}</span>
                              <p className="text-sm mt-1">{getDaysUntilExpiry(item.expiry_date)}</p>
                              {item.notes && (
                                <p className="text-sm mt-2 opacity-75">{item.notes}</p>
                              )}
                            </div>
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => {
                                  setSelectedDocument(item);
                                  setDocumentForm({
                                    type: item.type,
                                    expiry_date: format(new Date(item.expiry_date), 'yyyy-MM-dd'),
                                    notes: item.notes || ''
                                  });
                                  setShowUpdateDocument(true);
                                }}
                                className="ml-3 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Nu există date de mentenanță</p>
                  )}
                </div>
              </div>
            )} */}

            {/* Documents */}
            {activeTab === 'documents' && (
              <div className="space-y-3">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Documente Auto
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className={`p-4 rounded-lg border-2 ${getStatusColor(doc)}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-base">{doc.type}</p>
                            <p className="text-sm mt-1">
                              Expiră: {format(new Date(doc.expiry_date), 'dd MMMM yyyy', { locale: ro })}
                            </p>
                            <p className="text-sm font-medium mt-2">{getDaysUntilExpiry(doc.expiry_date)}</p>
                            {doc.notes && (
                              <p className="text-sm mt-2 opacity-75">{doc.notes}</p>
                            )}
                          </div>
                          <div className="flex items-start space-x-2">
                            {doc.status === 'valid' ? (
                              <CheckCircleIcon className="h-6 w-6 text-green-500" />
                            ) : (
                              <XCircleIcon className="h-6 w-6 text-red-500" />
                            )}
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => {
                                  setSelectedDocument(doc);
                                  setDocumentForm({
                                    type: doc.type,
                                    expiry_date: format(new Date(doc.expiry_date), 'yyyy-MM-dd'),
                                    notes: doc.notes || ''
                                  });
                                  setShowUpdateDocument(true);
                                }}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Issues */}
            {activeTab === 'issues' && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowAddIssue(true)}
                  className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl hover:from-red-700 hover:to-orange-700 shadow-lg transition-all"
                >
                  <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                  Raportează Problemă
                </button>

                {issues.length > 0 ? (
                  issues.map((issue) => (
                    <div key={issue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-900">{issue.name}</h4>
                          <p className="text-xs text-gray-500">
                            {format(new Date(issue.created_at), 'dd MMM yyyy HH:mm', { locale: ro })}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            issue.status === 'resolved' 
                              ? 'bg-green-100 text-green-700' 
                              : issue.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {issue.status === 'resolved' 
                              ? 'Rezolvat' 
                              : issue.status === 'in_progress'
                                ? 'În progres'
                                : 'Raportat'}
                          </span>
                          {user?.role === 'admin' && (
                            <div className="flex items-center space-x-1">
                              {issue.status === 'reported' || issue.status === 'in_progress' ? (
                                <button
                                  onClick={() => handleResolveIssue(issue.id)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Marchează ca rezolvat"
                                >
                                  <CheckCircleIcon className="h-5 w-5" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReopenIssue(issue.id)}
                                  className="text-yellow-600 hover:text-yellow-800"
                                  title="Redeschide problema"
                                >
                                  <ExclamationTriangleIcon className="h-5 w-5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteIssue(issue.id)}
                                className="text-red-500 hover:text-red-700"
                                title="Șterge problema"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{issue.description}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Nu există probleme raportate
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Calendar Modal */}
      <Transition appear show={showCalendar} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCalendar(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                    Selectează perioada
                  </Dialog.Title>
                  
                  <div className="flex justify-between items-center mb-4">
                    <button
                      onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <h4 className="text-base font-semibold">
                      {format(currentMonth, 'MMMM yyyy', { locale: ro })}
                    </h4>
                    <button
                      onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(day => (
                      <div key={day} className="text-center font-medium text-gray-500 py-1">
                        {day}
                      </div>
                    ))}
                    {getDaysInMonth().map((day, idx) => {
                      // Handle empty cells for calendar alignment
                      if (day === null) {
                        return <div key={idx} className="p-2"></div>;
                      }
                      
                      const isBooked = isDateBooked(day);
                      const isPastDate = isDateInPast(day);
                      const isSelected = selectedDateRange.start && 
                        (isSameDay(day, selectedDateRange.start) || 
                         (selectedDateRange.end && isSameDay(day, selectedDateRange.end)) ||
                         (selectedDateRange.end && isAfter(day, selectedDateRange.start) && isBefore(day, selectedDateRange.end)));
                      
                      return (
                        <button
                          key={idx}
                          onClick={() => !isBooked && !isPastDate && handleDateClick(day)}
                          disabled={isBooked || isPastDate}
                          className={`p-2 text-sm rounded ${
                            isBooked 
                              ? 'bg-red-100 text-red-400 cursor-not-allowed' 
                              : isPastDate
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-indigo-500 text-white'
                                  : 'hover:bg-gray-100'
                          }`}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <div className="flex items-center mb-1">
                      <div className="w-4 h-4 bg-red-100 rounded mr-2"></div>
                      <span>Booked days</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-100 rounded mr-2"></div>
                      <span>Zile trecute</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setShowCalendar(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Închide
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add Booking Modal */}
      <Transition appear show={showAddBooking} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddBooking(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                    Confirm booking
                  </Dialog.Title>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">De la data:</p>
                      <p className="font-medium mb-2">
                        {bookingForm.start_date && format(new Date(bookingForm.start_date), 'dd MMMM yyyy', { locale: ro })}
                      </p>
                      
                      <div className="border-t pt-2">
                        <p className="text-sm text-gray-600">Până la data:</p>
                        {bookingForm.end_date ? (
                          <p className="font-medium">
                            {format(new Date(bookingForm.end_date), 'dd MMMM yyyy', { locale: ro })}
                          </p>
                        ) : (
                          <button
                            onClick={() => {
                              setCheckoutMonth(new Date(bookingForm.start_date));
                              setShowCheckoutCalendar(true);
                            }}
                            className="mt-1 w-full px-3 py-2 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 text-sm"
                          >
                            Selectează data de sfârșit
                          </button>
                        )}
                        {bookingForm.end_date && (
                          <button
                            onClick={() => {
                              setCheckoutMonth(new Date(bookingForm.start_date));
                              setShowCheckoutCalendar(true);
                            }}
                            className="mt-1 text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Schimbă data
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Booking purpose
                      </label>
                      <textarea
                        value={bookingForm.scope}
                        onChange={(e) => setBookingForm({...bookingForm, scope: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Ex: Transport pentru evanghelizare în Pașcani"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => setShowAddBooking(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddBooking}
                      disabled={!bookingForm.scope || !bookingForm.end_date}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirmă
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add Issue Modal */}
      <Transition appear show={showAddIssue} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddIssue(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                    Raportează o problemă
                  </Dialog.Title>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrierea problemei
                    </label>
                    <textarea
                      value={issueForm.description}
                      onChange={(e) => setIssueForm({...issueForm, description: e.target.value})}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                      placeholder="Ex: Zgomot ciudat la frânare, pierdere lichid sub mașină, etc."
                    />
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <button
                      onClick={() => setShowAddIssue(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddIssue}
                      disabled={!issueForm.description}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Raportează
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Add User Modal (Admin only) */}
      {user?.role === 'admin' && (
        <Transition appear show={showAddUser} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowAddUser(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                      Adaugă utilizator nou
                    </Dialog.Title>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nume complet
                        </label>
                        <input
                          type="text"
                          value={userForm.name}
                          onChange={(e) => setUserForm({...userForm, name: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Număr telefon
                        </label>
                        <input
                          type="tel"
                          value={userForm.phone}
                          onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                          placeholder="0721234567"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email (opțional)
                        </label>
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Rol
                        </label>
                        <select
                          value={userForm.role}
                          onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="driver">Șofer</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => setShowAddUser(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddUser}
                        disabled={!userForm.name || !userForm.phone}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Adaugă
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Drivers List Modal (Driver role only) */}
      {user?.role === 'driver' && (
        <Transition appear show={showDrivers} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowDrivers(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                      Șoferi
                    </Dialog.Title>
                    
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {users.map((u) => (
                        <div key={u.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="font-medium text-gray-900">{u.name}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setShowDrivers(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                      >
                        Închide
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Users List Modal (Admin only) */}
      {user?.role === 'admin' && (
        <Transition appear show={showUsers} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowUsers(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                      Utilizatori înregistrați
                    </Dialog.Title>
                    
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {users.map((u) => (
                        <div key={u.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{u.name}</p>
                              <div className="mt-1 text-sm text-gray-600">
                                <div className="flex items-center">
                                  <PhoneIcon className="h-3 w-3 mr-1" />
                                  {u.phone}
                                </div>
                                {u.email && (
                                  <div className="flex items-center mt-1">
                                    <EnvelopeIcon className="h-3 w-3 mr-1" />
                                    {u.email}
                                  </div>
                                )}
                              </div>
                              <span className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                                u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {u.role === 'admin' ? 'Administrator' : 'Șofer'}
                              </span>
                            </div>
                            {u.id !== user.id && (
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setShowUsers(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                      >
                        Închide
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Update Document Modal (Admin only) */}
      {user?.role === 'admin' && (
        <Transition appear show={showUpdateDocument} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowUpdateDocument(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                      Actualizează {selectedDocument?.type}
                    </Dialog.Title>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data expirării
                        </label>
                        <input
                          type="date"
                          value={documentForm.expiry_date}
                          onChange={(e) => setDocumentForm({...documentForm, expiry_date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Note (opțional)
                        </label>
                        <textarea
                          value={documentForm.notes}
                          onChange={(e) => setDocumentForm({...documentForm, notes: e.target.value})}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Ex: Plătit online, Valabil în toată UE, etc."
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-3">
                      <button
                        onClick={() => setShowUpdateDocument(false)}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdateDocument}
                        disabled={!documentForm.expiry_date}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Actualizează
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Checkout Calendar Modal */}
      <Transition appear show={showCheckoutCalendar} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCheckoutCalendar(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                    Selectează data de sfârșit
                  </Dialog.Title>
                  
                  <div className="bg-blue-50 p-3 rounded-lg mb-4">
                    <p className="text-sm text-blue-700">
                      De la data: <span className="font-medium">{bookingForm.start_date && format(new Date(bookingForm.start_date), 'dd MMMM yyyy', { locale: ro })}</span>
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <button
                      onClick={() => setCheckoutMonth(addDays(checkoutMonth, -30))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <h4 className="text-base font-semibold">
                      {format(checkoutMonth, 'MMMM yyyy', { locale: ro })}
                    </h4>
                    <button
                      onClick={() => setCheckoutMonth(addDays(checkoutMonth, 30))}
                      className="p-2 hover:bg-gray-100 rounded"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(day => (
                      <div key={day} className="text-center font-medium text-gray-500 py-1">
                        {day}
                      </div>
                    ))}
                    {(() => {
                      const start = startOfMonth(checkoutMonth);
                      const end = endOfMonth(checkoutMonth);
                      const days = eachDayOfInterval({ start, end });
                      const startDayOfWeek = (start.getDay() + 6) % 7;
                      const emptyDays = Array(startDayOfWeek).fill(null);
                      const allDays = [...emptyDays, ...days];
                      
                      return allDays.map((day, idx) => {
                        if (day === null) {
                          return <div key={idx} className="p-2"></div>;
                        }
                        
                        const isBooked = isDateBooked(day);
                        const isPastDate = isDateInPast(day);
                        const checkInDate = new Date(bookingForm.start_date);
                        const isBeforeCheckIn = isBefore(day, checkInDate) && !isSameDay(day, checkInDate);
                        const isCheckOutSelected = bookingForm.end_date && isSameDay(day, new Date(bookingForm.end_date));
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => !isBooked && !isPastDate && !isBeforeCheckIn && handleCheckoutDateClick(day)}
                            disabled={isBooked || isPastDate || isBeforeCheckIn}
                            className={`p-2 text-sm rounded ${
                              isBooked 
                                ? 'bg-red-100 text-red-400 cursor-not-allowed' 
                                : isPastDate || isBeforeCheckIn
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : isCheckOutSelected
                                    ? 'bg-indigo-500 text-white'
                                    : 'hover:bg-gray-100'
                            }`}
                          >
                            {format(day, 'd')}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <div className="flex items-center mb-1">
                      <div className="w-4 h-4 bg-red-100 rounded mr-2"></div>
                      <span>Booked days</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-100 rounded mr-2"></div>
                      <span>Unavailable</span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => setShowCheckoutCalendar(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Access Log Modal (Admin only) */}
      {user?.role === 'admin' && (
        <Transition appear show={showAccessLog} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setShowAccessLog(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                    <Dialog.Title className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      Access Log - Ultimele 20 autentificări
                    </Dialog.Title>

                    <div className="max-h-96 overflow-y-auto">
                      {accessLogs.length > 0 ? (
                        <div className="space-y-3">
                          {accessLogs.map((log) => (
                            <div key={log.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    <div className="font-medium text-gray-900">{log.name}</div>
                                    <span className={`inline-block text-xs px-2 py-1 rounded ${
                                      log.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                      {log.role === 'admin' ? 'Administrator' : 'Șofer'}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    📱 {log.phone}
                                  </div>
                                  <div className="text-sm text-gray-500 mt-1">
                                    🌐 IP: {log.ip}
                                  </div>
                                  <div className="flex items-center space-x-3 mt-1">
                                    {log.device && (
                                      <div className="text-xs text-gray-500">
                                        📱 {log.device}
                                      </div>
                                    )}
                                    {log.browser && (
                                      <div className="text-xs text-gray-500">
                                        🌍 {log.browser}
                                      </div>
                                    )}
                                    {log.device_model && (
                                      <div className="text-xs text-gray-500">
                                        📲 {log.device_model}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-500 text-right">
                                  <div>{format(new Date(log.timestamp), 'dd MMM yyyy', { locale: ro })}</div>
                                  <div className="font-medium">{format(new Date(log.timestamp), 'HH:mm:ss', { locale: ro })}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <span className="text-4xl block mb-2">📝</span>
                          Nu există înregistrări de acces încă.
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => setShowAccessLog(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Închide
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center">
        <p className="text-xs text-gray-500">
          Made with ❤️ for Nicolina Church
        </p>
        <p className="text-xs text-gray-400 mt-1">
          <VersionButton /> • © 2024
        </p>
      </footer>
    </div>
  );
};

export default MainApp;