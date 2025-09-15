import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import useAuthStore from '../store/authStore';
import axios from '../services/axios';
import { PhoneIcon, KeyIcon, DevicePhoneMobileIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import VersionButton from '../components/VersionButton';

const phoneSchema = z.object({
  phone: z.string()
    .min(10, 'Phone number must have at least 10 digits')
    .transform(val => val.replace(/[\s-().]/g, '')) // Clean spaces and formatting
    .refine(val => /^(\+40|0)\d{9}$/.test(val), {
      message: 'Invalid format. Example: 0721234567 or +40721234567'
    })
});

const pinSchema = z.object({
  pin: z.string().length(4, 'PIN must have exactly 4 digits')
});

type PhoneFormData = z.infer<typeof phoneSchema>;
type PinFormData = z.infer<typeof pinSchema>;

const Login = () => {
  const navigate = useNavigate();
  const { requestPin, validatePin, error, clearError, isLoading } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phone, setPhone] = useState('');
  const [pinMethod, setPinMethod] = useState<'sms' | 'email'>('sms');
  const [userEmail, setUserEmail] = useState('');
  const [customError, setCustomError] = useState('');
  const [webOtpStatus, setWebOtpStatus] = useState('');

  const phoneForm = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema)
  });

  const pinForm = useForm<PinFormData>({
    resolver: zodResolver(pinSchema)
  });

  // WebOTP API pentru auto-completarea PIN-ului din SMS
  useEffect(() => {
    if (step === 'pin' && pinMethod === 'sms') {
      if ('OTPCredential' in window) {
        setWebOtpStatus('Se așteaptă SMS-ul pentru auto-completare...');
        const abortController = new AbortController();
        
        // Timeout pentru a evita hanging
        const timeoutId = setTimeout(() => {
          setWebOtpStatus('');
          abortController.abort();
        }, 60000);

        // Use any to avoid TypeScript issues with WebOTP API
        (navigator.credentials as any).get({
          otp: { transport: ['sms'] },
          signal: abortController.signal
        }).then((otp: any) => {
          clearTimeout(timeoutId);
          
          if (otp && otp.code) {
            // Auto-completează PIN-ul din SMS
            pinForm.setValue('pin', otp.code);
            setWebOtpStatus('PIN auto-completat! Se autentifică...');
            
            // Focus pe butonul de submit pentru a evidenția că PIN-ul este completat
            const submitBtn = document.querySelector('[type="submit"]') as HTMLButtonElement;
            if (submitBtn) {
              submitBtn.style.backgroundColor = '#059669';
              submitBtn.style.boxShadow = '0 0 0 3px rgba(5, 150, 105, 0.5)';
            }
            
            // Auto-autentificare după o scurtă pauză (pentru a permite utilizatorului să vadă ce se întâmplă)
            setTimeout(async () => {
              try {
                // Trigger validarea PIN-ului automat
                await validatePin(phone, otp.code);
                setWebOtpStatus('Autentificat cu succes! ✅');
                setTimeout(() => {
                  navigate('/dashboard');
                }, 1000);
              } catch (error) {
                setWebOtpStatus('PIN incorect. Încercați din nou.');
                setTimeout(() => setWebOtpStatus(''), 3000);
              }
            }, 1500);
          } else {
            setWebOtpStatus('Nu s-a putut extrage PIN-ul din SMS');
            setTimeout(() => setWebOtpStatus(''), 3000);
          }
        }).catch((err: any) => {
          clearTimeout(timeoutId);
          
          if (err.name === 'AbortError') {
            setWebOtpStatus('');
          } else if (err.name === 'NotSupportedError') {
            setWebOtpStatus('WebOTP nu este suportat pe acest dispozitiv');
            setTimeout(() => setWebOtpStatus(''), 3000);
          } else {
            setWebOtpStatus('Eroare la auto-completarea PIN-ului');
            setTimeout(() => setWebOtpStatus(''), 3000);
          }
        });

        return () => {
          clearTimeout(timeoutId);
          abortController.abort();
        };
      }
    }
  }, [step, pinMethod, pinForm]);


  const handlePhoneSubmit = async (data: PhoneFormData, method: 'sms' | 'email') => {
    try {
      clearError();
      setCustomError('');
      
      const formattedPhone = data.phone.startsWith('+40') 
        ? data.phone 
        : data.phone.startsWith('0') 
          ? `+40${data.phone.slice(1)}`
          : `+40${data.phone}`;
      
      setPhone(formattedPhone);
      setPinMethod(method);
      
      try {
        if (method === 'email') {
          // Check if user has email first
          try {
            const checkResponse = await axios.post('/pin/check-email', { phone: formattedPhone });
            if (!checkResponse.data.hasEmail) {
              setCustomError('Nu aveți o adresă de email înregistrată. Folosiți SMS pentru autentificare.');
              return;
            }
            // Request PIN via email
            const emailResponse = await axios.post('/pin/request-pin-email', { phone: formattedPhone });
            if (emailResponse.data.email) {
              setUserEmail(emailResponse.data.email);
            }
          } catch (emailError: any) {
            if (emailError.response?.status === 404) {
              setCustomError('Numărul de telefon nu este înregistrat în sistem');
            } else {
              setCustomError('Error sending PIN via email');
            }
            return;
          }
        } else {
          // Request PIN via SMS
          await requestPin(formattedPhone);
        }
        setStep('pin');
      } catch (error: any) {
        setCustomError(error.message || 'Error sending PIN');
      }
    } catch (error: any) {
      setCustomError('Eroare la verificarea utilizatorului');
    }
  };

  const handlePinSubmit = async (data: PinFormData) => {
    try {
      clearError();
      setCustomError('');
      await validatePin(phone, data.pin);
      navigate('/dashboard');
    } catch (error) {
      // Error is handled in the store
    }
  };

  const handleBack = () => {
    setStep('phone');
    pinForm.reset();
    clearError();
    setCustomError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}></div>
        </div>
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Login Card */}
      <div className="relative max-w-md w-full mx-4">
        <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 shadow-lg">
              <span className="text-4xl">🚐</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Church Van Booking
            </h1>
            <p className="text-gray-600 text-sm">
              Nicolina Evangelical Church
            </p>
          </div>

          {step === 'phone' ? (
            <div className="space-y-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Număr de telefon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <PhoneIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...phoneForm.register('phone')}
                    type="tel"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg"
                    placeholder="0721234567"
                  />
                </div>
                {phoneForm.formState.errors.phone && (
                  <p className="mt-2 text-sm text-red-600">
                    {phoneForm.formState.errors.phone.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-600 text-center">Send PIN via:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => phoneForm.handleSubmit((data) => handlePhoneSubmit(data, 'sms'))()}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center py-4 px-4 border-2 border-green-500 bg-green-50 rounded-xl hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <DevicePhoneMobileIcon className="h-8 w-8 text-green-600 mb-2" />
                    <span className="text-lg font-medium text-gray-900">SMS</span>
                  </button>

                  <button
                    onClick={() => phoneForm.handleSubmit((data) => handlePhoneSubmit(data, 'email'))()}
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center py-4 px-4 border-2 border-purple-500 bg-purple-50 rounded-xl hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <EnvelopeIcon className="h-8 w-8 text-purple-600 mb-2" />
                    <span className="text-lg font-medium text-gray-900">Email</span>
                  </button>
                </div>
              </div>

              {(error || customError) && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                  {error || customError}
                </div>
              )}

              {isLoading && (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-3 text-gray-600">Sending PIN...</span>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={pinForm.handleSubmit(handlePinSubmit)} className="space-y-6">
              <div className={`p-4 rounded-xl ${
                pinMethod === 'email' 
                  ? 'bg-purple-50 border border-purple-200' 
                  : 'bg-green-50 border border-green-200'
              }`}>
                <div className="flex items-center">
                  {pinMethod === 'email' ? (
                    <EnvelopeIcon className="h-5 w-5 text-purple-600 mr-2" />
                  ) : (
                    <DevicePhoneMobileIcon className="h-5 w-5 text-green-600 mr-2" />
                  )}
                  <p className={`text-sm ${
                    pinMethod === 'email' ? 'text-purple-700' : 'text-green-700'
                  }`}>
                    PIN-ul a fost trimis {pinMethod === 'email' 
                      ? `pe email la ${userEmail}` 
                      : `prin SMS la ${phone}`}
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  Introdu codul PIN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    {...pinForm.register('pin')}
                    type="text"
                    maxLength={4}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onPaste={(e) => {
                      // Handle paste event to extract PIN from SMS
                      e.preventDefault();
                      const clipboardData = e.clipboardData?.getData('text') || '';
                      console.log('Paste detected, clipboard content:', clipboardData);
                      
                      // Try multiple PIN extraction patterns
                      const patterns = [
                        /\b\d{4}\b/g,                    // Basic 4-digit number
                        /#(\d{4})\b/g,                   // After # symbol
                        /cod[:\s]*(\d{4})/gi,            // After "cod"
                        /autentificare[:\s]*(\d{4})/gi,  // After "autentificare"
                      ];
                      
                      let extractedPin = null;
                      for (const pattern of patterns) {
                        const match = pattern.exec(clipboardData);
                        if (match) {
                          extractedPin = match[1] || match[0];
                          console.log('PIN extracted with pattern:', pattern, 'Result:', extractedPin);
                          break;
                        }
                      }
                      
                      if (extractedPin && extractedPin.length === 4 && /^\d{4}$/.test(extractedPin)) {
                        console.log('Setting PIN from paste:', extractedPin);
                        pinForm.setValue('pin', extractedPin);
                        setWebOtpStatus('PIN extras din mesaj! ✅');
                        setTimeout(() => setWebOtpStatus(''), 3000);
                      } else {
                        // Fallback la comportamentul normal de paste
                        setTimeout(() => {
                          const inputValue = (e.target as HTMLInputElement).value;
                          const pinMatch = inputValue.match(/\b\d{4}\b/);
                          if (pinMatch) {
                            console.log('PIN detected from input after paste:', pinMatch[0]);
                            pinForm.setValue('pin', pinMatch[0]);
                          }
                        }, 0);
                      }
                    }}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                    placeholder="• • • •"
                  />
                </div>
                {pinForm.formState.errors.pin && (
                  <p className="mt-2 text-sm text-red-600">
                    {pinForm.formState.errors.pin.message}
                  </p>
                )}
                
                {webOtpStatus && (
                  <p className={`mt-2 text-sm ${
                    webOtpStatus.includes('✅') ? 'text-green-600' : 
                    webOtpStatus.includes('Nu s-a putut') ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    {webOtpStatus}
                  </p>
                )}
              </div>

              {(error || customError) && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
                  {error || customError}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Se verifică...
                    </div>
                  ) : (
                    'Autentificare'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all"
                >
                  Înapoi
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-2">PIN-ul este valabil 5 minute</p>
            <p className="text-sm text-gray-600 font-medium">
              Made with ❤️ for Nicolina Church
            </p>
            <p className="text-xs text-gray-400 mt-1">
              <VersionButton /> • © 2024
            </p>
          </div>
        </div>
      </div>


      {/* Add animation styles */}
      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Login;