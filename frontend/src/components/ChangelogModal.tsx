import React from 'react';
import { CHANGELOG } from '../config/version';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto m-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Changelog - Church Van Booking</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-6">
          {CHANGELOG.map((release) => (
            <div key={release.version}>
              <h3 className="font-semibold text-lg text-indigo-600 mb-2">Version {release.version}</h3>
              <ul className="text-sm text-gray-700 space-y-1 ml-4">
                {release.items.map((item, index) => (
                  <li key={index}>• <strong>{item.title}:</strong> {item.description}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        <div className="mt-6 text-center">
          <button 
            onClick={onClose}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;