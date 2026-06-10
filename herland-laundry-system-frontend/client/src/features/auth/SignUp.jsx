import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../shared/components/Toast';

export default function Signup() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    requiredFields: '',
    confirmPassword: '',
  });

  const [isValid, setIsValid] = useState(false);

  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      const cleanValue = value.replace(/\D/g, '').slice(0, 11);
      setFormData((prev) => ({ ...prev, [name]: cleanValue }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBlur = (e) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
    if (e.target.name === 'password') setPasswordFocused(false);
  };

  const handleFocus = (e) => {
    if (e.target.name === 'password') setPasswordFocused(true);
  };

  // Password condition checks
  const passwordConditions = {
    length: /.{8,}/,
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    number: /\d/,
    specialChar: /[^A-Za-z0-9]/,
  };

  const checkPasswordConditions = (password) => ({
    length: passwordConditions.length.test(password),
    lowercase: passwordConditions.lowercase.test(password),
    uppercase: passwordConditions.uppercase.test(password),
    number: passwordConditions.number.test(password),
    specialChar: passwordConditions.specialChar.test(password),
  });

  const passwordStatus = checkPasswordConditions(formData.password);

  const renderCondition = (condition, text) => {
    let colorClass = 'text-[#b4b4b4]';
    let icon = '○';

    if (condition) {
      colorClass = 'text-[#4bad40]';
      icon = '✓';
    } else if (touched.password && !passwordFocused) {
      colorClass = 'text-[#ff0000]';
      icon = '✗';
    }

    return (
      <li className={`${colorClass} flex items-center gap-1`}>
        <span className="w-4">{icon}</span> <span>{text}</span>
      </li>
    );
  };

  useEffect(() => {
    const requiredFieldsFilled =
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.phoneNumber.trim() &&
      formData.password.trim() &&
      formData.confirmPassword.trim();

    setErrors({
      requiredFields: requiredFieldsFilled ? '' : 'Please fill out the required fields',
      confirmPassword:
        formData.password &&
        formData.confirmPassword &&
        formData.password !== formData.confirmPassword
          ? 'Passwords do not match'
          : '',
    });

    const allValid =
      requiredFieldsFilled &&
      Object.values(passwordStatus).every(Boolean) &&
      formData.password === formData.confirmPassword;

    setIsValid(allValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setIsLoading(true);
    setErrors((prev) => ({ ...prev, submitError: '' }));

    try {
      const payload = {
        email: formData.email || undefined,
        phone: formData.phoneNumber,
        password: formData.password,
        metadata: {
          full_name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phoneNumber,
        },
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Success
        console.log('Registration successful:', data);
        sessionStorage.setItem('registeredEmail', formData.email || formData.phoneNumber);
        navigate('/'); 
      } else {
        // Backend returned an error (e.g., rate limit, email exists)
        console.warn('Backend registration failed:', data.error);
        showToast(`Registration failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showToast(`An error occurred: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left side: Hero Image */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#1a232e]">
        <img
          src="https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&q=80"
          alt="Laundry"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a232e] to-transparent opacity-80" />
        <div className="relative z-10 flex flex-col justify-end p-16 h-full">
          <h1 className="text-4xl xl:text-5xl font-black text-white mb-4 leading-tight">Join Us Today,<br/>Wash Less Tomorrow.</h1>
          <p className="text-lg text-gray-300 max-w-md bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/10">
            Create an account to track your orders, manage preferences, and get your clothes cleaned with just a few clicks.
          </p>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-20 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Create an account</h2>
            <p className="mt-2 text-sm text-gray-500 font-medium">Please enter your details to get started.</p>
          </div>

          <div className="bg-white p-5 sm:p-7 rounded-2xl shadow-xl shadow-gray-200/50 ring-1 ring-gray-100">
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="John"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#3878c2]/50 focus:border-[#3878c2] transition-all"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Doe"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#3878c2]/50 focus:border-[#3878c2] transition-all"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Phone Number</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3878c2]/50 focus-within:border-[#3878c2] transition-all">
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="0912 345 6789"
                    maxLength={11}
                    className="w-full bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Email Address <span className="text-gray-400 font-normal lowercase">(optional)</span></label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="name@example.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none text-gray-900 font-medium placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#3878c2]/50 focus:border-[#3878c2] transition-all"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Password</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3878c2]/50 focus-within:border-[#3878c2] transition-all">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      onFocus={handleFocus}
                      placeholder="••••••••"
                      className="w-full bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400 tracking-widest"
                    />
                    <button
                        type="button"
                        tabIndex="-1"
                        onClick={() => setShowPassword(!showPassword)}
                        className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    )}
                    </button>
                </div>
              </div>

              {/* Password Conditions */}
              {(passwordFocused || touched.password || formData.password.length > 0) && (
                <ul className="text-xs sm:text-sm my-2 list-none space-y-1 bg-gray-50 border border-gray-100 rounded-xl p-3">
                  {renderCondition(passwordStatus.length, 'Must have at least 8 characters')}
                  {renderCondition(passwordStatus.lowercase, 'Must contain a lowercase letter')}
                  {renderCondition(passwordStatus.uppercase, 'Must contain an uppercase letter')}
                  {renderCondition(passwordStatus.number, 'Must contain a number')}
                  {renderCondition(passwordStatus.specialChar, 'Must contain a special character')}
                </ul>
              )}

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Confirm Password</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#3878c2]/50 focus-within:border-[#3878c2] transition-all">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="••••••••"
                    className="w-full bg-transparent outline-none text-gray-900 font-medium placeholder-gray-400 tracking-widest"
                  />
                  <button
                    type="button"
                    tabIndex="-1"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Messages */}
              {(touched.firstName && touched.lastName && touched.phoneNumber && touched.password && touched.confirmPassword) && errors.requiredFields && (
                <p className="text-xs sm:text-sm font-semibold text-red-500 mt-1 pl-1">{errors.requiredFields}</p>
              )}
              {(touched.confirmPassword || formData.confirmPassword.length > 0) && errors.confirmPassword && (
                <p className="text-xs sm:text-sm font-semibold text-red-500 mt-1 pl-1">{errors.confirmPassword}</p>
              )}

              {/* Terms and Conditions */}
              <p className="text-xs text-gray-500 my-4 text-center leading-relaxed">
                By signing up, you agree to our <br />
                <a href="#" className="font-bold text-[#4bad40] hover:underline">Terms and Conditions</a> and <a href="#" className="font-bold text-[#4bad40] hover:underline">Privacy Policy</a>
              </p>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isValid || isLoading}
                className={`w-full py-3 sm:py-3.5 rounded-xl text-sm font-bold shadow-md transition-all duration-300 ${
                  isValid && !isLoading
                    ? 'bg-[#4bad40] text-white hover:bg-[#3f9136] hover:shadow-[#4bad40]/30 hover:-translate-y-0.5'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-6 text-center border-t border-gray-100 pt-6">
                <p className="text-sm font-medium text-gray-500">
                    Already have an account?{' '}
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="text-[#3878c2] font-bold hover:text-[#2a5d99] hover:underline transition-colors"
                    >
                        Login instead
                    </button>
                </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}