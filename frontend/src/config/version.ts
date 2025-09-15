// Centralized configuration for version and changelog
export const APP_VERSION = '2.3.0';

export interface ChangelogEntry {
  version: string;
  items: Array<{
    title: string;
    description: string;
  }>;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.3.0',
    items: [
      {
        title: 'Access Log for administrators',
        description: 'Administrators can view the last 20 users who successfully authenticated in the application'
      },
      {
        title: 'Authentication logging',
        description: 'The system automatically records all successful authentications with timestamp and user details'
      }
    ]
  },
  {
    version: '2.2.0',
    items: [
      {
        title: 'Auto-complete PIN SMS',
        description: 'PIN from SMS is auto-completed using WebOTP API'
      },
      {
        title: 'Auto-authentication',
        description: 'After PIN auto-completion, the user is automatically authenticated without having to click'
      },
      {
        title: 'Custom SMS messages',
        description: 'SMS messages are personalized: "PIN - is your PIN for the Church Van Booking app"'
      },
      {
        title: 'Smart PIN detection',
        description: 'The system automatically detects the PIN when pasting text from SMS'
      },
      {
        title: 'Visual feedback',
        description: 'The status of the auto-completion and authentication process is displayed to the user'
      },
      {
        title: 'Changelog modal',
        description: 'Informații detaliate despre modificările din fiecare versiune'
      }
    ]
  },
  {
    version: '2.1.0',
    items: [
      {
        title: 'Calendar corect',
        description: 'Rezolvată problema cu afișarea zilelor din calendar (nu mai încep toate lunile cu Luni)'
      },
      {
        title: 'Validare număr telefon cu spații',
        description: 'Numerele de telefon cu spații sunt acum acceptate și curățate automat'
      },
      {
        title: 'Current day bookings',
        description: 'Ability to make bookings for the current day (not just for future days)'
      },
      {
        title: 'Booking sorting',
        description: 'Bookings are sorted chronologically - upcoming in "Bookings", most recent in "History"'
      },
      {
        title: 'Corecturi backend',
        description: 'Rezolvate problemele cu validarea și gestionarea numerelor de telefon'
      }
    ]
  },
  {
    version: '2.0.0',
    items: [
      {
        title: 'Complete booking system',
        description: 'Modern interface for booking seats on the church van'
      },
      {
        title: 'Autentificare SMS/Email',
        description: 'Sistem de autentificare securizat prin PIN primit pe telefon sau email'
      },
      {
        title: 'Calendar interactiv',
        description: 'Clear visualization of available days for bookings'
      },
      {
        title: 'Booking management',
        description: 'Ability to view active bookings and history'
      },
      {
        title: 'Design responsive',
        description: 'Aplicația funcționează perfect pe desktop și mobile'
      },
      {
        title: 'Integrare AWS',
        description: 'Backend scalabil folosind AWS Lambda, S3 și CloudFront'
      }
    ]
  }
];