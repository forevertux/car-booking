import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import axios from '../services/axios';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  CalendarDaysIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  ClockIcon,
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
}

interface MaintenanceItem {
  id: number;
  type: string;
  expiry_date: string;
  status: string;
}

const Dashboard = () => {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [bookingsRes, maintenanceRes] = await Promise.all([
        axios.get('/bookings'),
        axios.get('/maintenance/status')
      ]);
      
      setBookings(bookingsRes.data);
      setMaintenance(maintenanceRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingBookings = bookings
    .filter(b => new Date(b.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
    .slice(0, 5);

  const getMaintenanceStatus = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expirat', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircleIcon };
    if (days <= 7) return { text: `${days} zile`, color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: ClockIcon };
    if (days <= 30) return { text: `${days} zile`, color: 'text-blue-600', bgColor: 'bg-blue-100', icon: ClockIcon };
    return { text: `${days} zile`, color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircleIcon };
  };

  const getMaintenanceLabel = (type: string) => {
    switch(type) {
      case 'insurance': return 'Asigurare';
      case 'itp': return 'ITP';
      case 'vignette': return 'Rovinietă';
      default: return type;
    }
  };

  const stats = [
    {
      name: 'Active Bookings',
      value: bookings.filter(b => new Date(b.start_date) <= new Date() && new Date(b.end_date) >= new Date()).length,
      icon: CalendarDaysIcon,
      color: 'bg-blue-500',
      link: '/bookings'
    },
    {
      name: 'Upcoming Bookings',
      value: bookings.filter(b => new Date(b.start_date) > new Date()).length,
      icon: ClockIcon,
      color: 'bg-green-500',
      link: '/bookings'
    },
    ...(user?.role === 'admin' ? [
      {
        name: 'Documente Expirate',
        value: maintenance.filter(m => new Date(m.expiry_date) < new Date()).length,
        icon: ExclamationTriangleIcon,
        color: 'bg-red-500',
        link: '/maintenance'
      }
    ] : [])
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bun venit, {user?.name}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here you can see a summary of van activity
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((item) => (
          <Link
            key={item.name}
            to={item.link}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow hover:shadow-md transition-shadow sm:px-6"
          >
            <dt>
              <div className={`absolute rounded-md ${item.color} p-3`}>
                <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
            </dt>
            <dd className="ml-16 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
            </dd>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Bookings */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Upcoming Bookings
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{booking.name}</p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(booking.start_date), 'd MMM yyyy HH:mm', { locale: ro })} - 
                          {format(new Date(booking.end_date), 'd MMM yyyy HH:mm', { locale: ro })}
                        </p>
                        {booking.scope && (
                          <p className="text-sm text-gray-600 mt-1">{booking.scope}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming bookings</p>
            )}
            <div className="mt-4">
              <Link
                to="/bookings"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                View all bookings →
              </Link>
            </div>
          </div>
        </div>

        {/* Maintenance Status */}
        {user?.role === 'admin' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Status Documente
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-3">
                {maintenance.map((item) => {
                  const status = getMaintenanceStatus(item.expiry_date);
                  return (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">
                            {getMaintenanceLabel(item.type)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expiră: {format(new Date(item.expiry_date), 'd MMMM yyyy', { locale: ro })}
                          </p>
                        </div>
                        <div className={`flex items-center px-3 py-1 rounded-full ${status.bgColor}`}>
                          <status.icon className={`h-4 w-4 mr-1 ${status.color}`} />
                          <span className={`text-sm font-medium ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <Link
                  to="/maintenance"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Gestionează documente →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Acțiuni Rapide
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              to="/bookings"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <CalendarDaysIcon className="mr-2 h-5 w-5" />
              Book the Van
            </Link>
            <Link
              to="/issues"
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <ExclamationTriangleIcon className="mr-2 h-5 w-5" />
              Raportează o Problemă
            </Link>
            {user?.role === 'admin' && (
              <>
                <Link
                  to="/users"
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <UsersIcon className="mr-2 h-5 w-5" />
                  Gestionează Utilizatori
                </Link>
                <Link
                  to="/maintenance"
                  className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <WrenchScrewdriverIcon className="mr-2 h-5 w-5" />
                  Actualizează Documente
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;