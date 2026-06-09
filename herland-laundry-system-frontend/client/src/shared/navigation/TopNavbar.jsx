import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRoleNavigation } from './navItems';
import { supabase } from '../../lib/supabase';

export default function TopNavbar({
  className = '',
  onMenuClick,
}) {
  const navigate = useNavigate();

  return (
    <div className={`sticky top-0 z-50 bg-[#1a232e] shadow-sm ${className}`}>
      <div className="navbar w-full max-w-[1400px] mx-auto px-5 flex items-center justify-between h-20">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="btn btn-ghost px-0 lg:hidden"
        >
          <img
            src="/images/SecondaryLogo.png"
            alt="Herland Laundry"
            className="h-10"
          />
        </button>

        <button
          className="btn btn-square btn-ghost text-[#3878c2] lg:hidden"
          type="button"
          onClick={onMenuClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h18v2H3z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
