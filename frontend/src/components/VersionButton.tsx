import React, { useState } from 'react';
import { APP_VERSION } from '../config/version';
import ChangelogModal from './ChangelogModal';

interface VersionButtonProps {
  className?: string;
}

const VersionButton: React.FC<VersionButtonProps> = ({ className = '' }) => {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <button 
        onClick={() => setShowChangelog(true)}
        className={`text-xs text-gray-400 hover:text-gray-600 transition-colors underline cursor-pointer ${className}`}
      >
        Version {APP_VERSION}
      </button>
      
      <ChangelogModal 
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
      />
    </>
  );
};

export default VersionButton;