import { useNavigate } from 'react-router-dom'; 

const LANDING_NAV_LINKS = [
  { label: 'Home', href: '/landing#home', isPage: true },
  { label: 'Services', href: '/landing#services', isPage: true },
  { label: 'How It Works', href: '/landing#how-it-works', isPage: true },
  { label: 'Login', href: '/login', isPage: true },
  { label: 'Register', href: '/signup', isPage: true },
  { label: 'FAQs', href: '/landing#faq', isPage: true },
  { label: 'Contact Us', href: '/landing#contact', isPage: true },
];

export default function TopNavbar({
  className = '',
  onMenuClick,
}) {
  const navigate = useNavigate();

  function handleNavClick(event, link) {
    if (link.isPage) {
      event.preventDefault();
      navigate(link.href);
    }
  }

  function handleMenuClick() {
    if (onMenuClick) {
      onMenuClick();
    }
  }

  return (
    <div className={`sticky top-0 z-50 bg-white border-b border-[rgba(99,188,230,0.20)] ${className}`}>
      <div className="navbar w-full max-w-[1400px] mx-auto px-5 lg:px-14 flex items-center justify-between h-20">
        <a href="/landing#home" className="flex items-center no-underline">
          <img
            src="/images/SecondaryLogo.png"
            alt="Herland Laundry Logo"
            className="h-[50px] w-auto object-contain"
          />
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {LANDING_NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`px-[14px] py-[6px] rounded-lg text-sm font-medium no-underline whitespace-nowrap transition-colors ${
                link.label === 'Home'
                  ? 'text-[#3878c2] bg-[rgba(56,120,194,0.08)] font-bold'
                  : 'text-[#6B8BAE] hover:text-[#3878c2] hover:bg-[rgba(56,120,194,0.08)] hover:font-bold'
              }`}
              onClick={(event) => handleNavClick(event, link)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          className="btn btn-square btn-ghost text-[#3878c2] lg:hidden ml-auto"
          type="button"
          onClick={handleMenuClick}
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