import { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import axios from '../services/axios';
import useAuthStore from '../store/authStore';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
  MapPinIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface Issue {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  status: 'open' | 'in_progress' | 'resolved';
  reporter_name: string;
  reporter_phone: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

const Issues = () => {
  const { user } = useAuthStore();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    location: ''
  });
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const response = await axios.get('/issues');
      setIssues(response.data);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await axios.post('/issues', formData);
      setIsCreateModalOpen(false);
      setFormData({ title: '', description: '', severity: 'medium', location: '' });
      fetchIssues();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Eroare la raportarea problemei');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIssue) return;
    
    setSubmitting(true);
    try {
      await axios.patch(`/issues/${selectedIssue.id}`, {
        status: 'resolved',
        resolution_notes: resolutionNotes
      });
      setIsResolveModalOpen(false);
      setSelectedIssue(null);
      setResolutionNotes('');
      fetchIssues();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Eroare la rezolvarea problemei');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">Critică</span>;
      case 'high':
        return <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">Ridicată</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">Medie</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Scăzută</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Rezolvată</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">În lucru</span>;
      case 'open':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Deschisă</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Separate issues by status
  const openIssues = issues.filter(i => i.status === 'open');
  const inProgressIssues = issues.filter(i => i.status === 'in_progress');
  const resolvedIssues = issues.filter(i => i.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Probleme Raportate</h1>
          <p className="mt-1 text-sm text-gray-600">
            Report and track technical issues with the van
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="mr-2 h-5 w-5" />
            Raportează Problemă
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Probleme Deschise</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">{openIssues.length}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">În Lucru</dt>
            <dd className="mt-1 text-3xl font-semibold text-blue-600">{inProgressIssues.length}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Rezolvate</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">{resolvedIssues.length}</dd>
          </div>
        </div>
      </div>

      {/* Issues List */}
      {openIssues.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-3">Probleme Active</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {openIssues.map((issue) => (
                <li key={issue.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900">{issue.title}</h3>
                        <div className="flex items-center space-x-2">
                          {getSeverityBadge(issue.severity)}
                          {getStatusBadge(issue.status)}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{issue.description}</p>
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <UserIcon className="mr-1 h-4 w-4" />
                          {issue.reporter_name}
                        </div>
                        <div className="flex items-center">
                          <MapPinIcon className="mr-1 h-4 w-4" />
                          {issue.location}
                        </div>
                        <div className="flex items-center">
                          <ClockIcon className="mr-1 h-4 w-4" />
                          {format(new Date(issue.created_at), 'd MMM yyyy', { locale: ro })}
                        </div>
                      </div>
                      {user?.role === 'admin' && (
                        <div className="mt-3">
                          <button
                            onClick={() => {
                              setSelectedIssue(issue);
                              setIsResolveModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircleIcon className="mr-1 h-4 w-4" />
                            Marchează ca rezolvată
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {resolvedIssues.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-3">Probleme Rezolvate</h2>
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-gray-200">
              {resolvedIssues.slice(0, 5).map((issue) => (
                <li key={issue.id} className="px-4 py-4 sm:px-6 bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 line-through">{issue.title}</h3>
                        <div className="flex items-center space-x-2">
                          {getSeverityBadge(issue.severity)}
                          {getStatusBadge(issue.status)}
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{issue.description}</p>
                      {issue.resolution_notes && (
                        <div className="mt-2 p-2 bg-green-50 rounded">
                          <p className="text-sm text-green-800">
                            <strong>Rezoluție:</strong> {issue.resolution_notes}
                          </p>
                        </div>
                      )}
                      <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <UserIcon className="mr-1 h-4 w-4" />
                          {issue.reporter_name}
                        </div>
                        {issue.resolved_at && (
                          <div className="flex items-center">
                            <CheckCircleIcon className="mr-1 h-4 w-4" />
                            Rezolvată {format(new Date(issue.resolved_at), 'd MMM yyyy', { locale: ro })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Create Issue Modal */}
      <Transition.Root show={isCreateModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setIsCreateModalOpen}>
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
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                  
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                      <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Raportează o Problemă
                      </Dialog.Title>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <div>
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                        Titlu *
                      </label>
                      <input
                        type="text"
                        id="title"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ex: Problemă la frâne"
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Descriere *
                      </label>
                      <textarea
                        id="description"
                        required
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Descrie problema în detaliu"
                      />
                    </div>

                    <div>
                      <label htmlFor="severity" className="block text-sm font-medium text-gray-700">
                        Severitate *
                      </label>
                      <select
                        id="severity"
                        value={formData.severity}
                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="low">Scăzută - Nu afectează utilizarea</option>
                        <option value="medium">Medie - Afectează parțial utilizarea</option>
                        <option value="high">Ridicată - Afectează semnificativ utilizarea</option>
                        <option value="critical">Critică - Vehiculul nu poate fi utilizat</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                        Locație *
                      </label>
                      <input
                        type="text"
                        id="location"
                        required
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Ex: Parcare biserică"
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
                        {submitting ? 'Submitting...' : 'Report'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCreateModalOpen(false)}
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

      {/* Resolve Issue Modal */}
      <Transition.Root show={isResolveModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={setIsResolveModalOpen}>
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
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Marchează ca Rezolvată
                      </Dialog.Title>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          {selectedIssue?.title}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="resolution" className="block text-sm font-medium text-gray-700">
                      Note rezoluție (opțional)
                    </label>
                    <textarea
                      id="resolution"
                      rows={3}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Descrie cum a fost rezolvată problema"
                    />
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={handleResolve}
                      disabled={submitting}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Se salvează...' : 'Marchează ca Rezolvată'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResolveModalOpen(false);
                        setSelectedIssue(null);
                        setResolutionNotes('');
                      }}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                    >
                      Anulează
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default Issues;