import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('email'); // email | mobile
  const [value, setValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validation
  useEffect(() => {
    if (!value) {
      setWarning('');
      return;
    }

    if (mode === 'mobile') {
      let cleanPhone = value.replace(/\D/g, '');
      const isValidMobile = /^09\d{9}$/.test(cleanPhone);
      setWarning(
        isValidMobile
          ? ''
          : 'Please enter a valid Philippine mobile number (e.g., 09123456789)'
      );
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      setWarning(
        emailRegex.test(value) ? '' : 'Please enter a valid email address'
      );
    }
  }, [value, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (warning || !value || !password) return;

    setLoading(true);
    setError('');

    // Set the keepSignedIn flag BEFORE authenticating so the hybrid storage
    // adapter knows where to persist the session tokens.
    if (keepSignedIn) {
      window.localStorage.setItem('keepSignedIn', 'true');
    } else {
      window.localStorage.removeItem('keepSignedIn');
    }

    try {
      let emailToAuth = value;

      // If user is logging in with mobile number, look up their email
      if (mode === 'mobile') {
        const cleanPhone = value.replace(/\D/g, '');

        // Build all possible format variants of the phone number
        // so we match however it was stored in the profiles table
        let variants = [cleanPhone];
        if (cleanPhone.startsWith('09')) {
          variants.push(cleanPhone.substring(1));           // 9xxxxxxxxx
          variants.push('63' + cleanPhone.substring(1));    // 63xxxxxxxxx
          variants.push('+63' + cleanPhone.substring(1));   // +63xxxxxxxxx
        } else if (cleanPhone.startsWith('9') && cleanPhone.length === 10) {
          variants.push('0' + cleanPhone);                  // 09xxxxxxxxx
          variants.push('63' + cleanPhone);                 // 63xxxxxxxxx
          variants.push('+63' + cleanPhone);                // +63xxxxxxxxx
        }

        let foundEmail = null;

        // Strategy 1: Query profiles table directly (no backend needed)
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .in('phone_number', variants)
            .maybeSingle();

          if (!profileError && profile?.email) {
            foundEmail = profile.email;
          }
        } catch (_) {
          // profiles table may not have email column yet — continue to fallback
        }

        // Strategy 2: Fall back to backend /lookup-email endpoint
        if (!foundEmail) {
          try {
            const backendUrl = import.meta.env.VITE_API_URL || '';
            const lookupRes = await fetch(`${backendUrl}/api/v1/auth/lookup-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: cleanPhone }),
            });

            if (lookupRes.ok) {
              const lookupData = await lookupRes.json();
              if (lookupData?.email) {
                foundEmail = lookupData.email;
              }
            }
          } catch (_) {
            // Backend unreachable — continue
          }
        }

        // Strategy 3: Try direct phone login (works if Phone provider is enabled in Supabase)
        if (!foundEmail) {
          let e164Phone = cleanPhone;
          if (e164Phone.startsWith('09')) e164Phone = '63' + e164Phone.substring(1);
          else if (e164Phone.startsWith('9') && e164Phone.length === 10) e164Phone = '63' + e164Phone;

          const { data: phoneSignIn, error: phoneSignInError } = await supabase.auth.signInWithPassword({
            phone: '+' + e164Phone,
            password,
          });

          if (!phoneSignInError && phoneSignIn?.user) {
            // Phone login succeeded — redirect based on role
            const userId = phoneSignIn.user.id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .single();

            const role = profile?.role || 'Customer';
            window.sessionStorage.setItem('activeRole', role);
            window.localStorage.setItem('currentUserId', userId);

            if (role === 'Admin') navigate('/admin');
            else if (role === 'Staff') navigate('/staff');
            else if (role === 'Rider') navigate('/rider');
            else navigate('/user');
            return;
          }

          // If phone login also fails, show the error
          setError('No account found with this mobile number.');
          return;
        }

        emailToAuth = foundEmail;
      }

      // Always authenticate using email
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToAuth,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const userId = data.user?.id;

      // Look up role in profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const role = profile?.role || 'Customer';

      // Store role for the route switcher
      window.sessionStorage.setItem('activeRole', role);
      window.localStorage.setItem('currentUserId', userId);

      // Redirect based on role
      if (role === 'Admin') navigate('/admin');
      else if (role === 'Staff') navigate('/staff');
      else if (role === 'Rider') navigate('/rider');
      else navigate('/user');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-y-auto bg-slate-50">
      {/* Left side: Hero Image */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#1a232e] min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&q=80"
          alt="Laundry"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a232e] to-transparent opacity-80" />
        <div className="relative z-10 flex flex-col justify-end p-16 pb-28 h-full">
          <h1 className="text-4xl xl:text-5xl font-black text-white mb-4 leading-tight">Fresh Clothes,<br/>Less Hassle.</h1>
          <p className="text-lg text-gray-300 max-w-md bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/10">
            Log in to manage your bookings, schedule pickups, and experience the easiest laundry service in town.
          </p>
        </div>
      </div>

      {/* Right side: Form shrink adjustments */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-20 relative">
        <div className="w-full max-w-md space-y-6 pb-24">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Welcome back</h2>
            <p className="mt-2 text-sm text-gray-500 font-medium">Please enter your credentials to login.</p>
          </div>

          <div className="bg-white p-5 sm:p-7 rounded-2xl shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
            {/* Toggle Buttons */}
            <div className="flex mb-6 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode('mobile'); setValue(''); setError(''); }}
                className={`flex-1 py-2 sm:py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  mode === 'mobile'
                    ? 'bg-white text-[#3878c2] shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Mobile Number
              </button>
              <button
                type="button"
                onClick={() => { setMode('email'); setValue(''); setError(''); }}
                className={`flex-1 py-2 sm:py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                  mode === 'email'
                    ? 'bg-white text-[#3878c2] shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Email Address
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Identifier */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                  {mode === 'mobile' ? 'Mobile Number' : 'Email Address'}
                </label>
                <div className={`flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 sm:py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3878c2]/50 focus-within:border-[#3878c2] transition-all ${warning ? 'border-red-300 ring-4 ring-red-50 bg-red-50/50' : ''}`}>
                  <input
                    type={mode === 'mobile' ? 'tel' : 'email'}
                    value={value}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (mode === 'mobile') {
                        val = val.replace(/\D/g, '');
                        if (val.length > 11) val = val.slice(0, 11);
                      }
                      setValue(val);
                    }}
                    placeholder={mode === 'mobile' ? '0912 345 6789' : 'name@example.com'}
                    maxLength={mode === 'mobile' ? 11 : undefined}
                    className="w-full bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400"
                  />
                </div>
                {warning && <p className="mt-2 text-xs font-medium text-red-500">{warning}</p>}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                    Password
                    </label>
                    <button
                        type="button"
                        onClick={() => navigate('/forgot-password')}
                        className="text-xs font-bold text-[#3878c2] hover:text-[#2a5d99] hover:underline transition-colors"
                    >
                        Forgot password?
                    </button>
                </div>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 sm:py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3878c2]/50 focus-within:border-[#3878c2] transition-all">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400 tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ml-2 text-gray-400 hover:text-[#3878c2] transition-colors flex-shrink-0"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                    <p className="text-xs sm:text-sm font-semibold text-red-600 text-center">{error}</p>
                </div>
              )}

              {/* Keep Me Signed In */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none group mt-1">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(e) => setKeepSignedIn(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#3878c2] focus:ring-[#3878c2]/50 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                  Keep me signed in
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!!warning || !value || !password || loading}
                className={`w-full py-3 sm:py-3.5 rounded-xl text-sm font-bold shadow-md transition-all duration-300 mt-2 ${
                  !warning && value && password && !loading
                    ? 'bg-[#4bad40] text-white hover:bg-[#3f9136] hover:shadow-[#4bad40]/30 hover:-translate-y-0.5'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 sm:mt-8 text-center border-t border-gray-100 pt-5 sm:pt-6">
                <p className="text-sm font-medium text-gray-500">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/signup')}
                        className="text-[#3878c2] font-bold hover:text-[#2a5d99] hover:underline transition-colors"
                    >
                        Create one now
                    </button>
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}