import { useState, useEffect } from 'react';
import axios from '../services/axios';
import useAuthStore from '../store/authStore';
import { format, differenceInDays } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  WrenchScrewdriverIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';

interface MaintenanceItem {
  id: number;
  type: 'insurance' | 'itp' | 'vignette';
  expiry_date: string;
  status: string;
}

const Maintenance = () => {
  const { user } = useAuthStore();
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ [key: string]: string }>({
    insurance: '',
    itp: '',
    vignette: ''
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      window.location.href = '/dashboard';
      return;
    }
    fetchMaintenance();
  }, [user]);

  const fetchMaintenance = async () => {
    try {
      const response = await axios.get('/maintenance/status');
      const data = response.data;
      setItems(data);
      
      // Initialize form data with existing dates
      const initialData: { [key: string]: string } = {};
      data.forEach((item: MaintenanceItem) => {
        initialData[item.type] = item.expiry_date.split('T')[0];
      });
      setFormData(initialData);
    } catch (error) {
      console.error('Error fetching maintenance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (type: string) => {
    if (!formData[type]) return;
    
    setUpdating(type);
    try {
      await axios.post('/maintenance/update', {
        type,
        expiry_date: formData[type]
      });
      await fetchMaintenance();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Eroare la actualizare');
    } finally {
      setUpdating(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'insurance':
        return ShieldCheckIcon;
      case 'itp':
        return DocumentCheckIcon;
      case 'vignette':
        return ReceiptPercentIcon;
      default:
        return WrenchScrewdriverIcon;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'insurance':
        return 'Asigurare RCA';
      case 'itp':
        return 'Inspecția Tehnică Periodică';
      case 'vignette':
        return 'Rovinietă';
      default:
        return type;
    }
  };

  const getDescription = (type: string) => {
    switch (type) {
      case 'insurance':
        return 'Asigurarea obligatorie de răspundere civilă auto';
      case 'itp':
        return 'Verificarea tehnică periodică a vehiculului';
      case 'vignette':
        return 'Taxa de utilizare a infrastructurii rutiere';
      default:
        return '';
    }
  };

  const getStatus = (expiryDate: string) => {
    const days = differenceInDays(new Date(expiryDate), new Date());
    
    if (days < 0) {
      return {
        text: `Expirat de ${Math.abs(days)} zile`,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        icon: ExclamationTriangleIcon,
        priority: 1
      };
    } else if (days === 0) {
      return {
        text: 'Expiră astăzi',
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        icon: ExclamationTriangleIcon,
        priority: 2
      };
    } else if (days <= 7) {
      return {
        text: `Expiră în ${days} ${days === 1 ? 'zi' : 'zile'}`,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        borderColor: 'border-yellow-200',
        icon: ClockIcon,
        priority: 3
      };
    } else if (days <= 30) {
      return {
        text: `Expiră în ${days} zile`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        borderColor: 'border-blue-200',
        icon: ClockIcon,
        priority: 4
      };
    } else {
      return {
        text: `Valid ${days} zile`,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        icon: CheckCircleIcon,
        priority: 5
      };
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Sort items by expiry priority
  const sortedItems = [...items].sort((a, b) => {
    const statusA = getStatus(a.expiry_date);
    const statusB = getStatus(b.expiry_date);
    return statusA.priority - statusB.priority;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentenanță Vehicul</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage mandatory documents and inspections for the van
        </p>
      </div>

      {/* Alert for expired items */}
      {items.some(item => differenceInDays(new Date(item.expiry_date), new Date()) < 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Atenție! Există documente expirate
              </h3>
              <p className="mt-1 text-sm text-red-700">
                Actualizează urgent documentele expirate pentru a evita problemele legale.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {sortedItems.map((item) => {
          const Icon = getIcon(item.type);
          const status = getStatus(item.expiry_date);
          
          return (
            <div
              key={item.id}
              className={`bg-white rounded-lg shadow-sm border-2 ${status.borderColor} overflow-hidden`}
            >
              <div className={`px-4 py-5 sm:p-6 ${status.bgColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Icon className={`h-8 w-8 ${status.color}`} />
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {getLabel(item.type)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {getDescription(item.type)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Data expirării:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {format(new Date(item.expiry_date), 'd MMMM yyyy', { locale: ro })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status:</span>
                    <div className={`flex items-center ${status.color}`}>
                      <status.icon className="h-4 w-4 mr-1" />
                      <span className="text-sm font-medium">{status.text}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-4 sm:px-6">
                <div className="space-y-3">
                  <div>
                    <label htmlFor={`date-${item.type}`} className="block text-sm font-medium text-gray-700">
                      Actualizează data expirării
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <div className="relative flex items-stretch flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <CalendarIcon className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="date"
                          id={`date-${item.type}`}
                          value={formData[item.type] || ''}
                          onChange={(e) => setFormData({ ...formData, [item.type]: e.target.value })}
                          min={new Date().toISOString().split('T')[0]}
                          className="block w-full rounded-none rounded-l-md pl-10 sm:text-sm border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUpdate(item.type)}
                        disabled={updating === item.type || !formData[item.type]}
                        className="relative -ml-px inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === item.type ? 'Se actualizează...' : 'Actualizează'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Calendar Mentenanță
          </h3>
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const status = getStatus(item.expiry_date);
              const Icon = getIcon(item.type);
              
              return (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-900">{getLabel(item.type)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {format(new Date(item.expiry_date), 'd MMM yyyy', { locale: ro })}
                    </span>
                    <status.icon className={`h-4 w-4 ${status.color}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;